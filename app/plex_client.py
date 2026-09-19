"""
Plex Media Server client implementing BaseMediaProvider.
Supports library browsing, session discovery, and remote playback via Plex Companion Protocol.
"""
import logging
from urllib.parse import quote_plus
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
        self._server_id: str | None = None
        self._command_id: int = 0

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
            async with httpx.AsyncClient(timeout=3) as client:
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

    async def _get_server_machine_id(self) -> str:
        """Fetch and cache the Plex Media Server's machineIdentifier."""
        if self._server_id:
            return self._server_id
        if not self.base_url:
            return ""
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(f"{self.base_url}/identity", headers=self.headers)
                if resp.status_code == 200:
                    mid = resp.json().get("MediaContainer", {}).get("machineIdentifier")
                    if mid:
                        self._server_id = mid
                        return self._server_id
                # Fallback to GET /
                resp = await client.get(f"{self.base_url}/", headers=self.headers)
                if resp.status_code == 200:
                    mid = resp.json().get("MediaContainer", {}).get("machineIdentifier")
                    if mid:
                        self._server_id = mid
                        return self._server_id
        except Exception as e:
            logger.warning(f"Plex: Could not fetch server machineIdentifier: {e}")
        return self._server_id or ""

    async def _get_delegation_token(self) -> str:
        """Fetch a transient delegation token from PMS for companion playback."""
        if not self.base_url or not self.token:
            return ""
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(
                    f"{self.base_url}/security/token?type=delegation&scope=all",
                    headers=self.headers,
                )
                if resp.status_code == 200:
                    tok = resp.json().get("MediaContainer", {}).get("token")
                    if tok:
                        return tok
        except Exception as e:
            logger.debug(f"Plex: Could not fetch delegation token: {e}")
        return self.token

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
        """
        Get all Plex player sessions, merging active playback sessions (/status/sessions)
        and registered companion clients (/clients).
        """
        sessions_map: dict[str, dict] = {}
        async with httpx.AsyncClient(timeout=8) as client:
            # 1. Fetch active playing sessions
            try:
                resp = await client.get(
                    f"{self.base_url}/status/sessions",
                    headers=self.headers,
                )
                if resp.status_code == 200:
                    items = resp.json().get("MediaContainer", {}).get("Metadata", []) or []
                    for s in items:
                        player = s.get("Player", {})
                        m_id = player.get("machineIdentifier", "")
                        device_name = player.get("title", player.get("device", "Unknown"))
                        key = m_id or device_name
                        sessions_map[key] = {
                            "id": m_id,
                            "device_name": device_name,
                            "client": player.get("product", "Plex"),
                            "player_ip": player.get("address", ""),
                            "is_active": player.get("state") in ("playing", "buffering", "paused"),
                            "supports_remote_control": True,
                            "now_playing": s.get("title"),
                        }
            except Exception as e:
                logger.debug(f"Error fetching Plex active sessions: {e}")

            # 2. Fetch available companion clients (discovered players on LAN)
            try:
                resp = await client.get(
                    f"{self.base_url}/clients",
                    headers=self.headers,
                )
                if resp.status_code == 200:
                    clients = resp.json().get("MediaContainer", {}).get("Server", []) or []
                    for c in clients:
                        m_id = c.get("machineIdentifier", "")
                        device_name = c.get("name", c.get("device", "Unknown"))
                        key = m_id or device_name
                        if key not in sessions_map:
                            sessions_map[key] = {
                                "id": m_id,
                                "device_name": device_name,
                                "client": c.get("product", "Plex"),
                                "player_ip": c.get("address", c.get("host", "")),
                                "is_active": False,
                                "supports_remote_control": True,
                                "now_playing": None,
                            }
                        else:
                            # Enrich existing active session if player_ip was missing
                            if not sessions_map[key].get("player_ip"):
                                sessions_map[key]["player_ip"] = c.get("address", c.get("host", ""))
            except Exception as e:
                logger.debug(f"Error fetching Plex companion clients: {e}")

        return list(sessions_map.values())

    async def find_tv_session(self) -> dict | None:
        """Find the best matching Plex player session."""
        try:
            sessions = await self.get_sessions()

            # Match 1: By configured player machine ID
            if self.player_machine_id:
                for s in sessions:
                    if s["id"] and s["id"].lower() == self.player_machine_id.lower():
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
                    d_name = s.get("device_name", "").lower()
                    if tv_name in d_name or d_name in tv_name:
                        return s

            # Match 4: Any active session
            for s in sessions:
                if s.get("is_active"):
                    return s

            # Match 5: Any discovered TV/client
            if sessions:
                return sessions[0]

            # Match 6: Synthetic fallback if player_ip is configured
            if self.player_ip:
                logger.info(f"Plex: TV player not yet in sessions list, using configured IP {self.player_ip}")
                return {
                    "id": self.player_machine_id or "tv-plex-player",
                    "device_name": self.tv_device_name or "Android TV (Plex)",
                    "client": "Plex for Android (TV)",
                    "player_ip": self.player_ip,
                    "is_active": False,
                    "supports_remote_control": True,
                    "now_playing": None,
                }

            return None
        except Exception as e:
            logger.error(f"Unexpected error in find_tv_session: {e}")
            return None

    # -------------------------------------------------------------------------
    # Playback — Plex Companion Protocol
    # -------------------------------------------------------------------------
    async def play_on_session(self, session_id: str, item_ids: list[str]) -> bool:
        """
        Send PlayMedia command via Plex Companion Protocol.
        Tries direct connection to player on port 32500 first,
        with automatic fallback to proxying through Plex Media Server.
        """
        if not item_ids:
            return False

        first_id = item_ids[0]

        # 1. Create a play queue on PMS
        queue_key = await self._create_play_queue(item_ids)
        container_key = queue_key if queue_key else f"/library/metadata/{first_id}"
        if queue_key and "?" not in container_key:
            container_key = f"{container_key}?window=100&own=1"

        # 2. Server details
        server_id = await self._get_server_machine_id()
        parsed_url = httpx.URL(self.base_url)
        pms_host = parsed_url.host
        pms_port = str(parsed_url.port or 32400)
        pms_protocol = parsed_url.scheme or "http"

        # 3. Delegation token
        play_token = await self._get_delegation_token()

        # 4. Resolve player IP & machine ID
        player_ip = self.player_ip
        target_machine_id = session_id or self.player_machine_id

        if not player_ip or not target_machine_id:
            sessions = await self.get_sessions()
            for s in sessions:
                if session_id and s["id"] == session_id:
                    player_ip = player_ip or s.get("player_ip", "")
                    target_machine_id = target_machine_id or s.get("id", "")
                    break

        self._command_id += 1
        params = {
            "providerIdentifier": "com.plexapp.plugins.library",
            "machineIdentifier": server_id,
            "protocol": pms_protocol,
            "address": pms_host,
            "port": pms_port,
            "offset": 0,
            "key": f"/library/metadata/{first_id}",
            "type": "video",
            "containerKey": container_key,
            "token": play_token,
            "commandID": str(self._command_id),
        }
        headers = {
            **self.player_headers,
            "X-Plex-Target-Client-Identifier": target_machine_id or "",
        }

        # Strategy A: Direct connection to Plex player (port 32500)
        if player_ip:
            direct_url = f"http://{player_ip}:32500/player/playback/playMedia"
            try:
                logger.info(f"Plex Companion: Sending direct PlayMedia to {direct_url}...")
                async with httpx.AsyncClient(timeout=8) as client:
                    resp = await client.get(direct_url, headers=headers, params=params)
                    if resp.status_code in (200, 204):
                        logger.info(f"Plex Companion: Direct PlayMedia succeeded on {player_ip}")
                        return True
                    logger.warning(f"Plex Companion: Direct PlayMedia returned {resp.status_code}: {resp.text[:150]}")
            except Exception as e:
                logger.warning(f"Plex Companion: Direct connection to {player_ip}:32500 failed ({e}), attempting server proxy...")

        # Strategy B: Proxy through Plex Media Server (/player/playback/playMedia)
        proxy_url = f"{self.base_url}/player/playback/playMedia"
        try:
            logger.info(f"Plex Companion: Sending proxied PlayMedia via PMS for client {target_machine_id}...")
            proxy_headers = {**headers, "X-Plex-Token": self.token}
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(proxy_url, headers=proxy_headers, params=params)
                if resp.status_code in (200, 204):
                    logger.info(f"Plex Companion: Proxied PlayMedia succeeded via PMS")
                    return True
                logger.error(f"Plex Companion: Proxied PlayMedia returned {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            logger.error(f"Plex Companion: Proxied PlayMedia failed: {e}")

        return False

    async def _create_play_queue(self, item_ids: list[str]) -> str | None:
        """Create a Plex play queue from a list of item IDs and return its containerKey."""
        if not item_ids:
            return None
        try:
            server_id = await self._get_server_machine_id()
            if len(item_ids) == 1:
                uri = f"server://{server_id}/com.plexapp.plugins.library/library/metadata/{item_ids[0]}"
            else:
                item_keys = ",".join(str(x) for x in item_ids)
                uri = f"library:///directory/{quote_plus(f'/library/metadata/{item_keys}')}"

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
                logger.warning(f"Plex playQueues returned {resp.status_code}: {resp.text[:200]}")
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
