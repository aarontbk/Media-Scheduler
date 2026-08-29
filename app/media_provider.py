"""
Abstract base classes for media providers and TV controllers.
All concrete implementations must inherit from these classes.
"""
from abc import ABC, abstractmethod


class BaseMediaProvider(ABC):
    """Abstract interface for a media server (Jellyfin, Plex, etc.)."""

    @abstractmethod
    async def test_connection(self) -> dict:
        """Test connectivity. Returns dict with 'connected' bool and optional 'error'."""

    @abstractmethod
    async def search_media(
        self,
        query: str | None = None,
        media_type: str = "Movie,Series",
        category: str | None = None,
        genres: str | None = None,
        limit: int = 100,
    ) -> list[dict]:
        """Search or browse the media library."""

    @abstractmethod
    async def get_seasons(self, series_id: str) -> list[dict]:
        """Get seasons for a TV series."""

    @abstractmethod
    async def get_episodes(self, series_id: str, season_id: str) -> list[dict]:
        """Get episodes for a season."""

    @abstractmethod
    async def get_sessions(self) -> list[dict]:
        """Get all active player sessions."""

    @abstractmethod
    async def find_tv_session(self) -> dict | None:
        """Find the best matching TV session for remote playback."""

    @abstractmethod
    async def play_on_session(self, session_id: str, item_ids: list[str]) -> bool:
        """Send PlayNow command to the given session."""

    @abstractmethod
    async def get_total_runtime_seconds(self, item_ids: list[str]) -> int:
        """Get total expected playback duration in seconds for a list of item IDs."""

    @abstractmethod
    async def get_session_now_playing(self, session_id: str) -> dict | None:
        """Get now-playing info for a specific session."""

    @abstractmethod
    def get_image_url(self, item_id: str, image_tag: str | None = None, max_width: int = 300) -> str:
        """Return the URL for an item's primary image."""
