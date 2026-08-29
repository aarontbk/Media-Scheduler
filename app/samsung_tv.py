"""
Samsung Smart TV (Tizen OS) controller implementing BaseTVController.
Uses:
  - Wake-on-LAN (wakeonlan) for powering on from standby
  - Samsung SmartThings REST API (port 8001) for power state and app launch
  - Samsung Encrypted WebSocket API (port 8002) for remote key events
"""
import asyncio
import base64
import json
import logging
import socket
import ssl
import struct
from app.tv_controller import BaseTVController

logger = logging.getLogger(__name__)

# Known Tizen app IDs
TIZEN_APP_IDS = {
    "jellyfin": "3201807016499",
    "plex": "3201512006785",
    "netflix": "11101200001",
    "youtube": "111299001912",
}


class SamsungTVClient(BaseTVController):
    """
    Samsung Smart TV (Tizen OS) controller.
    
    Capabilities:
    - Wake-on-LAN from standby using MAC address
    - Power state check via Samsung REST API
    - App launch via REST (port 8001)
    - Remote key events via WebSocket (port 8002)
    """

    def __init__(
        self,
        tv_ip: str = "",
        tv_mac: str = "",
        app_id: str = "",
        app_name: str = "jellyfin",
        token: str | None = None,
    ):
        self.tv_ip = tv_ip.strip()
        self.tv_mac = tv_mac.strip()
        # Allow either a raw app ID or a well-known name
        if app_id and app_id.strip():
            self.app_id = app_id.strip()
        else:
            self.app_id = TIZEN_APP_IDS.get(app_name.lower(), TIZEN_APP_IDS["jellyfin"])
        self.token = token  # Persisted WebSocket auth token (set after first pairing)
        self._rest_base = f"http://{self.tv_ip}:8001/api/v2"
        self._ws_url = f"wss://{self.tv_ip}:8002/api/v2/channels/samsung.remote.control"

    # -------------------------------------------------------------------------
    # Power state
    # -------------------------------------------------------------------------
    async def is_screen_on(self) -> bool:
        """Check if TV is on using Samsung REST API."""
        if not self.tv_ip:
            return False
        try:
            import httpx
            async with httpx.AsyncClient(timeout=4, verify=False) as client:
                resp = await client.get(self._rest_base)
                if resp.status_code == 200:
                    data = resp.json()
                    power = data.get("device", {}).get("PowerState", "").lower()
                    return power == "on"
        except Exception as e:
            logger.debug(f"Samsung REST check failed (TV may be fully off): {e}")
        return False

    async def get_detailed_status(self, **kwargs) -> dict:
        """Return detailed TV status dict."""
        if not self.tv_ip:
            return {
                "state": "not_configured",
                "is_ready": False,
                "message": "No Samsung TV IP address configured.",
                "configured_ip": "",
                "configured_mac": "",
                "token": None,
            }

        try:
            import httpx
            async with httpx.AsyncClient(timeout=4, verify=False) as client:
                resp = await client.get(self._rest_base)
                if resp.status_code == 200:
                    data = resp.json()
                    device = data.get("device", {})
                    power = device.get("PowerState", "").lower()
                    is_on = power == "on"
                    return {
                        "state": "on" if is_on else "standby",
                        "is_ready": True,
                        "message": f"Samsung TV at {self.tv_ip} is {'ON' if is_on else 'in standby'}.",
                        "configured_ip": self.tv_ip,
                        "configured_mac": self.tv_mac,
                        "token": self.token,
                        "device_name": device.get("name", "Samsung Smart TV"),
                        "model": device.get("modelName", ""),
                    }
                else:
                    return {
                        "state": "error",
                        "is_ready": False,
                        "message": f"Samsung REST API returned HTTP {resp.status_code}.",
                        "configured_ip": self.tv_ip,
                        "configured_mac": self.tv_mac,
                        "token": self.token,
                    }
        except Exception as e:
            return {
                "state": "offline",
                "is_ready": False,
                "message": f"TV at {self.tv_ip} is unreachable. Make sure it is on the same network and has REST API enabled. ({type(e).__name__})",
                "configured_ip": self.tv_ip,
                "configured_mac": self.tv_mac,
                "token": self.token,
            }

    # -------------------------------------------------------------------------
    # Wake-on-LAN
    # -------------------------------------------------------------------------
    def _send_wol_packet(self) -> bool:
        """Send a Wake-on-LAN magic packet to the TV's MAC address."""
        if not self.tv_mac:
            logger.warning("Samsung WoL: No MAC address configured — cannot send magic packet")
            return False
        try:
            mac = self.tv_mac.replace(":", "").replace("-", "").replace(".", "")
            if len(mac) != 12:
                logger.error(f"Samsung WoL: Invalid MAC address format: {self.tv_mac}")
                return False
            mac_bytes = bytes.fromhex(mac)
            magic = b"\xff" * 6 + mac_bytes * 16
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
                sock.sendto(magic, ("255.255.255.255", 9))
            logger.info(f"Samsung WoL: Magic packet sent to {self.tv_mac}")
            return True
        except Exception as e:
            logger.error(f"Samsung WoL: Failed to send magic packet: {e}")
            return False

    # -------------------------------------------------------------------------
    # App launch via Samsung REST API
    # -------------------------------------------------------------------------
    async def launch_app(self, app_id: str | None = None) -> bool:
        """Launch a Tizen app by ID using Samsung REST API (POST /api/v2/applications/{id})."""
        target_id = app_id or self.app_id
        if not self.tv_ip or not target_id:
            logger.warning("Samsung: No TV IP or app ID configured for app launch")
            return False
        try:
            import httpx
            url = f"{self._rest_base}/applications/{target_id}"
            async with httpx.AsyncClient(timeout=8, verify=False) as client:
                resp = await client.post(url)
                if resp.status_code in (200, 201):
                    logger.info(f"Samsung: App {target_id} launch command sent successfully")
                    return True
                logger.warning(f"Samsung: App launch returned {resp.status_code}: {resp.text[:200]}")
                return False
        except Exception as e:
            logger.error(f"Samsung: App launch failed: {e}")
            return False

    # -------------------------------------------------------------------------
    # WebSocket remote key events
    # -------------------------------------------------------------------------
    async def send_key(self, key: str) -> bool:
        """Send a remote control key event via Samsung WebSocket API."""
        if not self.tv_ip:
            return False

        app_name_b64 = base64.b64encode(b"Media Scheduler").decode("utf-8")
        ws_url = self._ws_url + f"?name={app_name_b64}"
        if self.token:
            ws_url += f"&token={self.token}"

        payload = json.dumps({
            "method": "ms.remote.control",
            "params": {
                "Cmd": "Click",
                "DataOfCmd": key,
                "Option": "false",
                "TypeOfRemote": "SendRemoteKey"
            }
        })

        try:
            import websockets
            ssl_ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            ssl_ctx.check_hostname = False
            ssl_ctx.verify_mode = ssl.CERT_NONE

            async with websockets.connect(
                ws_url,
                ssl=ssl_ctx,
                open_timeout=5,
                ping_interval=None,
            ) as ws:
                # First message is the server's hello (may include token)
                hello = await asyncio.wait_for(ws.recv(), timeout=5)
                hello_data = json.loads(hello)
                new_token = hello_data.get("data", {}).get("token")
                if new_token and new_token != self.token:
                    logger.info(f"Samsung: New WebSocket token received: {new_token}")
                    self.token = new_token

                await ws.send(payload)
                logger.info(f"Samsung: Key {key} sent via WebSocket")
                return True
        except Exception as e:
            logger.warning(f"Samsung: WebSocket key {key} failed: {e}")
            return False

    # -------------------------------------------------------------------------
    # BaseTVController implementation
    # -------------------------------------------------------------------------
    async def ensure_awake_and_ready(self) -> bool:
        """
        Wake the Samsung TV from standby and launch the configured app.
        1. Check power state via REST API
        2. If off/standby: send WoL packet (works when TV is fully off + WoWLAN enabled)
           AND send KEY_POWER via WebSocket (works when TV is in warm standby)
        3. Wait for TV to boot (up to 15s)
        4. Launch the configured Tizen app (Jellyfin / Plex)
        """
        if not self.tv_ip:
            logger.info("No Samsung TV IP configured, skipping wake")
            return True

        awake = await self.is_screen_on()
        if awake:
            logger.info(f"Samsung TV at {self.tv_ip} is already ON — launching app directly")
        else:
            logger.info(f"Samsung TV at {self.tv_ip} is OFF/standby — sending wake commands")
            # Send WoL (for fully powered off)
            self._send_wol_packet()
            # Also try WebSocket KEY_POWER (for warm standby)
            await self.send_key("KEY_POWER")
            await asyncio.sleep(1)
            await self.send_key("KEY_WAKEUP")

            # Wait for TV to become reachable (up to 15s)
            logger.info("Waiting for Samsung TV to boot...")
            for _ in range(6):
                await asyncio.sleep(2.5)
                if await self.is_screen_on():
                    logger.info("Samsung TV is now ON")
                    break
            else:
                logger.warning("Samsung TV did not confirm ON state within timeout — attempting app launch anyway")

        # Launch the app
        await asyncio.sleep(1)
        launched = await self.launch_app()
        if not launched:
            logger.warning(f"Samsung: Failed to launch app {self.app_id} — may need to retry after TV fully boots")
        return True

    async def turn_off_tv(self) -> bool:
        """Put Samsung TV to standby via WebSocket KEY_POWER."""
        if not self.tv_ip:
            return False
        logger.info(f"Sending KEY_POWER (standby) to Samsung TV at {self.tv_ip}")
        return await self.send_key("KEY_POWER")
