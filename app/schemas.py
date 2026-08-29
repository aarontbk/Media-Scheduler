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

# --- TV Status ---
class TVStatus(BaseModel):
    session_found: bool
    session_id: str | None = None
    device_name: str | None = None
    is_active: bool = False
    adb_reachable: bool = False

# --- Play Now ---
class PlayNowRequest(BaseModel):
    item_ids: list[str]
