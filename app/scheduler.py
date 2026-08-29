import logging
import asyncio
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from apscheduler import AsyncScheduler
from apscheduler.datastores.sqlalchemy import SQLAlchemyDataStore
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import update, select
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import get_settings, get_active_settings
from app.database import AsyncSessionLocal
from app.models import ScheduledJob, Playlist, PlaylistItem
from app.jellyfin_client import JellyfinClient
from app.adb_client import ADBClient

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler: AsyncScheduler | None = None


def create_scheduler() -> AsyncScheduler:
    """Create the APScheduler instance with persistent storage."""
    import os
    db_url = "sqlite+aiosqlite:////data/apscheduler.db" if os.path.exists("/data") else "sqlite+aiosqlite:///data/apscheduler.db"
    engine = create_async_engine(db_url, echo=False)
    data_store = SQLAlchemyDataStore(engine)
    return AsyncScheduler(data_store=data_store)


async def get_configured_tz() -> ZoneInfo:
    """Get the active application timezone for scheduling."""
    try:
        async with AsyncSessionLocal() as session:
            cfg = await get_active_settings(session)
            tz_name = cfg.get("app_timezone", "Asia/Jerusalem")
            return ZoneInfo(tz_name)
    except Exception as e:
        logger.warning(f"Could not load timezone from settings: {e}. Falling back to Asia/Jerusalem.")
        try:
            return ZoneInfo("Asia/Jerusalem")
        except Exception:
            return ZoneInfo("UTC")


async def monitor_playback_and_turn_off(
    session_id: str,
    item_ids: list[str],
    total_seconds: int,
    adb: ADBClient,
    jellyfin: JellyfinClient,
    job_db_id: str,
) -> None:
    """
    Background task that monitors Jellyfin playback and gracefully turns off the TV
    when the movie or playlist finishes.
    """
    logger.info(
        f"Monitoring playback for job {job_db_id} on session {session_id} "
        f"(expected total runtime: {total_seconds // 60}m)"
    )
    
    # Grace period at startup (wait 60 seconds before checking if stopped)
    await asyncio.sleep(60)
    
    elapsed = 60
    stop_count = 0
    poll_interval = 25
    max_timeout = total_seconds + 900  # Expected runtime + 15 min buffer
    
    while elapsed < max_timeout:
        await asyncio.sleep(poll_interval)
        elapsed += poll_interval
        
        try:
            session_info = await jellyfin.get_session_now_playing(session_id)
            if not session_info or not session_info.get("now_playing"):
                stop_count += 1
                logger.debug(f"Session {session_id} reported no active media (stop count: {stop_count})")
            else:
                stop_count = 0
                
            # If playback was detected stopped for 2 consecutive checks (~50 seconds of idle)
            if stop_count >= 2:
                logger.info(f"Playback ended on TV session {session_id}. Turning off TV gracefully...")
                break
                
        except Exception as e:
            logger.warning(f"Error while monitoring TV session {session_id}: {e}")
            
    # Buffer before turning off TV
    logger.info(f"Playback finished for job {job_db_id}. Executing graceful TV power-off...")
    await asyncio.sleep(10)
    
    turn_off_success = await adb.turn_off_tv()
    logger.info(f"TV turn-off sequence completed (success={turn_off_success})")
    
    # Mark job completed or reset to pending if recurring
    async with AsyncSessionLocal() as session:
        job_res = await session.execute(select(ScheduledJob).where(ScheduledJob.id == job_db_id))
        job = job_res.scalar_one_or_none()
        if job:
            next_status = "pending" if job.schedule_type != "once" else "completed"
            job.status = next_status
            await session.commit()


async def execute_playback(
    job_db_id: str,
    target_type: str = "media",
    target_id: str = "",
    auto_turn_off: bool = True,
) -> None:
    """Execute a scheduled playback job for single media or a playlist."""
    logger.info(f"Executing scheduled playback: job={job_db_id}, type={target_type}, target={target_id}")
    
    async with AsyncSessionLocal() as session:
        cfg = await get_active_settings(session)
        
        # Resolve item IDs
        item_ids = []
        if target_type == "playlist":
            result = await session.execute(
                select(PlaylistItem)
                .where(PlaylistItem.playlist_id == target_id)
                .order_by(PlaylistItem.order.asc())
            )
            items = result.scalars().all()
            item_ids = [item.jellyfin_item_id for item in items]
            if not item_ids:
                logger.error(f"Playlist {target_id} has no items to play")
                await session.execute(
                    update(ScheduledJob)
                    .where(ScheduledJob.id == job_db_id)
                    .values(status="failed", error_message="Playlist is empty")
                )
                await session.commit()
                return
        else:
            item_ids = [target_id]
            
    jellyfin = JellyfinClient(
        base_url=cfg["jellyfin_url"],
        api_key=cfg["jellyfin_api_key"],
        user_id=cfg["jellyfin_user_id"],
        tv_device_name=cfg["tv_device_name"],
    )
    adb = ADBClient(tv_ip=cfg["tv_ip"], adb_port=cfg["adb_port"])
    
    try:
        # Update status to running
        async with AsyncSessionLocal() as session:
            await session.execute(
                update(ScheduledJob)
                .where(ScheduledJob.id == job_db_id)
                .values(status="running")
            )
            await session.commit()
        
        # Try to find the TV session
        tv_session = await jellyfin.find_tv_session()
        
        if not tv_session:
            # Wake TV via ADB
            logger.info("TV session not found. Attempting automated ADB wake-up...")
            await adb.wake_and_prepare()
            
            # Poll for Jellyfin Android TV client to connect to server (up to 30 seconds)
            logger.info("Waiting up to 30 seconds for TV Jellyfin app to register...")
            for attempt in range(10):
                await asyncio.sleep(3)
                tv_session = await jellyfin.find_tv_session()
                if tv_session:
                    logger.info(f"TV session found on attempt {attempt+1}: {tv_session['id']} ({tv_session['device_name']})")
                    break
            
            if not tv_session:
                raise RuntimeError("Could not establish TV session after wake-up attempt")
        
        # Send play command
        logger.info(f"Starting playback of {len(item_ids)} item(s) on session {tv_session['id']} ({tv_session['device_name']})")
        success = await jellyfin.play_on_session(tv_session["id"], item_ids)
        if not success:
            raise RuntimeError("Jellyfin PlayNow command failed")
            
        logger.info(f"Playback started successfully for job {job_db_id}")
        
        # If auto-turn-off is enabled, spawn background monitor
        if auto_turn_off:
            total_seconds = await jellyfin.get_total_runtime_seconds(item_ids)
            asyncio.create_task(
                monitor_playback_and_turn_off(
                    session_id=tv_session["id"],
                    item_ids=item_ids,
                    total_seconds=total_seconds,
                    adb=adb,
                    jellyfin=jellyfin,
                    job_db_id=job_db_id,
                )
            )
        else:
            # Mark completed immediately if not monitoring (or reset to pending if recurring)
            async with AsyncSessionLocal() as session:
                job_res = await session.execute(select(ScheduledJob).where(ScheduledJob.id == job_db_id))
                job = job_res.scalar_one_or_none()
                if job:
                    next_status = "pending" if job.schedule_type != "once" else "completed"
                    job.status = next_status
                    await session.commit()
                
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Job {job_db_id} failed: {error_msg}")
        async with AsyncSessionLocal() as session:
            await session.execute(
                update(ScheduledJob)
                .where(ScheduledJob.id == job_db_id)
                .values(status="failed", error_message=error_msg)
            )
            await session.commit()


async def schedule_playback(
    job_db_id: str,
    target_type: str = "media",
    target_id: str = "",
    scheduled_time: datetime | None = None,
    schedule_type: str = "once",
    days_of_week: str | None = None,
    time_of_day: str | None = None,
    auto_turn_off: bool = True,
) -> str | None:
    """
    Schedule a playback job in APScheduler.
    Supports once, daily, weekly, and custom_days triggers with correct timezone awareness.
    Jobs fire precisely at the requested wall-clock second without any pre-offset.
    """
    global scheduler
    if scheduler is None:
        logger.error("Scheduler not initialized")
        return None
        
    try:
        app_tz = await get_configured_tz()
        trigger = None
        
        if schedule_type == "once":
            run_dt = scheduled_time
            if run_dt is not None:
                if run_dt.tzinfo is None:
                    run_dt = run_dt.replace(tzinfo=app_tz)
                else:
                    run_dt = run_dt.astimezone(app_tz)
            else:
                run_dt = datetime.now(app_tz)
            trigger = DateTrigger(run_time=run_dt)
        elif schedule_type == "daily":
            parts = (time_of_day or "20:00").split(":")
            h, m = int(parts[0]), int(parts[1]) if len(parts) > 1 else 0
            trigger = CronTrigger(hour=h, minute=m, second=0, timezone=app_tz)
        elif schedule_type in ("weekly", "custom_days"):
            parts = (time_of_day or "20:00").split(":")
            h, m = int(parts[0]), int(parts[1]) if len(parts) > 1 else 0
            dow = (days_of_week or "fri").lower()
            trigger = CronTrigger(day_of_week=dow, hour=h, minute=m, second=0, timezone=app_tz)
        else:
            trigger = DateTrigger(run_time=scheduled_time or datetime.now(app_tz))
            
        job_id = await scheduler.add_schedule(
            execute_playback,
            trigger=trigger,
            id=f"playback_{job_db_id}",
            kwargs={
                "job_db_id": job_db_id,
                "target_type": target_type,
                "target_id": target_id,
                "auto_turn_off": auto_turn_off,
            },
        )
        logger.info(f"Registered APScheduler job: {job_id} (type={schedule_type}, tz={app_tz})")
        return str(job_id)
        
    except Exception as e:
        logger.error(f"Failed to register schedule with APScheduler: {e}")
        return None


async def cancel_job(apscheduler_job_id: str) -> bool:
    """Cancel a scheduled job by its APScheduler ID."""
    global scheduler
    if scheduler is None:
        return False
    try:
        await scheduler.remove_schedule(apscheduler_job_id)
        logger.info(f"Cancelled APScheduler job {apscheduler_job_id}")
        return True
    except Exception as e:
        logger.warning(f"Failed to cancel job {apscheduler_job_id}: {e}")
        return False


async def start_scheduler() -> None:
    """Start the background scheduler engine and its background execution worker."""
    global scheduler
    scheduler = create_scheduler()
    await scheduler.__aenter__()
    await scheduler.start_in_background()
    logger.info("APScheduler started and running in background worker")


async def stop_scheduler() -> None:
    """Stop the background scheduler."""
    global scheduler
    if scheduler:
        try:
            await scheduler.stop()
        except Exception:
            pass
        await scheduler.__aexit__(None, None, None)
        scheduler = None
        logger.info("APScheduler stopped")
