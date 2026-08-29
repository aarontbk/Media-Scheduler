import logging
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update

from app.config import get_settings, get_active_settings, save_active_settings
from app.database import init_db, get_db
from app.models import ScheduledJob
from app.schemas import (
    ScheduleCreate, ScheduleResponse, MediaSearchResult,
    SessionInfo, TVStatus, PlayNowRequest,
    SeasonResult, EpisodeResult, SettingsUpdate, SettingsResponse,
    ADBConnectRequest, ADBStatusResponse, JellyfinUser, JellyfinTestResponse
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


app = FastAPI(title="Media Scheduler", version="1.1.0", lifespan=lifespan)

# --- Static Files ---
app.mount("/static", StaticFiles(directory="frontend"), name="static")


@app.get("/")
async def index():
    return FileResponse("frontend/index.html")


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
    """Update settings in database."""
    updates = data.model_dump(exclude_unset=True)
    await save_active_settings(db, updates)
    return await get_settings_endpoint(db)


@app.get("/api/jellyfin/test", response_model=JellyfinTestResponse)
async def test_jellyfin(
    url: str | None = None,
    api_key: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Test connection to Jellyfin server."""
    cfg = await get_active_settings(db)
    test_url = url or cfg["jellyfin_url"]
    test_key = api_key or cfg["jellyfin_api_key"]
    
    client = JellyfinClient(base_url=test_url, api_key=test_key)
    res = await client.test_connection()
    return JellyfinTestResponse(
        connected=res.get("connected", False),
        server_name=res.get("server_name"),
        version=res.get("version"),
        id=res.get("id"),
        users=[JellyfinUser(**u) for u in res.get("users", [])],
        error=res.get("error"),
    )


@app.get("/api/jellyfin/users", response_model=list[JellyfinUser])
async def list_jellyfin_users(db: AsyncSession = Depends(get_db)):
    """List users from Jellyfin."""
    jellyfin, _, _ = await get_clients(db)
    users = await jellyfin.list_users()
    return [JellyfinUser(**u) for u in users]


# --- TV & ADB Connection Endpoints ---
@app.get("/api/tv/status", response_model=TVStatus)
async def tv_status(db: AsyncSession = Depends(get_db)):
    """Check comprehensive TV connection status (Jellyfin Session + Network ADB)."""
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
    """Connect to TV via ADB and return detailed diagnostic status."""
    _, adb, cfg = await get_clients(db)
    ip = (data.ip or cfg["tv_ip"]).strip()
    port = data.port or cfg["adb_port"]
    
    if not ip:
        raise HTTPException(status_code=400, detail="TV IP address is required")
        
    # If IP is supplied and different from DB, save it
    if data.ip and data.ip != cfg["tv_ip"]:
        await save_active_settings(db, {"tv_ip": data.ip, "adb_port": port})
        
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


@app.post("/api/tv/test-launch")
async def test_launch_tv(db: AsyncSession = Depends(get_db)):
    """Test launching Jellyfin on TV."""
    _, adb, _ = await get_clients(db)
    success = await adb.launch_jellyfin()
    if not success:
        status = await adb.get_detailed_status()
        raise HTTPException(status_code=502, detail=f"Launch command failed: {status['message']}")
    return {"message": "Jellyfin launch command sent to TV successfully"}


@app.post("/api/tv/adb-disconnect")
async def adb_disconnect(db: AsyncSession = Depends(get_db)):
    """Disconnect ADB from TV."""
    _, adb, _ = await get_clients(db)
    await adb.disconnect()
    return {"message": "Disconnected"}


# --- Media Search & Library Browsing ---
@app.get("/api/search", response_model=list[MediaSearchResult])
@app.get("/api/media", response_model=list[MediaSearchResult])
async def search_media(
    q: str | None = Query(None, description="Optional search term; if omitted, returns library items"),
    type: str = Query("Movie,Series", description="Comma-separated item types (Movie, Series)"),
    db: AsyncSession = Depends(get_db),
):
    """Search or browse Jellyfin library."""
    try:
        jellyfin, _, _ = await get_clients(db)
        results = await jellyfin.search_media(q, media_type=type)
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


# --- Sessions ---
@app.get("/api/sessions", response_model=list[SessionInfo])
async def get_sessions(db: AsyncSession = Depends(get_db)):
    """List active Jellyfin sessions."""
    try:
        jellyfin, _, _ = await get_clients(db)
        return await jellyfin.get_sessions()
    except Exception as e:
        logger.error(f"Failed to get sessions: {e}")
        raise HTTPException(status_code=502, detail=str(e))


# --- Scheduling ---
@app.post("/api/schedule", response_model=ScheduleResponse, status_code=201)
async def create_schedule(data: ScheduleCreate, db: AsyncSession = Depends(get_db)):
    """Create a new scheduled playback job."""
    job = ScheduledJob(
        name=data.name,
        jellyfin_item_id=data.jellyfin_item_id,
        item_type=data.item_type,
        image_tag=data.image_tag,
        scheduled_time=data.scheduled_time,
        status="pending",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    
    # Schedule with APScheduler
    ap_job_id = await sched_module.schedule_playback(
        job_db_id=job.id,
        item_ids=[data.jellyfin_item_id],
        scheduled_time=data.scheduled_time,
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
    """List all scheduled jobs, ordered by scheduled time."""
    result = await db.execute(
        select(ScheduledJob).order_by(ScheduledJob.scheduled_time.asc())
    )
    return result.scalars().all()


@app.delete("/api/schedule/{job_id}", status_code=204)
async def delete_schedule(job_id: str, db: AsyncSession = Depends(get_db)):
    """Cancel and delete a scheduled job."""
    result = await db.execute(select(ScheduledJob).where(ScheduledJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.apscheduler_job_id and job.status == "pending":
        await sched_module.cancel_job(job.apscheduler_job_id)
    
    await db.execute(delete(ScheduledJob).where(ScheduledJob.id == job_id))
    await db.commit()


# --- Play Now (Immediate) ---
@app.post("/api/play-now", status_code=200)
async def play_now(data: PlayNowRequest, db: AsyncSession = Depends(get_db)):
    """Immediately play items on the TV (for instant testing or playback)."""
    jellyfin, adb, _ = await get_clients(db)
    
    tv_session = await jellyfin.find_tv_session()
    if not tv_session:
        # Try wake-up sequence
        logger.info("TV session not found, initiating ADB wake-up...")
        await adb.wake_and_prepare()
        await asyncio.sleep(10)  # Wait for Jellyfin to launch
        
        # Retry finding session
        tv_session = await jellyfin.find_tv_session()
        if not tv_session:
            raise HTTPException(
                status_code=503,
                detail="TV session not found after wake-up attempt. Make sure Jellyfin app is open and signed in on the TV."
            )
    
    success = await jellyfin.play_on_session(tv_session["id"], data.item_ids)
    if not success:
        raise HTTPException(status_code=502, detail="Jellyfin play command failed")
    
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
