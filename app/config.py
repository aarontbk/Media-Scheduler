import os
import json
import logging
from pydantic_settings import BaseSettings
from functools import lru_cache
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

CONFIG_JSON_PATH = "/data/config.json" if os.path.exists("/data") else "data/config.json"

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

def _read_json_config() -> dict:
    """Read persistent JSON config if it exists."""
    for path in [CONFIG_JSON_PATH, "data/config.json", "/data/config.json"]:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Error reading {path}: {e}")
    return {}

def _write_json_config(config_data: dict) -> None:
    """Persist settings to JSON file."""
    for path in [CONFIG_JSON_PATH, "data/config.json", "/data/config.json"]:
        dir_name = os.path.dirname(path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(config_data, f, indent=2)
            break
        except Exception as e:
            logger.warning(f"Could not write {path}: {e}")

async def get_active_settings(db: AsyncSession | None = None) -> dict:
    """Get merged configuration from SQLite system_settings table, /data/config.json, and .env defaults."""
    env = get_settings()
    config = {
        "jellyfin_url": env.jellyfin_url,
        "jellyfin_api_key": env.jellyfin_api_key,
        "jellyfin_user_id": env.jellyfin_user_id,
        "tv_device_name": env.tv_device_name,
        "tv_ip": env.tv_ip,
        "adb_port": env.adb_port,
    }
    
    # Layer 1: Persistent JSON config
    json_cfg = _read_json_config()
    for k, v in json_cfg.items():
        if k in config and v is not None and str(v).strip():
            if k == "adb_port":
                try:
                    config[k] = int(v)
                except (ValueError, TypeError):
                    pass
            else:
                config[k] = str(v).strip()
    
    # Layer 2: SQLite database (authoritative if present)
    if db is not None:
        try:
            from app.models import SystemSetting
            res = await db.execute(select(SystemSetting))
            rows = res.scalars().all()
            for row in rows:
                if row.key in config and row.value is not None and str(row.value).strip():
                    if row.key == "adb_port":
                        try:
                            config[row.key] = int(row.value)
                        except (ValueError, TypeError):
                            pass
                    else:
                        config[row.key] = row.value
        except Exception as e:
            logger.debug(f"Could not read from SystemSetting table: {e}")
            
    return config

async def save_active_settings(db: AsyncSession, updates: dict) -> dict:
    """Save updated configuration to SQLite system_settings table and /data/config.json."""
    from app.models import SystemSetting
    
    # 1. Update SQLite
    try:
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
    except Exception as e:
        logger.error(f"Failed to commit settings to SQLite: {e}")

    # 2. Update JSON config
    current_cfg = await get_active_settings(db)
    for key, value in updates.items():
        if value is not None:
            current_cfg[key] = value
    _write_json_config(current_cfg)
    
    return current_cfg
