from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings
import os

class Base(DeclarativeBase):
    pass

def get_engine():
    settings = get_settings()
    db_url = settings.database_url
    # Ensure data directory exists
    if "sqlite" in db_url:
        db_path = db_url.split("///")[-1]
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
    async with engine.begin() as conn:
        from app.models import ScheduledJob  # noqa
        await conn.run_sync(Base.metadata.create_all)
