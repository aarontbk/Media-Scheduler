import logging
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update

from app.config import get_settings
from app.database import init_db, get_db
from app.models import ScheduledJob
from app.schemas import (
    ScheduleCreate, ScheduleResponse, MediaSearchResult,
    SessionInfo, TVStatus, PlayNowRequest,
    SeasonResult, EpisodeResult,
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


app = FastAPI(title="Media Scheduler", version="1.0.0", lifespan=lifespan)

# --- Static Files ---
app.mount("/static", StaticFiles(directory="frontend"), name="static")


@app.get("/")
async def index():
    return FileResponse("frontend/index.html")


# --- Media Search ---
@app.get("/api/search", response_model=list[MediaSearchResult])
async def search_media(
    q: str = Query(..., min_length=1),
    type: str = Query("Movie,Series", description="Comma-separated item types"),
):
    """Search Jellyfin library."""
    try:
        client = JellyfinClient()
        results = await client.search_media(q, media_type=type)
        return results
    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=502, detail=f"Jellyfin search failed: {e}")


@app.get("/api/series/{series_id}/seasons", response_model=list[SeasonResult])
async def get_seasons(series_id: str):
    """Get seasons for a TV series."""
    try:
        client = JellyfinClient()
        return await client.get_seasons(series_id)
    except Exception as e:
        logger.error(f"Failed to get seasons: {e}")
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/series/{series_id}/episodes", response_model=list[EpisodeResult])
async def get_episodes(series_id: str, season_id: str = Query(...)):
    """Get episodes for a season."""
    try:
        client = JellyfinClient()
        return await client.get_episodes(series_id, season_id)
    except Exception as e:
        logger.error(f"Failed to get episodes: {e}")
        raise HTTPException(status_code=502, detail=str(e))


# --- Sessions ---
@app.get("/api/sessions", response_model=list[SessionInfo])
async def get_sessions():
    """List active Jellyfin sessions."""
    try:
        client = JellyfinClient()
        return await client.get_sessions()
    except Exception as e:
        logger.error(f"Failed to get sessions: {e}")
        raise HTTPException(status_code=502, detail=str(e))


# --- TV Status ---
@app.get("/api/tv/status", response_model=TVStatus)
async def tv_status():
    """Check TV connection status."""
    jellyfin = JellyfinClient()
    adb = ADBClient()
    
    tv_session = None
    try:
        tv_session = await jellyfin.find_tv_session()
    except Exception as e:
        logger.warning(f"Could not check Jellyfin sessions: {e}")
    
    adb_reachable = False
    try:
        adb_reachable = await adb.is_reachable()
    except Exception as e:
        logger.warning(f"ADB reachability check failed: {e}")
    
    return TVStatus(
        session_found=tv_session is not None,
        session_id=tv_session["id"] if tv_session else None,
        device_name=tv_session["device_name"] if tv_session else None,
        is_active=tv_session["is_active"] if tv_session else False,
        adb_reachable=adb_reachable,
    )


# --- Scheduling ---
@app.post("/api/schedule", response_model=ScheduleResponse, status_code=201)
async def create_schedule(data: ScheduleCreate, db: AsyncSession = Depends(get_db)):
    """Create a new scheduled playback job."""
    # Create DB record
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
        # Scheduling failed — mark as failed
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
    
    # Cancel in APScheduler if still pending
    if job.apscheduler_job_id and job.status == "pending":
        await sched_module.cancel_job(job.apscheduler_job_id)
    
    await db.execute(delete(ScheduledJob).where(ScheduledJob.id == job_id))
    await db.commit()


# --- Play Now ---
@app.post("/api/play-now", status_code=204)
async def play_now(data: PlayNowRequest):
    """Immediately play items on the TV (for testing)."""
    jellyfin = JellyfinClient()
    adb = ADBClient()
    
    tv_session = await jellyfin.find_tv_session()
    if not tv_session:
        # Try wake-up
        await adb.wake_and_prepare()
        await asyncio.sleep(30)
        tv_session = await jellyfin.find_tv_session()
        if not tv_session:
            raise HTTPException(status_code=503, detail="TV session not found")
    
    success = await jellyfin.play_on_session(tv_session["id"], data.item_ids)
    if not success:
        raise HTTPException(status_code=502, detail="Play command failed")


# --- Jellyfin Image Proxy ---
@app.get("/api/image/{item_id}")
async def get_image(item_id: str, tag: str | None = None):
    """Proxy Jellyfin item images to avoid CORS issues."""
    import httpx
    client = JellyfinClient()
    url = client.get_image_url(item_id, image_tag=tag)
    async with httpx.AsyncClient(timeout=10) as http:
        resp = await http.get(url, headers=client.headers)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code)
        return Response(
            content=resp.content,
            media_type=resp.headers.get("content-type", "image/jpeg"),
        )
