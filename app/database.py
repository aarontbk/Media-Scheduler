from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings
import os
import re

class Base(DeclarativeBase):
    pass

def get_engine():
    settings = get_settings()
    db_url = settings.database_url
    
    # In container with /data mount, ensure absolute path so sqlite uses /data/scheduler.db
    if os.path.exists("/data") and "///data/" in db_url:
        db_url = db_url.replace("///data/", "////data/")
        
    # Extract file path and ensure directory exists
    if "sqlite" in db_url:
        match = re.search(r"sqlite(?:\+aiosqlite)?:///(.+)$", db_url)
        if match:
            db_path = match.group(1)
            os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
            
    return create_async_engine(db_url, echo=False)

engine = get_engine()
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def init_db():
    from app.models import ScheduledJob, SystemSetting, Playlist, PlaylistItem  # noqa
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
