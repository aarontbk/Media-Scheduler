import logging
import httpx
from app.config import get_settings

logger = logging.getLogger(__name__)

class JellyfinClient:
    """Client for interacting with the Jellyfin REST API."""
    def __init__(self, base_url: str | None = None, api_key: str | None = None, user_id: str | None = None, tv_device_name: str | None = None):
        settings = get_settings()
        self.base_url = (base_url or settings.jellyfin_url).rstrip("/")
        self.api_key = api_key if api_key is not None else settings.jellyfin_api_key
        self.user_id = user_id if user_id is not None else settings.jellyfin_user_id
        self.tv_device_name = tv_device_name or settings.tv_device_name
        self.headers = {
            "X-Emby-Token": self.api_key,
            "Accept": "application/json",
        }
    
    async def get_valid_user_id(self) -> str | None:
        """Resolve a valid user ID. If not explicitly set, fetch users from Jellyfin and pick the first."""
        if self.user_id:
            return self.user_id
            
        users = await self.list_users()
        if users:
            # Pick first admin or first user
            for u in users:
                if u.get("is_admin"):
                    self.user_id = u["id"]
                    return self.user_id
            self.user_id = users[0]["id"]
            return self.user_id
        return None

    async def test_connection(self) -> dict:
        """Test connection to the Jellyfin server and validate API key."""
        if not self.base_url or not self.api_key:
            return {"connected": False, "error": "Jellyfin URL or API Key is missing"}
            
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                resp = await client.get(
                    f"{self.base_url}/System/Info",
                    headers=self.headers,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    users = await self.list_users()
                    return {
                        "connected": True,
                        "server_name": data.get("ServerName", "Jellyfin Server"),
                        "version": data.get("Version", "Unknown"),
                        "id": data.get("Id", ""),
                        "users": users,
                    }
                elif resp.status_code == 401 or resp.status_code == 403:
                    return {"connected": False, "error": "Invalid API Key or unauthorized access"}
                else:
                    return {"connected": False, "error": f"Server returned HTTP {resp.status_code}"}
        except httpx.ConnectError:
            return {"connected": False, "error": f"Could not connect to server at {self.base_url}. Check URL/IP and port."}
        except httpx.TimeoutException:
            return {"connected": False, "error": f"Connection timed out when contacting {self.base_url}."}
        except Exception as e:
            return {"connected": False, "error": str(e)}

    async def list_users(self) -> list[dict]:
        """Fetch all users from the Jellyfin server."""
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                resp = await client.get(
                    f"{self.base_url}/Users",
                    headers=self.headers,
                )
                if resp.status_code != 200:
                    return []
                data = resp.json()
                return [
                    {
                        "id": u["Id"],
                        "name": u["Name"],
                        "is_admin": u.get("Policy", {}).get("IsAdministrator", False),
                        "has_password": u.get("HasPassword", False),
                    }
                    for u in data
                ]
        except Exception as e:
            logger.warning(f"Failed to fetch Jellyfin users: {e}")
            return []

    async def get_user_views(self) -> list[dict]:
        """Fetch all top-level media libraries (Views) for the user."""
        user_id = await self.get_valid_user_id()
        endpoint = f"{self.base_url}/Users/{user_id}/Views" if user_id else f"{self.base_url}/Library/MediaFolders"
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                resp = await client.get(endpoint, headers=self.headers)
                if resp.status_code == 200:
                    data = resp.json()
                    return [
                        {
                            "id": item["Id"],
                            "name": item["Name"],
                            "collection_type": item.get("CollectionType", ""),
                        }
                        for item in data.get("Items", [])
                    ]
        except Exception as e:
            logger.warning(f"Failed to fetch Jellyfin user views: {e}")
        return []

    async def search_media(
        self,
        query: str | None = None,
        media_type: str = "Movie,Series",
        category: str | None = None,
        genres: str | None = None,
        limit: int = 60,
    ) -> list[dict]:
        """
        Search or browse Jellyfin library for movies, series, or anime.
        Supports category='anime' by searching Anime libraries and filtering by genre.
        """
        user_id = await self.get_valid_user_id()
        endpoint = f"{self.base_url}/Users/{user_id}/Items" if user_id else f"{self.base_url}/Items"
        
        # Base query parameters
        base_params = {
            "IncludeItemTypes": media_type,
            "Recursive": "true",
            "Fields": "Overview,RunTimeTicks,ProductionYear,PrimaryImageAspectRatio,Status,AirDays,Genres",
            "Limit": limit,
            "SortBy": "SortName",
            "SortOrder": "Ascending",
        }
        
        if query and query.strip():
            base_params["searchTerm"] = query.strip()

        is_anime = category and category.lower() == "anime"
        
        results_map = {}

        def parse_items(items_data):
            for item in items_data:
                item_id = item["Id"]
                if item_id in results_map:
                    continue
                runtime_ticks = item.get("RunTimeTicks")
                results_map[item_id] = {
                    "id": item_id,
                    "name": item["Name"],
                    "type": item["Type"],
                    "year": item.get("ProductionYear"),
                    "overview": (item.get("Overview") or "")[:250],
                    "runtime_minutes": int(runtime_ticks / 600_000_000) if runtime_ticks else None,
                    "image_tag": item.get("ImageTags", {}).get("Primary"),
                    "genres": item.get("Genres", []),
                }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                if is_anime:
                    # 1. Check for dedicated Anime libraries
                    views = await self.get_user_views()
                    anime_views = [v for v in views if "anime" in v["name"].lower()]
                    
                    for av in anime_views:
                        p = dict(base_params)
                        p["ParentId"] = av["id"]
                        resp = await client.get(endpoint, headers=self.headers, params=p)
                        if resp.status_code == 200:
                            parse_items(resp.json().get("Items", []))
                    
                    # 2. Also search items tagged with Genre 'Anime' or 'Animation'
                    for g in ["Anime", "Animation"]:
                        p = dict(base_params)
                        p["Genres"] = g
                        resp = await client.get(endpoint, headers=self.headers, params=p)
                        if resp.status_code == 200:
                            parse_items(resp.json().get("Items", []))
                else:
                    # Standard search / browse
                    p = dict(base_params)
                    if genres:
                        p["Genres"] = genres
                    resp = await client.get(endpoint, headers=self.headers, params=p)
                    resp.raise_for_status()
                    parse_items(resp.json().get("Items", []))

            # Return list sorted alphabetically
            return sorted(results_map.values(), key=lambda x: (x["name"] or "").lower())
        except httpx.HTTPError as e:
            logger.error(f"HTTP error during search_media: {e}")
            return list(results_map.values())
        except Exception as e:
            logger.error(f"Unexpected error during search_media: {e}")
            return list(results_map.values())

    async def get_seasons(self, series_id: str) -> list[dict]:
        """Get seasons for a TV series, with fallback to items query."""
        user_id = await self.get_valid_user_id()
        
        # Method 1: /Shows/{series_id}/Seasons
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                params = {"userId": user_id} if user_id else {}
                resp = await client.get(
                    f"{self.base_url}/Shows/{series_id}/Seasons",
                    headers=self.headers,
                    params=params,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    seasons = [
                        {
                            "id": item["Id"],
                            "name": item["Name"],
                            "season_number": item.get("IndexNumber", 1),
                            "image_tag": item.get("ImageTags", {}).get("Primary"),
                        }
                        for item in data.get("Items", [])
                    ]
                    if seasons:
                        return sorted(seasons, key=lambda s: s["season_number"] or 0)
        except Exception as e:
            logger.debug(f"Shows/Seasons query failed, trying fallback: {e}")
            
        # Method 2: Fallback query
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                endpoint = f"{self.base_url}/Users/{user_id}/Items" if user_id else f"{self.base_url}/Items"
                resp = await client.get(
                    endpoint,
                    headers=self.headers,
                    params={"ParentId": series_id, "IncludeItemTypes": "Season", "SortBy": "IndexNumber", "SortOrder": "Ascending"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return [
                        {
                            "id": item["Id"],
                            "name": item["Name"],
                            "season_number": item.get("IndexNumber", 1),
                            "image_tag": item.get("ImageTags", {}).get("Primary"),
                        }
                        for item in data.get("Items", [])
                    ]
        except Exception as e:
            logger.error(f"Fallback get_seasons failed: {e}")
            
        return []

    async def get_episodes(self, series_id: str, season_id: str) -> list[dict]:
        """Get episodes for a specific season, with fallback to items query."""
        user_id = await self.get_valid_user_id()
        
        # Method 1: /Shows/{series_id}/Episodes?seasonId=...
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                params = {
                    "seasonId": season_id,
                    "Fields": "Overview,RunTimeTicks,IndexNumber,ParentIndexNumber",
                }
                if user_id:
                    params["userId"] = user_id
                resp = await client.get(
                    f"{self.base_url}/Shows/{series_id}/Episodes",
                    headers=self.headers,
                    params=params,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    episodes = [
                        {
                            "id": item["Id"],
                            "name": item["Name"],
                            "season_number": item.get("ParentIndexNumber"),
                            "episode_number": item.get("IndexNumber"),
                            "overview": (item.get("Overview") or "")[:250],
                            "runtime_minutes": int(item["RunTimeTicks"] / 600_000_000) if item.get("RunTimeTicks") else None,
                            "image_tag": item.get("ImageTags", {}).get("Primary"),
                        }
                        for item in data.get("Items", [])
                    ]
                    if episodes:
                        return sorted(episodes, key=lambda e: e["episode_number"] or 0)
        except Exception as e:
            logger.debug(f"Shows/Episodes query failed, trying fallback: {e}")

        # Method 2: Fallback query using ParentId=season_id
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                endpoint = f"{self.base_url}/Users/{user_id}/Items" if user_id else f"{self.base_url}/Items"
                resp = await client.get(
                    endpoint,
                    headers=self.headers,
                    params={
                        "ParentId": season_id,
                        "IncludeItemTypes": "Episode",
                        "Fields": "Overview,RunTimeTicks,IndexNumber,ParentIndexNumber",
                        "SortBy": "IndexNumber",
                        "SortOrder": "Ascending",
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return [
                        {
                            "id": item["Id"],
                            "name": item["Name"],
                            "season_number": item.get("ParentIndexNumber"),
                            "episode_number": item.get("IndexNumber"),
                            "overview": (item.get("Overview") or "")[:250],
                            "runtime_minutes": int(item["RunTimeTicks"] / 600_000_000) if item.get("RunTimeTicks") else None,
                            "image_tag": item.get("ImageTags", {}).get("Primary"),
                        }
                        for item in data.get("Items", [])
                    ]
        except Exception as e:
            logger.error(f"Fallback get_episodes failed: {e}")

        return []

    async def get_sessions(self) -> list[dict]:
        """Get all active Jellyfin sessions."""
        try:
            async with httpx.AsyncClient(timeout=8) as client:
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
                        "user_name": s.get("UserName"),
                    }
                    for s in sessions
                ]
        except Exception as e:
            logger.error(f"Error fetching Jellyfin sessions: {e}")
            return []

    async def find_tv_session(self) -> dict | None:
        """Find the target TV session by device name or Android TV client."""
        try:
            sessions = await self.get_sessions()
            tv_name = (self.tv_device_name or "").lower().strip()
            
            # Match 1: By configured Device Name if set
            if tv_name:
                for session in sessions:
                    if tv_name in session["device_name"].lower() and session["supports_remote_control"]:
                        return session
                        
            # Match 2: Any Android TV client with remote control support
            for session in sessions:
                if "android tv" in session["client"].lower() and session["supports_remote_control"]:
                    return session
                    
            # Match 3: Any active controllable session
            for session in sessions:
                if session["supports_remote_control"] and session["is_active"]:
                    return session
                    
            return None
        except Exception as e:
            logger.error(f"Unexpected error in find_tv_session: {e}")
            return None

    async def play_on_session(self, session_id: str, item_ids: list[str]) -> bool:
        """Send PlayNow command to a session."""
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
                if resp.status_code in (200, 204):
                    logger.info(f"Playback started on session {session_id}")
                    return True
                logger.error(f"Play command failed with code {resp.status_code}: {resp.text}")
                return False
        except Exception as e:
            logger.error(f"Error during play_on_session: {e}")
            return False

    def get_image_url(self, item_id: str, image_tag: str | None = None, max_width: int = 300) -> str:
        """Build URL for an item's primary image."""
        url = f"{self.base_url}/Items/{item_id}/Images/Primary?maxWidth={max_width}"
        if image_tag:
            url += f"&tag={image_tag}"
        return url
