import logging
import asyncio
from datetime import datetime, timedelta
from apscheduler import AsyncScheduler
from apscheduler.datastores.sqlalchemy import SQLAlchemyDataStore
from apscheduler.triggers.date import DateTrigger
from sqlalchemy import update

from app.config import get_settings, get_active_settings
from app.database import AsyncSessionLocal
from app.models import ScheduledJob
from app.jellyfin_client import JellyfinClient
from app.adb_client import ADBClient

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler: AsyncScheduler | None = None


def create_scheduler() -> AsyncScheduler:
    """Create the APScheduler instance with persistent storage."""
    # Use a separate SQLite file for APScheduler's internal data
    data_store = SQLAlchemyDataStore(engine_or_url="sqlite+aiosqlite:///data/apscheduler.db")
    return AsyncScheduler(data_store=data_store)


async def execute_playback(job_db_id: str, item_ids: list[str]) -> None:
    """Execute a scheduled playback job.
    
    This is the function that APScheduler calls at the scheduled time.
    It handles TV wake-up, session discovery, and playback initiation.
    """
    logger.info(f"Executing playback job {job_db_id} with items {item_ids}")
    
    async with AsyncSessionLocal() as session:
        cfg = await get_active_settings(session)
        
    jellyfin = JellyfinClient(
        base_url=cfg["jellyfin_url"],
        api_key=cfg["jellyfin_api_key"],
        user_id=cfg["jellyfin_user_id"],
        tv_device_name=cfg["tv_device_name"],
    )
    adb = ADBClient(tv_ip=cfg["tv_ip"], adb_port=cfg["adb_port"])
    error_msg = None
    
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
            # No active session — attempt ADB wake-up
            logger.info("No TV session found. Attempting ADB wake-up...")
            wake_success = await adb.wake_and_prepare()
            if not wake_success:
                logger.warning("ADB wake-up reported failure, but will still try to find session...")
            
            # Wait for Jellyfin client to register
            logger.info("Waiting 30 seconds for Jellyfin to register the TV session...")
            await asyncio.sleep(30)
            
            tv_session = await jellyfin.find_tv_session()
            if not tv_session:
                raise RuntimeError("Could not find TV session after wake-up attempt")
        
        # Send play command
        logger.info(f"Playing on session {tv_session['id']} ({tv_session['device_name']})")
        success = await jellyfin.play_on_session(tv_session["id"], item_ids)
        
        if not success:
            raise RuntimeError("Play command returned failure")
        
        # Mark as completed
        async with AsyncSessionLocal() as session:
            await session.execute(
                update(ScheduledJob)
                .where(ScheduledJob.id == job_db_id)
                .values(status="completed")
            )
            await session.commit()
        
        logger.info(f"Job {job_db_id} completed successfully")
    
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
    item_ids: list[str],
    scheduled_time: datetime,
) -> str | None:
    """Schedule a playback job.
    
    Returns the APScheduler job ID, or None if scheduling failed.
    """
    global scheduler
    if scheduler is None:
        logger.error("Scheduler not initialized")
        return None
    
    try:
        job_id = await scheduler.add_schedule(
            execute_playback,
            trigger=DateTrigger(run_time=scheduled_time),
            id=f"playback_{job_db_id}",
            kwargs={"job_db_id": job_db_id, "item_ids": item_ids},
        )
        logger.info(f"Scheduled job {job_db_id} for {scheduled_time} (APScheduler ID: {job_id})")
        return str(job_id)
    except Exception as e:
        logger.error(f"Failed to schedule job: {e}")
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
    """Start the background scheduler."""
    global scheduler
    scheduler = create_scheduler()
    await scheduler.__aenter__()
    logger.info("APScheduler started")


async def stop_scheduler() -> None:
    """Stop the background scheduler."""
    global scheduler
    if scheduler:
        await scheduler.__aexit__(None, None, None)
        scheduler = None
        logger.info("APScheduler stopped")
