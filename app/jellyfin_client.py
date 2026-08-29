import logging
import httpx
from app.config import get_settings

logger = logging.getLogger(__name__)

class JellyfinClient:
    """Client for interacting with the Jellyfin REST API."""
    def __init__(self):
        """Initialize the JellyfinClient."""
        self.settings = get_settings()
        self.base_url = self.settings.jellyfin_url.rstrip("/")
        self.headers = {
            "X-Emby-Token": self.settings.jellyfin_api_key,
            "Accept": "application/json",
        }
    
    async def search_media(self, query: str, media_type: str = "Movie,Series") -> list[dict]:
        """
        Search Jellyfin library for movies and/or series.
        
        Args:
            query: The search term.
            media_type: Comma-separated string of media types (default: 'Movie,Series').
            
        Returns:
            A list of dictionary objects containing search results.
        """
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self.base_url}/Users/{self.settings.jellyfin_user_id}/Items",
                    headers=self.headers,
                    params={
                        "searchTerm": query,
                        "IncludeItemTypes": media_type,
                        "Recursive": "true",
                        "Fields": "Overview,RunTimeTicks,ProductionYear,PrimaryImageAspectRatio",
                        "Limit": 20,
                        "SortBy": "SortName",
                        "SortOrder": "Ascending",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                results = []
                for item in data.get("Items", []):
                    runtime_ticks = item.get("RunTimeTicks")
                    results.append({
                        "id": item["Id"],
                        "name": item["Name"],
                        "type": item["Type"],
                        "year": item.get("ProductionYear"),
                        "overview": item.get("Overview", "")[:200],
                        "runtime_minutes": int(runtime_ticks / 600_000_000) if runtime_ticks else None,
                        "image_tag": item.get("ImageTags", {}).get("Primary"),
                    })
                return results
        except httpx.HTTPError as e:
            logger.error(f"HTTP error during search_media: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error during search_media: {e}")
            return []
    
    async def get_seasons(self, series_id: str) -> list[dict]:
        """
        Get seasons for a TV series.
        
        Args:
            series_id: The ID of the TV series.
            
        Returns:
            A list of seasons.
        """
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self.base_url}/Shows/{series_id}/Seasons",
                    headers=self.headers,
                    params={"userId": self.settings.jellyfin_user_id},
                )
                resp.raise_for_status()
                data = resp.json()
                return [
                    {
                        "id": item["Id"],
                        "name": item["Name"],
                        "season_number": item.get("IndexNumber"),
                        "image_tag": item.get("ImageTags", {}).get("Primary"),
                    }
                    for item in data.get("Items", [])
                ]
        except httpx.HTTPError as e:
            logger.error(f"HTTP error during get_seasons: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error during get_seasons: {e}")
            return []
    
    async def get_episodes(self, series_id: str, season_id: str) -> list[dict]:
        """
        Get episodes for a specific season.
        
        Args:
            series_id: The ID of the TV series.
            season_id: The ID of the season.
            
        Returns:
            A list of episodes in the season.
        """
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self.base_url}/Shows/{series_id}/Episodes",
                    headers=self.headers,
                    params={
                        "seasonId": season_id,
                        "userId": self.settings.jellyfin_user_id,
                        "Fields": "Overview,RunTimeTicks",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                return [
                    {
                        "id": item["Id"],
                        "name": item["Name"],
                        "season_number": item.get("ParentIndexNumber"),
                        "episode_number": item.get("IndexNumber"),
                        "overview": item.get("Overview", "")[:200],
                        "runtime_minutes": int(item["RunTimeTicks"] / 600_000_000) if item.get("RunTimeTicks") else None,
                        "image_tag": item.get("ImageTags", {}).get("Primary"),
                    }
                    for item in data.get("Items", [])
                ]
        except httpx.HTTPError as e:
            logger.error(f"HTTP error during get_episodes: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error during get_episodes: {e}")
            return []
    
    async def get_sessions(self) -> list[dict]:
        """
        Get all active Jellyfin sessions.
        
        Returns:
            A list of active sessions.
        """
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self.base_url}/Sessions",
                    headers=self.headers,
                )
                resp.raise_for_status()
                sessions = resp.json()
                return [
                    {
                        "id": s["Id"],
                        "device_name": s.get("DeviceName", "Unknown"),
                        "client": s.get("Client", "Unknown"),
                        "is_active": s.get("IsActive", False),
                        "supports_remote_control": s.get("SupportsRemoteControl", False),
                        "now_playing": s.get("NowPlayingItem", {}).get("Name") if s.get("NowPlayingItem") else None,
                    }
                    for s in sessions
                ]
        except httpx.HTTPError as e:
            logger.error(f"HTTP error during get_sessions: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error during get_sessions: {e}")
            return []
    
    async def find_tv_session(self) -> dict | None:
        """
        Find the target TV session by device name.
        
        Returns:
            The session dict if found, otherwise None.
        """
        try:
            sessions = await self.get_sessions()
            tv_name = self.settings.tv_device_name.lower()
            for session in sessions:
                if tv_name in session["device_name"].lower() and session["supports_remote_control"]:
                    return session
            # Fallback: look for any Android TV client
            for session in sessions:
                if "android tv" in session["client"].lower() and session["supports_remote_control"]:
                    return session
            return None
        except Exception as e:
            logger.error(f"Unexpected error during find_tv_session: {e}")
            return None
    
    async def play_on_session(self, session_id: str, item_ids: list[str]) -> bool:
        """
        Send PlayNow command to a session.
        
        Args:
            session_id: The session ID.
            item_ids: List of item IDs to play.
            
        Returns:
            True if successful, False otherwise.
        """
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"{self.base_url}/Sessions/{session_id}/Playing",
                    headers=self.headers,
                    params={
                        "playCommand": "PlayNow",
                        "itemIds": ",".join(item_ids),
                    },
                )
                if resp.status_code == 204:
                    logger.info(f"Playback started on session {session_id}")
                    return True
                logger.error(f"Play command failed: {resp.status_code} {resp.text}")
                return False
        except httpx.HTTPError as e:
            logger.error(f"HTTP error during play_on_session: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error during play_on_session: {e}")
            return False
    
    def get_image_url(self, item_id: str, image_tag: str | None = None, max_width: int = 300) -> str:
        """
        Build a URL for an item's primary image.
        
        Args:
            item_id: The item ID.
            image_tag: The image tag.
            max_width: The maximum width of the image.
            
        Returns:
            The image URL string.
        """
        url = f"{self.base_url}/Items/{item_id}/Images/Primary?maxWidth={max_width}"
        if image_tag:
            url += f"&tag={image_tag}"
        return url
