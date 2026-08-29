import logging
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from sqlalchemy.orm import selectinload

from app.config import get_settings, get_active_settings, save_active_settings
from app.database import init_db, get_db
from app.models import ScheduledJob, Playlist, PlaylistItem
from app.schemas import (
    ScheduleCreate, ScheduleUpdate, ScheduleResponse, MediaSearchResult,
    SessionInfo, TVStatus, PlayNowRequest,
    SeasonResult, EpisodeResult, SettingsUpdate, SettingsResponse,
    ADBConnectRequest, ADBStatusResponse, JellyfinUser, JellyfinTestResponse,
    PlaylistCreate, PlaylistUpdate, PlaylistResponse, PlaylistItemCreate,
    PlaylistItemResponse, PlaylistReorderRequest
)
from app.jellyfin_client import JellyfinClient
from app.adb_client import ADBClient
from app import scheduler as sched_module

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    logger.info("Starting Media Scheduler...")
    await init_db()
    await sched_module.start_scheduler()
    yield
    logger.info("Shutting down Media Scheduler...")
    await sched_module.stop_scheduler()


app = FastAPI(title="Media Scheduler", version="1.2.0", lifespan=lifespan)

# --- Static Files ---
app.mount("/static", StaticFiles(directory="frontend"), name="static")


@app.get("/")
async def index():
    return FileResponse("frontend/index.html")


@app.get("/favicon.ico")
async def favicon():
    return FileResponse("frontend/logo.png", media_type="image/png")


# --- Helper: Get Configured Clients ---
async def get_clients(db: AsyncSession):
    cfg = await get_active_settings(db)
    jellyfin = JellyfinClient(
        base_url=cfg["jellyfin_url"],
        api_key=cfg["jellyfin_api_key"],
        user_id=cfg["jellyfin_user_id"],
        tv_device_name=cfg["tv_device_name"],
    )
    adb = ADBClient(tv_ip=cfg["tv_ip"], adb_port=cfg["adb_port"])
    return jellyfin, adb, cfg


# --- Settings & Device Setup Endpoints ---
@app.get("/api/settings", response_model=SettingsResponse)
async def get_settings_endpoint(db: AsyncSession = Depends(get_db)):
    """Fetch current app configuration and connectivity states."""
    jellyfin, adb, cfg = await get_clients(db)
    
    # Test Jellyfin connection
    jf_test = await jellyfin.test_connection()
    jf_users = [JellyfinUser(**u) for u in jf_test.get("users", [])] if jf_test.get("connected") else []
    
    # Test ADB status
    adb_status = await adb.get_detailed_status()
    
    return SettingsResponse(
        jellyfin_url=cfg["jellyfin_url"],
        jellyfin_api_key=cfg["jellyfin_api_key"],
        jellyfin_user_id=cfg["jellyfin_user_id"],
        tv_device_name=cfg["tv_device_name"],
        tv_ip=cfg["tv_ip"],
        adb_port=cfg["adb_port"],
        jellyfin_connected=jf_test.get("connected", False),
        jellyfin_users=jf_users,
        adb_state=adb_status["state"],
        adb_is_ready=adb_status["is_ready"],
        adb_message=adb_status["message"],
    )


@app.post("/api/settings", response_model=SettingsResponse)
async def update_settings_endpoint(data: SettingsUpdate, db: AsyncSession = Depends(get_db)):
    """Update settings in SQLite database and persistent config file."""
    updates = data.model_dump(exclude_unset=True)
    await save_active_settings(db, updates)
    return await get_settings_endpoint(db)


@app.get("/api/jellyfin/test", response_model=JellyfinTestResponse)
async def test_jellyfin(
    url: str | None = Query(None),
    api_key: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Test Jellyfin connection with current or supplied credentials."""
    cfg = await get_active_settings(db)
    target_url = url or cfg["jellyfin_url"]
    target_key = api_key if api_key is not None else cfg["jellyfin_api_key"]
    
    client = JellyfinClient(base_url=target_url, api_key=target_key)
    res = await client.test_connection()
    
    users_list = []
    if res.get("users"):
        users_list = [JellyfinUser(**u) for u in res["users"]]
        
    return JellyfinTestResponse(
        connected=res.get("connected", False),
        server_name=res.get("server_name"),
        version=res.get("version"),
        id=res.get("id"),
        users=users_list,
        error=res.get("error"),
    )


# --- TV & ADB Operations ---
@app.get("/api/tv/status", response_model=TVStatus)
async def tv_status(db: AsyncSession = Depends(get_db)):
    """Get live TV status from Jellyfin and ADB."""
    jellyfin, adb, cfg = await get_clients(db)
    
    tv_session = None
    try:
        tv_session = await jellyfin.find_tv_session()
    except Exception as e:
        logger.warning(f"Could not check Jellyfin sessions: {e}")
        
    adb_status = await adb.get_detailed_status()
    
    return TVStatus(
        session_found=tv_session is not None,
        session_id=tv_session["id"] if tv_session else None,
        device_name=tv_session["device_name"] if tv_session else None,
        is_active=tv_session["is_active"] if tv_session else False,
        adb_state=adb_status["state"],
        adb_reachable=adb_status["is_ready"],
        adb_message=adb_status["message"],
        configured_tv_ip=cfg["tv_ip"],
        configured_tv_name=cfg["tv_device_name"],
    )


@app.post("/api/tv/adb-connect", response_model=ADBStatusResponse)
async def adb_connect(data: ADBConnectRequest, db: AsyncSession = Depends(get_db)):
    """Trigger an explicit ADB connection attempt to TV."""
    _, adb, cfg = await get_clients(db)
    ip = data.ip or cfg["tv_ip"]
    port = data.port or cfg["adb_port"]
    
    if not ip:
        raise HTTPException(status_code=400, detail="TV IP address is required")
        
    # Save IP and port if changed
    if ip != cfg["tv_ip"] or port != cfg["adb_port"]:
        await save_active_settings(db, {"tv_ip": ip, "adb_port": port})
        
    res = await adb.connect(ip, port)
    return ADBStatusResponse(**res)


@app.post("/api/tv/test-wake")
async def test_wake_tv(db: AsyncSession = Depends(get_db)):
    """Test screen wake-up on TV."""
    _, adb, _ = await get_clients(db)
    success = await adb.wake_screen()
    if not success:
        status = await adb.get_detailed_status()
        raise HTTPException(status_code=502, detail=f"Wake command failed: {status['message']}")
    return {"message": "Wake command sent to TV successfully"}


@app.post("/api/tv/test-sleep")
async def test_sleep_tv(db: AsyncSession = Depends(get_db)):
    """Test graceful sleep / turn-off command on TV."""
    _, adb, _ = await get_clients(db)
    success = await adb.turn_off_tv()
    if not success:
        raise HTTPException(status_code=502, detail="TV sleep command failed")
    return {"message": "Sleep / turn-off command sent to TV successfully"}


@app.post("/api/tv/test-launch")
async def test_launch_tv(db: AsyncSession = Depends(get_db)):
    """Test launching Jellyfin on TV."""
    _, adb, _ = await get_clients(db)
    success = await adb.launch_jellyfin()
    if not success:
        status = await adb.get_detailed_status()
        raise HTTPException(status_code=502, detail=f"Launch command failed: {status['message']}")
    return {"message": "Jellyfin launch command sent to TV successfully"}


# --- Media Search & Library Browsing ---
@app.get("/api/search", response_model=list[MediaSearchResult])
@app.get("/api/media", response_model=list[MediaSearchResult])
async def search_media(
    q: str | None = Query(None, description="Optional search term"),
    type: str = Query("Movie,Series", description="Comma-separated item types"),
    category: str | None = Query(None, description="Category filter (e.g. 'anime')"),
    genres: str | None = Query(None, description="Genre filter"),
    db: AsyncSession = Depends(get_db),
):
    """Search or browse Jellyfin library."""
    try:
        jellyfin, _, _ = await get_clients(db)
        results = await jellyfin.search_media(q, media_type=type, category=category, genres=genres)
        return results
    except Exception as e:
        logger.error(f"Media fetch failed: {e}")
        raise HTTPException(status_code=502, detail=f"Jellyfin library search failed: {e}")


@app.get("/api/series/{series_id}/seasons", response_model=list[SeasonResult])
async def get_seasons(series_id: str, db: AsyncSession = Depends(get_db)):
    """Get seasons for a TV series."""
    try:
        jellyfin, _, _ = await get_clients(db)
        return await jellyfin.get_seasons(series_id)
    except Exception as e:
        logger.error(f"Failed to get seasons: {e}")
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/series/{series_id}/episodes", response_model=list[EpisodeResult])
async def get_episodes(series_id: str, season_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    """Get episodes for a season."""
    try:
        jellyfin, _, _ = await get_clients(db)
        return await jellyfin.get_episodes(series_id, season_id)
    except Exception as e:
        logger.error(f"Failed to get episodes: {e}")
        raise HTTPException(status_code=502, detail=str(e))


# --- Playlists API ---
def _format_playlist(pl: Playlist) -> PlaylistResponse:
    items = [
        PlaylistItemResponse(
            id=item.id,
            playlist_id=item.playlist_id,
            jellyfin_item_id=item.jellyfin_item_id,
            name=item.name,
            item_type=item.item_type,
            image_tag=item.image_tag,
            runtime_minutes=item.runtime_minutes,
            order=item.order,
            created_at=item.created_at,
        )
        for item in pl.items
    ]
    total_mins = sum(item.runtime_minutes or 0 for item in items)
    return PlaylistResponse(
        id=pl.id,
        name=pl.name,
        description=pl.description,
        created_at=pl.created_at,
        items_count=len(items),
        total_runtime_minutes=total_mins,
        items=items,
    )


@app.get("/api/playlists", response_model=list[PlaylistResponse])
async def list_playlists(db: AsyncSession = Depends(get_db)):
    """List all custom playlists with items."""
    result = await db.execute(
        select(Playlist)
        .options(selectinload(Playlist.items))
        .order_by(Playlist.created_at.desc())
    )
    playlists = result.scalars().all()
    return [_format_playlist(pl) for pl in playlists]


@app.post("/api/playlists", response_model=PlaylistResponse, status_code=201)
async def create_playlist(data: PlaylistCreate, db: AsyncSession = Depends(get_db)):
    """Create a new empty playlist."""
    pl = Playlist(name=data.name.strip(), description=data.description)
    db.add(pl)
    await db.commit()
    await db.refresh(pl, ["items"])
    return _format_playlist(pl)


@app.get("/api/playlists/{playlist_id}", response_model=PlaylistResponse)
async def get_playlist(playlist_id: str, db: AsyncSession = Depends(get_db)):
    """Get playlist details and items."""
    result = await db.execute(
        select(Playlist)
        .where(Playlist.id == playlist_id)
        .options(selectinload(Playlist.items))
    )
    pl = result.scalar_one_or_none()
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return _format_playlist(pl)


@app.put("/api/playlists/{playlist_id}", response_model=PlaylistResponse)
async def update_playlist(playlist_id: str, data: PlaylistUpdate, db: AsyncSession = Depends(get_db)):
    """Update playlist title or description."""
    result = await db.execute(
        select(Playlist)
        .where(Playlist.id == playlist_id)
        .options(selectinload(Playlist.items))
    )
    pl = result.scalar_one_or_none()
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
        
    if data.name is not None:
        pl.name = data.name.strip()
    if data.description is not None:
        pl.description = data.description
        
    await db.commit()
    await db.refresh(pl, ["items"])
    return _format_playlist(pl)


@app.delete("/api/playlists/{playlist_id}", status_code=204)
async def delete_playlist(playlist_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a playlist."""
    result = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    pl = result.scalar_one_or_none()
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
        
    await db.execute(delete(Playlist).where(Playlist.id == playlist_id))
    await db.commit()


@app.post("/api/playlists/{playlist_id}/items", response_model=PlaylistResponse)
async def add_item_to_playlist(playlist_id: str, data: PlaylistItemCreate, db: AsyncSession = Depends(get_db)):
    """Add a movie or episode to a playlist."""
    result = await db.execute(
        select(Playlist)
        .where(Playlist.id == playlist_id)
        .options(selectinload(Playlist.items))
    )
    pl = result.scalar_one_or_none()
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
        
    next_order = len(pl.items)
    item = PlaylistItem(
        playlist_id=playlist_id,
        jellyfin_item_id=data.jellyfin_item_id,
        name=data.name,
        item_type=data.item_type,
        image_tag=data.image_tag,
        runtime_minutes=data.runtime_minutes,
        order=next_order,
    )
    db.add(item)
    await db.commit()
    await db.refresh(pl, ["items"])
    return _format_playlist(pl)


@app.delete("/api/playlists/{playlist_id}/items/{item_id}", response_model=PlaylistResponse)
async def remove_item_from_playlist(playlist_id: str, item_id: str, db: AsyncSession = Depends(get_db)):
    """Remove an item from a playlist."""
    result = await db.execute(
        select(Playlist)
        .where(Playlist.id == playlist_id)
        .options(selectinload(Playlist.items))
    )
    pl = result.scalar_one_or_none()
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
        
    await db.execute(
        delete(PlaylistItem).where(
            PlaylistItem.id == item_id,
            PlaylistItem.playlist_id == playlist_id,
        )
    )
    await db.commit()
    await db.refresh(pl, ["items"])
    
    # Re-normalize order
    for idx, item in enumerate(sorted(pl.items, key=lambda x: x.order)):
        item.order = idx
    await db.commit()
    await db.refresh(pl, ["items"])
    return _format_playlist(pl)


@app.post("/api/playlists/{playlist_id}/reorder", response_model=PlaylistResponse)
async def reorder_playlist_items(playlist_id: str, data: PlaylistReorderRequest, db: AsyncSession = Depends(get_db)):
    """Reorder items in a playlist."""
    result = await db.execute(
        select(Playlist)
        .where(Playlist.id == playlist_id)
        .options(selectinload(Playlist.items))
    )
    pl = result.scalar_one_or_none()
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
        
    item_map = {item.id: item for item in pl.items}
    for order_idx, item_id in enumerate(data.item_ids):
        if item_id in item_map:
            item_map[item_id].order = order_idx
            
    await db.commit()
    await db.refresh(pl, ["items"])
    return _format_playlist(pl)


@app.post("/api/playlists/{playlist_id}/play-now", status_code=200)
async def play_playlist_now(playlist_id: str, db: AsyncSession = Depends(get_db)):
    """Instantly play an entire playlist on the TV."""
    result = await db.execute(
        select(Playlist)
        .where(Playlist.id == playlist_id)
        .options(selectinload(Playlist.items))
    )
    pl = result.scalar_one_or_none()
    if not pl or not pl.items:
        raise HTTPException(status_code=400, detail="Playlist is empty or does not exist")
        
    jellyfin, adb, _ = await get_clients(db)
    tv_session = await jellyfin.find_tv_session()
    if not tv_session:
        logger.info("TV session not found. Waking TV via ADB...")
        await adb.wake_and_prepare()
        await asyncio.sleep(10)
        tv_session = await jellyfin.find_tv_session()
        if not tv_session:
            raise HTTPException(status_code=503, detail="Could not connect to TV Jellyfin session")
            
    item_ids = [item.jellyfin_item_id for item in sorted(pl.items, key=lambda x: x.order)]
    success = await jellyfin.play_on_session(tv_session["id"], item_ids)
    if not success:
        raise HTTPException(status_code=502, detail="Failed to start playlist playback")
        
    # Launch background monitor to turn off TV after playlist finishes
    total_seconds = await jellyfin.get_total_runtime_seconds(item_ids)
    asyncio.create_task(
        sched_module.monitor_playback_and_turn_off(
            session_id=tv_session["id"],
            item_ids=item_ids,
            total_seconds=total_seconds,
            adb=adb,
            jellyfin=jellyfin,
            job_db_id=f"instant_pl_{playlist_id}",
        )
    )
    return {"message": f"Playlist '{pl.name}' started on TV"}


# --- Scheduling Endpoints ---
@app.post("/api/schedule", response_model=ScheduleResponse, status_code=201)
async def create_schedule(data: ScheduleCreate, db: AsyncSession = Depends(get_db)):
    """Create a new scheduled playback job (one-time or recurring)."""
    cfg = await get_active_settings(db)
    app_tz = ZoneInfo(cfg.get("app_timezone", "Asia/Jerusalem"))
    
    # Calculate scheduled_time for DB record
    scheduled_dt = data.scheduled_time
    if not scheduled_dt:
        if data.schedule_type != "once" and data.time_of_day:
            parts = data.time_of_day.split(":")
            now = datetime.now(app_tz)
            scheduled_dt = now.replace(
                hour=int(parts[0]), minute=int(parts[1]) if len(parts) > 1 else 0, second=0, microsecond=0
            ).replace(tzinfo=None)
        else:
            now = datetime.now(app_tz) + timedelta(minutes=5)
            scheduled_dt = now.replace(tzinfo=None)
    else:
        if scheduled_dt.tzinfo is not None:
            scheduled_dt = scheduled_dt.astimezone(app_tz).replace(tzinfo=None)
            
    job = ScheduledJob(
        name=data.name,
        target_type=data.target_type,
        jellyfin_item_id=data.jellyfin_item_id,
        item_type=data.item_type,
        image_tag=data.image_tag,
        scheduled_time=scheduled_dt,
        schedule_type=data.schedule_type,
        days_of_week=data.days_of_week,
        time_of_day=data.time_of_day,
        auto_turn_off=data.auto_turn_off,
        status="pending",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    
    # Schedule with APScheduler
    ap_job_id = await sched_module.schedule_playback(
        job_db_id=job.id,
        target_type=data.target_type,
        target_id=data.jellyfin_item_id,
        scheduled_time=scheduled_dt,
        schedule_type=data.schedule_type,
        days_of_week=data.days_of_week,
        time_of_day=data.time_of_day,
        auto_turn_off=data.auto_turn_off,
    )
    
    if ap_job_id:
        job.apscheduler_job_id = ap_job_id
        await db.commit()
        await db.refresh(job)
    else:
        job.status = "failed"
        job.error_message = "Failed to register with scheduler"
        await db.commit()
        await db.refresh(job)
        
    return job


@app.get("/api/schedule", response_model=list[ScheduleResponse])
async def list_schedules(db: AsyncSession = Depends(get_db)):
    """List all scheduled jobs."""
    result = await db.execute(
        select(ScheduledJob).order_by(ScheduledJob.scheduled_time.asc())
    )
    return result.scalars().all()


@app.put("/api/schedule/{job_id}", response_model=ScheduleResponse)
async def update_schedule(job_id: str, data: ScheduleUpdate, db: AsyncSession = Depends(get_db)):
    """Update and reschedule an existing job."""
    result = await db.execute(select(ScheduledJob).where(ScheduledJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Cancel previous APScheduler job
    if job.apscheduler_job_id:
        await sched_module.cancel_job(job.apscheduler_job_id)

    # Apply updates
    if data.name is not None:
        job.name = data.name.strip()
    if data.schedule_type is not None:
        job.schedule_type = data.schedule_type
    if data.days_of_week is not None:
        job.days_of_week = data.days_of_week
    if data.time_of_day is not None:
        job.time_of_day = data.time_of_day
    if data.auto_turn_off is not None:
        job.auto_turn_off = data.auto_turn_off

    # Calculate scheduled time
    cfg = await get_active_settings(db)
    app_tz = ZoneInfo(cfg.get("app_timezone", "Asia/Jerusalem"))
    
    if data.scheduled_time is not None:
        sched_dt = data.scheduled_time
        if sched_dt.tzinfo is not None:
            sched_dt = sched_dt.astimezone(app_tz).replace(tzinfo=None)
        job.scheduled_time = sched_dt
    elif job.schedule_type != "once" and job.time_of_day:
        parts = job.time_of_day.split(":")
        now = datetime.now(app_tz)
        job.scheduled_time = now.replace(
            hour=int(parts[0]), minute=int(parts[1]) if len(parts) > 1 else 0, second=0, microsecond=0
        ).replace(tzinfo=None)

    job.status = "pending"
    job.error_message = None

    # Reschedule with APScheduler
    ap_job_id = await sched_module.schedule_playback(
        job_db_id=job.id,
        target_type=job.target_type,
        target_id=job.jellyfin_item_id,
        scheduled_time=job.scheduled_time,
        schedule_type=job.schedule_type,
        days_of_week=job.days_of_week,
        time_of_day=job.time_of_day,
        auto_turn_off=job.auto_turn_off,
    )

    if ap_job_id:
        job.apscheduler_job_id = ap_job_id
    else:
        job.status = "failed"
        job.error_message = "Failed to register with scheduler"

    await db.commit()
    await db.refresh(job)
    return job


@app.delete("/api/schedule/{job_id}", status_code=204)
async def delete_schedule(job_id: str, db: AsyncSession = Depends(get_db)):
    """Cancel and delete a scheduled job."""
    result = await db.execute(select(ScheduledJob).where(ScheduledJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    if job.apscheduler_job_id and job.status in ("pending", "running"):
        await sched_module.cancel_job(job.apscheduler_job_id)
        
    await db.execute(delete(ScheduledJob).where(ScheduledJob.id == job_id))
    await db.commit()


# --- Play Now (Immediate) ---
@app.post("/api/play-now", status_code=200)
async def play_now(data: PlayNowRequest, db: AsyncSession = Depends(get_db)):
    """Immediately play items on the TV."""
    jellyfin, adb, cfg = await get_clients(db)
    
    if cfg.get("tv_ip"):
        logger.info(f"Ensuring TV screen is powered ON and Jellyfin is running at {cfg['tv_ip']}...")
        try:
            await adb.ensure_awake_and_ready()
        except Exception as e:
            logger.warning(f"ADB wake error (continuing playback): {e}")

    tv_session = await jellyfin.find_tv_session()
    if not tv_session:
        logger.info("Polling for Jellyfin TV session to become available...")
        for _ in range(8):
            await asyncio.sleep(2.5)
            tv_session = await jellyfin.find_tv_session()
            if tv_session:
                break
        if not tv_session:
            raise HTTPException(
                status_code=503,
                detail="TV session not found after waking TV."
            )
            
    success = await jellyfin.play_on_session(tv_session["id"], data.item_ids)
    if not success:
        raise HTTPException(status_code=502, detail="Jellyfin play command failed")
        
    if data.auto_turn_off:
        total_seconds = await jellyfin.get_total_runtime_seconds(data.item_ids)
        asyncio.create_task(
            sched_module.monitor_playback_and_turn_off(
                session_id=tv_session["id"],
                item_ids=data.item_ids,
                total_seconds=total_seconds,
                adb=adb,
                jellyfin=jellyfin,
                job_db_id=f"play_now_{datetime.utcnow().timestamp()}",
            )
        )
    return {"message": f"Playback started on {tv_session.get('device_name', 'TV')}"}


# --- Jellyfin Image Proxy ---
@app.get("/api/image/{item_id}")
async def get_image(item_id: str, tag: str | None = None, db: AsyncSession = Depends(get_db)):
    """Proxy Jellyfin item images to avoid CORS and auth token exposure."""
    import httpx
    jellyfin, _, _ = await get_clients(db)
    url = jellyfin.get_image_url(item_id, image_tag=tag)
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            resp = await http.get(url, headers=jellyfin.headers)
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code)
            return Response(
                content=resp.content,
                media_type=resp.headers.get("content-type", "image/jpeg"),
                headers={"Cache-Control": "public, max-age=86400"},
            )
    except Exception as e:
        raise HTTPException(status_code=404, detail="Image not found")
