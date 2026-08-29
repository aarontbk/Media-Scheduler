"""
Abstract base class for TV controllers (Android TV via ADB, Samsung Tizen, etc.).
"""
from abc import ABC, abstractmethod


class BaseTVController(ABC):
    """Abstract interface for a TV controller."""

    @abstractmethod
    async def is_screen_on(self) -> bool:
        """Check if the TV display is currently powered on / awake."""

    @abstractmethod
    async def ensure_awake_and_ready(self) -> bool:
        """
        Ensure the TV screen is on and the media app is in the foreground.
        Returns True if the TV is ready to receive playback commands.
        """

    @abstractmethod
    async def turn_off_tv(self) -> bool:
        """Gracefully put the TV to sleep / standby after playback."""

    @abstractmethod
    async def get_detailed_status(self, **kwargs) -> dict:
        """
        Return a status dict with at minimum:
            state: str       — e.g. "on", "standby", "offline", "not_configured"
            is_ready: bool   — True if the TV is reachable and controllable
            message: str     — Human-friendly status description
        """
