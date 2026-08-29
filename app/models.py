import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Text, Integer, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class ScheduledJob(Base):
    __tablename__ = "scheduled_jobs"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    target_type: Mapped[str] = mapped_column(String(32), default="media")  # "media" | "playlist"
    jellyfin_item_id: Mapped[str] = mapped_column(String(64), nullable=False)  # item ID or playlist ID
    item_type: Mapped[str] = mapped_column(String(32), nullable=False)  # Movie, Episode, Series, Playlist
    image_tag: Mapped[str | None] = mapped_column(String(64), nullable=True)
    scheduled_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending")  # pending, running, completed, failed, cancelled
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    apscheduler_job_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    
    # Recurring schedule configuration
    schedule_type: Mapped[str] = mapped_column(String(32), default="once")  # once, daily, weekly, custom_days
    days_of_week: Mapped[str | None] = mapped_column(String(64), nullable=True)  # e.g. "fri,sat" or "mon"
    time_of_day: Mapped[str | None] = mapped_column(String(16), nullable=True)  # e.g. "20:30"
    auto_turn_off: Mapped[bool] = mapped_column(Boolean, default=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Playlist(Base):
    __tablename__ = "playlists"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    items: Mapped[list["PlaylistItem"]] = relationship(
        "PlaylistItem", back_populates="playlist", cascade="all, delete-orphan", order_by="PlaylistItem.order"
    )

class PlaylistItem(Base):
    __tablename__ = "playlist_items"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    playlist_id: Mapped[str] = mapped_column(String(36), ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False)
    jellyfin_item_id: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    item_type: Mapped[str] = mapped_column(String(32), default="Movie")  # Movie, Episode
    image_tag: Mapped[str | None] = mapped_column(String(64), nullable=True)
    runtime_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    playlist: Mapped["Playlist"] = relationship("Playlist", back_populates="items")

class SystemSetting(Base):
    __tablename__ = "system_settings"
    
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
