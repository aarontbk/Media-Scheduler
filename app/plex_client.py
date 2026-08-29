"""
Plex Media Server client implementing BaseMediaProvider.
Supports library browsing, session discovery, and remote playback via Plex Companion Protocol.
"""
import logging
import httpx
from app.media_provider import BaseMediaProvider

logger = logging.getLogger(__name__)

# Plex Companion headers sent with all requests
_PLEX_HEADERS = {
    "X-Plex-Client-Identifier": "media-scheduler",
    "X-Plex-Product": "Media Scheduler",
    "X-Plex-Version": "1.0",
    "Accept": "application/json",
}


class PlexClient(BaseMediaProvider):
    """Client for interacting with Plex Media Server and Plex Companion Protocol."""

    def __init__(
        self,
        base_url: str = "",
        token: str = "",
        player_ip: str = "",
        player_machine_id: str = "",
        tv_device_name: str = "",
    ):
        self.base_url = base_url.rstrip("/") if base_url else ""
        self.token = token
        self.player_ip = player_ip          # IP of the Plex player on LAN
        self.player_machine_id = player_machine_id  # Plex machine identifier of the player
        self.tv_device_name = tv_device_name

        self.headers = {
            **_PLEX_HEADERS,
            "X-Plex-Token": self.token,
        }
        # Companion player headers (for /player/... endpoints on port 32500)
        self.player_headers = {**_PLEX_HEADERS}

    # -------------------------------------------------------------------------
    # Connection test
    # -------------------------------------------------------------------------
    async def test_connection(self) -> dict:
        if not self.base_url or not self.token:
            return {"connected": False, "error": "Plex server URL or token is missing"}
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                resp = await client.get(f"{self.base_url}/", headers=self.headers)
                if resp.status_code == 200:
                    data = resp.json()
                    ms = data.get("MediaContainer", {})
                    libraries = await self._get_library_sections(client)
                    return {
                        "connected": True,
                        "server_name": ms.get("friendlyName", "Plex Media Server"),
                        "version": ms.get("version", "Unknown"),
                        "libraries": libraries,
                    }
                elif resp.status_code in (401, 403):
                    return {"connected": False, "error": "Invalid Plex token or unauthorized"}
                else:
                    return {"connected": False, "error": f"Server returned HTTP {resp.status_code}"}
        except httpx.ConnectError:
            return {"connected": False, "error": f"Could not connect to Plex at {self.base_url}"}
        except httpx.TimeoutException:
            return {"connected": False, "error": f"Connection timed out contacting {self.base_url}"}
        except Exception as e:
            return {"connected": False, "error": str(e)}

    # -------------------------------------------------------------------------
    # Library helpers
    # -------------------------------------------------------------------------
    async def _get_library_sections(self, client: httpx.AsyncClient | None = None) -> list[dict]:
        """Fetch all library sections from Plex."""
        async def _fetch(c: httpx.AsyncClient):
            resp = await c.get(f"{self.base_url}/library/sections", headers=self.headers)
            if resp.status_code == 200:
                dirs = resp.json().get("MediaContainer", {}).get("Directory", [])
                return [{"key": d["key"], "title": d["title"], "type": d["type"]} for d in dirs]
            return []

        if client:
            return await _fetch(client)
        async with httpx.AsyncClient(timeout=8) as c:
            return await _fetch(c)

    async def _get_section_key(self, media_type: str) -> list[str]:
        """Get library section keys for the given media type (movie/show)."""
        sections = await self._get_library_sections()
        plex_types = []
        for t in media_type.split(","):
            t = t.strip().lower()
            if t in ("movie",):
                plex_types.append("movie")
            elif t in ("series", "show"):
                plex_types.append("show")
        return [s["key"] for s in sections if s["type"] in plex_types]

    # -------------------------------------------------------------------------
    # Media search
    # -------------------------------------------------------------------------
    async def search_media(
        self,
        query: str | None = None,
        media_type: str = "Movie,Series",
        category: str | None = None,
        genres: str | None = None,
        limit: int = 100,
    ) -> list[dict]:
        results_map: dict[str, dict] = {}

        async with httpx.AsyncClient(timeout=12) as client:
            if query and query.strip():
                # Global search via /hubs/search
                resp = await client.get(
                    f"{self.base_url}/hubs/search",
                    headers=self.headers,
                    params={"query": query, "limit": limit},
                )
                if resp.status_code == 200:
                    hubs = resp.json().get("MediaContainer", {}).get("Hub", [])
                    for hub in hubs:
                        hub_type = hub.get("type", "")
                        if hub_type not in ("movie", "show"):
                            continue
                        for item in hub.get("Metadata", []):
                            self._parse_plex_item(item, results_map)
            else:
                # Browse sections
                section_keys = await self._get_section_key(media_type)
                for key in section_keys:
                    params: dict = {"X-Plex-Container-Size": limit, "sort": "titleSort"}
                    if genres:
                        params["genre"] = genres
                    resp = await client.get(
                        f"{self.base_url}/library/sections/{key}/all",
                        headers=self.headers,
                        params=params,
                    )
                    if resp.status_code == 200:
                        items = resp.json().get("MediaContainer", {}).get("Metadata", [])
                        for item in items:
                            self._parse_plex_item(item, results_map)

        return list(results_map.values())

    def _parse_plex_item(self, item: dict, results_map: dict) -> None:
        """Parse a Plex metadata item into our standard format."""
        key = item.get("ratingKey", "")
        if not key or key in results_map:
            return
        duration_ms = item.get("duration", 0)
        runtime_minutes = int(duration_ms / 60000) if duration_ms else None
        genres = [g["tag"] for g in item.get("Genre", [])]
        item_type = item.get("type", "movie")
        results_map[key] = {
            "id": key,
            "name": item.get("title", "Unknown"),
            "type": "Movie" if item_type == "movie" else "Series",
            "year": item.get("year"),
            "overview": (item.get("summary") or "")[:250],
            "runtime_minutes": runtime_minutes,
            "image_tag": item.get("thumb"),  # Plex uses thumb path, not a tag hash
            "genres": genres,
        }

    # -------------------------------------------------------------------------
    # Seasons / Episodes
    # -------------------------------------------------------------------------
    async def get_seasons(self, series_id: str) -> list[dict]:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{self.base_url}/library/metadata/{series_id}/children",
                headers=self.headers,
            )
            resp.raise_for_status()
            items = resp.json().get("MediaContainer", {}).get("Metadata", [])
            return [
                {
                    "id": item["ratingKey"],
                    "name": item.get("title", f"Season {item.get('index', '?')}"),
                    "season_number": item.get("index"),
                    "image_tag": item.get("thumb"),
                }
                for item in items
                if item.get("type") == "season"
            ]

    async def get_episodes(self, series_id: str, season_id: str) -> list[dict]:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{self.base_url}/library/metadata/{season_id}/children",
                headers=self.headers,
            )
            resp.raise_for_status()
            items = resp.json().get("MediaContainer", {}).get("Metadata", [])
            return [
                {
                    "id": item["ratingKey"],
                    "name": item.get("title", f"Episode {item.get('index', '?')}"),
                    "season_number": item.get("parentIndex"),
                    "episode_number": item.get("index"),
                    "overview": (item.get("summary") or "")[:200],
                    "runtime_minutes": int(item["duration"] / 60000) if item.get("duration") else None,
                    "image_tag": item.get("thumb"),
                }
                for item in items
            ]

    # -------------------------------------------------------------------------
    # Sessions
    # -------------------------------------------------------------------------
    async def get_sessions(self) -> list[dict]:
        """Get all active Plex player sessions."""
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                resp = await client.get(
                    f"{self.base_url}/status/sessions",
                    headers=self.headers,
                )
                resp.raise_for_status()
                items = resp.json().get("MediaContainer", {}).get("Metadata", []) or []
                result = []
                for s in items:
                    player = s.get("Player", {})
                    result.append({
                        "id": player.get("machineIdentifier", ""),
                        "device_name": player.get("title", player.get("device", "Unknown")),
                        "client": player.get("product", "Plex"),
                        "player_ip": player.get("address", ""),
                        "is_active": player.get("state") in ("playing", "buffering", "paused"),
                        "supports_remote_control": True,
                        "now_playing": s.get("title"),
                    })
                return result
        except Exception as e:
            logger.error(f"Error fetching Plex sessions: {e}")
            return []

    async def find_tv_session(self) -> dict | None:
        """Find the best matching Plex player session."""
        try:
            sessions = await self.get_sessions()

            # Match 1: By configured machine ID
            if self.player_machine_id:
                for s in sessions:
                    if s["id"] == self.player_machine_id:
                        return s

            # Match 2: By configured player IP
            if self.player_ip:
                for s in sessions:
                    if s.get("player_ip") == self.player_ip:
                        return s

            # Match 3: By TV device name
            tv_name = (self.tv_device_name or "").lower()
            if tv_name:
                for s in sessions:
                    if tv_name in s.get("device_name", "").lower():
                        return s

            # Match 4: Any active session
            for s in sessions:
                if s.get("is_active"):
                    return s

            return sessions[0] if sessions else None
        except Exception as e:
            logger.error(f"Unexpected error in find_tv_session: {e}")
            return None

    # -------------------------------------------------------------------------
    # Playback — Plex Companion Protocol
    # -------------------------------------------------------------------------
    async def play_on_session(self, session_id: str, item_ids: list[str]) -> bool:
        """
        Send PlayMedia via Plex Companion Protocol (port 32500 on the player).
        session_id here is the player's machineIdentifier.
        item_ids is a list of Plex ratingKeys.
        """
        if not item_ids:
            return False

        # Build Plex library key for the first item (queue starts here)
        first_id = item_ids[0]
        container_key = f"/library/metadata/{first_id}"

        # Use configured player_ip, or try session IP
        player_ip = self.player_ip
        if not player_ip:
            sessions = await self.get_sessions()
            for s in sessions:
                if s["id"] == session_id:
                    player_ip = s.get("player_ip", "")
                    break

        if not player_ip:
            logger.error("Plex: No player IP configured or found in session — cannot send Companion command")
            return False

        companion_url = f"http://{player_ip}:32500/player/playback/playMedia"
        params = {
            "key": container_key,
            "containerKey": container_key,
            "machineIdentifier": session_id or self.player_machine_id,
            "address": self.base_url.split("//")[-1].split(":")[0],
            "port": self.base_url.split(":")[-1].split("/")[0] if ":" in self.base_url.split("//")[-1] else "32400",
            "token": self.token,
            "commandID": "1",
        }

        # If multiple items, queue them all by creating a play queue first
        if len(item_ids) > 1:
            queue_key = await self._create_play_queue(item_ids)
            if queue_key:
                params["containerKey"] = queue_key
                params["key"] = f"/library/metadata/{first_id}"

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(companion_url, headers=self.player_headers, params=params)
                if resp.status_code in (200, 204):
                    logger.info(f"Plex Companion: PlayMedia sent to {player_ip}")
                    return True
                logger.error(f"Plex Companion: PlayMedia returned {resp.status_code}: {resp.text[:200]}")
                return False
        except Exception as e:
            logger.error(f"Plex Companion: PlayMedia failed: {e}")
            return False

    async def _create_play_queue(self, item_ids: list[str]) -> str | None:
        """Create a Plex play queue from a list of item IDs and return its containerKey."""
        try:
            uri = f"server://{self.player_machine_id}/com.plexapp.plugins.library/library/metadata/{','.join(item_ids)}"
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    f"{self.base_url}/playQueues",
                    headers=self.headers,
                    params={"type": "video", "uri": uri, "continuous": "1"},
                )
                if resp.status_code in (200, 201):
                    pq = resp.json().get("MediaContainer", {})
                    queue_id = pq.get("playQueueID")
                    if queue_id:
                        return f"/playQueues/{queue_id}"
        except Exception as e:
            logger.warning(f"Plex: Could not create play queue: {e}")
        return None

    # -------------------------------------------------------------------------
    # Runtime & now-playing
    # -------------------------------------------------------------------------
    async def get_total_runtime_seconds(self, item_ids: list[str]) -> int:
        total = 0
        async with httpx.AsyncClient(timeout=8) as client:
            for item_id in item_ids:
                try:
                    resp = await client.get(
                        f"{self.base_url}/library/metadata/{item_id}",
                        headers=self.headers,
                    )
                    if resp.status_code == 200:
                        items = resp.json().get("MediaContainer", {}).get("Metadata", [])
                        if items:
                            duration_ms = items[0].get("duration", 0)
                            total += int(duration_ms / 1000)
                except Exception as e:
                    logger.warning(f"Plex: Could not get runtime for {item_id}: {e}")
        return max(total, 1200)

    async def get_session_now_playing(self, session_id: str) -> dict | None:
        sessions = await self.get_sessions()
        for s in sessions:
            if s["id"] == session_id:
                return s
        return None

    # -------------------------------------------------------------------------
    # Image URL
    # -------------------------------------------------------------------------
    def get_image_url(self, item_id: str, image_tag: str | None = None, max_width: int = 300) -> str:
        """
        For Plex, image_tag stores the thumb path (e.g. /library/metadata/123/thumb/...).
        We proxy through the Plex server's image transcoder.
        """
        if image_tag and image_tag.startswith("/"):
            return f"{self.base_url}{image_tag}?X-Plex-Token={self.token}&width={max_width}"
        # Fallback: direct thumb endpoint
        return f"{self.base_url}/library/metadata/{item_id}/thumb?X-Plex-Token={self.token}&width={max_width}"
