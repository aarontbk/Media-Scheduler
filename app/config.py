from pydantic_settings import BaseSettings
from functools import lru_cache
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

class Settings(BaseSettings):
    # Jellyfin
    jellyfin_url: str = "http://localhost:8096"
    jellyfin_api_key: str = ""
    jellyfin_user_id: str = ""
    
    # TV Target
    tv_device_name: str = "Living Room TV"
    tv_ip: str = ""
    adb_port: int = 5555
    
    # Database
    database_url: str = "sqlite+aiosqlite:///data/scheduler.db"
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8081
    
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

@lru_cache
def get_settings() -> Settings:
    return Settings()

async def get_active_settings(db: AsyncSession | None = None) -> dict:
    """Get merged configuration from SQLite system_settings table with .env defaults."""
    env = get_settings()
    config = {
        "jellyfin_url": env.jellyfin_url,
        "jellyfin_api_key": env.jellyfin_api_key,
        "jellyfin_user_id": env.jellyfin_user_id,
        "tv_device_name": env.tv_device_name,
        "tv_ip": env.tv_ip,
        "adb_port": env.adb_port,
    }
    
    if db is not None:
        try:
            from app.models import SystemSetting
            res = await db.execute(select(SystemSetting))
            rows = res.scalars().all()
            for row in rows:
                if row.key in config:
                    if row.key == "adb_port":
                        try:
                            config[row.key] = int(row.value)
                        except (ValueError, TypeError):
                            pass
                    else:
                        config[row.key] = row.value
        except Exception:
            pass
            
    return config

async def save_active_settings(db: AsyncSession, updates: dict) -> dict:
    """Save updated configuration to SQLite system_settings table."""
    from app.models import SystemSetting
    
    for key, value in updates.items():
        if value is None:
            continue
        str_val = str(value).strip()
        row = await db.get(SystemSetting, key)
        if row:
            row.value = str_val
        else:
            db.add(SystemSetting(key=key, value=str_val))
            
    await db.commit()
    return await get_active_settings(db)

