from pydantic import BaseModel
from datetime import datetime

# --- Schedule ---
class ScheduleCreate(BaseModel):
    name: str
    jellyfin_item_id: str
    item_type: str  # movie, episode
    image_tag: str | None = None
    scheduled_time: datetime

class ScheduleResponse(BaseModel):
    id: str
    name: str
    jellyfin_item_id: str
    item_type: str
    image_tag: str | None
    scheduled_time: datetime
    status: str
    error_message: str | None
    created_at: datetime
    
    model_config = {"from_attributes": True}

# --- Media ---
class MediaSearchResult(BaseModel):
    id: str
    name: str
    type: str
    year: int | None = None
    overview: str | None = None
    runtime_minutes: int | None = None
    image_tag: str | None = None

class EpisodeResult(BaseModel):
    id: str
    name: str
    season_number: int | None = None
    episode_number: int | None = None
    overview: str | None = None
    runtime_minutes: int | None = None
    image_tag: str | None = None

class SeasonResult(BaseModel):
    id: str
    name: str
    season_number: int | None = None
    image_tag: str | None = None

# --- Sessions ---
class SessionInfo(BaseModel):
    id: str
    device_name: str
    client: str
    is_active: bool
    supports_remote_control: bool
    now_playing: str | None = None
    user_name: str | None = None

# --- TV & ADB Status ---
class TVStatus(BaseModel):
    session_found: bool
    session_id: str | None = None
    device_name: str | None = None
    is_active: bool = False
    adb_state: str = "offline"  # device, unauthorized, offline, cannot_connect, not_configured
    adb_reachable: bool = False
    adb_message: str = ""
    configured_tv_ip: str = ""
    configured_tv_name: str = ""

class ADBConnectRequest(BaseModel):
    ip: str | None = None
    port: int | None = 5555

class ADBStatusResponse(BaseModel):
    configured_ip: str
    configured_port: int
    state: str  # device, unauthorized, offline, cannot_connect, not_configured
    is_ready: bool
    message: str
    raw_output: str | None = None

# --- Jellyfin Settings & Diagnostic Schemas ---
class JellyfinUser(BaseModel):
    id: str
    name: str
    is_admin: bool = False
    has_password: bool = False

class JellyfinTestResponse(BaseModel):
    connected: bool
    server_name: str | None = None
    version: str | None = None
    id: str | None = None
    users: list[JellyfinUser] = []
    error: str | None = None

class SettingsUpdate(BaseModel):
    jellyfin_url: str | None = None
    jellyfin_api_key: str | None = None
    jellyfin_user_id: str | None = None
    tv_device_name: str | None = None
    tv_ip: str | None = None
    adb_port: int | None = 5555

class SettingsResponse(BaseModel):
    jellyfin_url: str
    jellyfin_api_key: str
    jellyfin_user_id: str
    tv_device_name: str
    tv_ip: str
    adb_port: int
    jellyfin_connected: bool = False
    jellyfin_users: list[JellyfinUser] = []
    adb_state: str = "offline"
    adb_is_ready: bool = False
    adb_message: str = ""

# --- Play Now ---
class PlayNowRequest(BaseModel):
    item_ids: list[str]
