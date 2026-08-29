from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # Jellyfin
    jellyfin_url: str = "http://localhost:8096"
    jellyfin_api_key: str = ""
    jellyfin_user_id: str = ""
    
    # TV Target
    tv_device_name: str = ""  # e.g. "Living Room TV"
    tv_ip: str = ""           # e.g. "192.168.1.100"
    adb_port: int = 5555
    
    # Database
    database_url: str = "sqlite+aiosqlite:///data/scheduler.db"
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8080
    
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

@lru_cache
def get_settings() -> Settings:
    return Settings()
