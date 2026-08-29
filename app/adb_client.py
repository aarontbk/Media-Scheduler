import asyncio
import logging
import os
from app.config import get_settings

logger = logging.getLogger(__name__)

# Ensure ADB stores keys in persistent /data directory if available
if os.path.exists("/data"):
    android_dir = "/data/.android"
    os.makedirs(android_dir, exist_ok=True)
    os.environ["ADB_VENDOR_KEYS"] = android_dir

class ADBClient:
    """ADB-over-network client for controlling Android TV with guided connection flow."""
    
    def __init__(self, tv_ip: str | None = None, adb_port: int | None = None):
        settings = get_settings()
        self.tv_ip = (tv_ip if tv_ip is not None else settings.tv_ip).strip()
        self.adb_port = adb_port if adb_port is not None else settings.adb_port
        self.tv_address = f"{self.tv_ip}:{self.adb_port}" if self.tv_ip else ""
    
    async def _run_adb(self, *args: str, timeout: float = 10) -> tuple[int, str, str]:
        """Run an ADB command and return (returncode, stdout, stderr)."""
        cmd = ["adb", *args]
        logger.debug(f"Running ADB: {' '.join(cmd)}")
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            return proc.returncode, stdout.decode("utf-8", errors="ignore").strip(), stderr.decode("utf-8", errors="ignore").strip()
        except asyncio.TimeoutError:
            logger.warning(f"ADB command timed out: {' '.join(cmd)}")
            try:
                proc.kill()
            except Exception:
                pass
            return -1, "", "timeout"
        except FileNotFoundError:
            logger.error("ADB binary not found. Ensure 'android-tools-adb' is installed.")
            return -1, "", "adb binary not found"
        except Exception as e:
            logger.error(f"Unexpected error running ADB {' '.join(cmd)}: {e}")
            return -1, "", str(e)
    
    async def get_detailed_status(self, target_ip: str | None = None, target_port: int | None = None) -> dict:
        """
        Check the connection and authorization status of the Android TV.
        Returns:
            state: 'device' | 'unauthorized' | 'offline' | 'cannot_connect' | 'not_configured'
            message: Human-friendly explanation with step-by-step guidance
            is_ready: Boolean whether TV is ready to receive commands
        """
        ip = (target_ip or self.tv_ip).strip()
        port = target_port or self.adb_port
        
        if not ip:
            return {
                "configured_ip": "",
                "configured_port": port,
                "state": "not_configured",
                "is_ready": False,
                "message": "No TV IP address configured. Enter your TV's local IP address above to begin.",
            }
            
        address = f"{ip}:{port}"
        
        # Check current devices list first
        rc, devices_out, _ = await self._run_adb("devices", "-l")
        
        # Look for the device in the adb devices output
        found_state = None
        for line in devices_out.splitlines():
            line = line.strip()
            if not line or line.startswith("List of devices"):
                continue
            parts = line.split()
            if len(parts) >= 2 and parts[0] == address:
                found_state = parts[1]
                break
                
        # If not connected yet or not in list, try to connect
        if not found_state:
            rc_conn, conn_out, conn_err = await self._run_adb("connect", address, timeout=8)
            rc, devices_out, _ = await self._run_adb("devices", "-l")
            for line in devices_out.splitlines():
                parts = line.strip().split()
                if len(parts) >= 2 and parts[0] == address:
                    found_state = parts[1]
                    break
            if not found_state:
                if "refused" in conn_out.lower() or "refused" in conn_err.lower() or "cannot connect" in conn_out.lower():
                    found_state = "cannot_connect"
                else:
                    found_state = "offline"

        # Categorize state and return clear guidance
        if found_state == "device":
            return {
                "configured_ip": ip,
                "configured_port": port,
                "state": "device",
                "is_ready": True,
                "message": f"Connected & Authorized! The TV at {address} is ready to be woken and controlled automatically.",
            }
        elif found_state == "unauthorized":
            return {
                "configured_ip": ip,
                "configured_port": port,
                "state": "unauthorized",
                "is_ready": False,
                "message": "PROMPT ON TV SCREEN: Please check your TV screen right now! A dialog 'Allow USB debugging?' has appeared. Check 'Always allow from this computer' and select OK with your TV remote, then click 'Verify Connection'.",
            }
        elif found_state == "cannot_connect":
            return {
                "configured_ip": ip,
                "configured_port": port,
                "state": "cannot_connect",
                "is_ready": False,
                "message": f"Cannot reach TV at {address}. Ensure the TV is turned ON, connected to the same network, and 'Network Debugging' or 'USB Debugging' is enabled in Developer Options.",
            }
        else:
            return {
                "configured_ip": ip,
                "configured_port": port,
                "state": "offline",
                "is_ready": False,
                "message": f"TV is currently offline or unreachable at {address}. Make sure the TV is powered on and connected to Wi-Fi/Ethernet.",
            }

    async def connect(self, target_ip: str | None = None, target_port: int | None = None) -> dict:
        """Explicitly trigger an ADB connect attempt and return the new status."""
        ip = (target_ip or self.tv_ip).strip()
        port = target_port or self.adb_port
        if not ip:
            return {"success": False, "state": "not_configured", "message": "Please enter a valid TV IP address."}
            
        address = f"{ip}:{port}"
        logger.info(f"Connecting to ADB device at {address}...")
        
        # Run adb connect
        rc, stdout, stderr = await self._run_adb("connect", address, timeout=8)
        
        # Get updated detailed status
        status = await self.get_detailed_status(ip, port)
        status["raw_output"] = stdout or stderr
        status["success"] = status["is_ready"]
        return status

    async def disconnect(self, target_ip: str | None = None, target_port: int | None = None) -> bool:
        """Disconnect from the TV."""
        ip = (target_ip or self.tv_ip).strip()
        port = target_port or self.adb_port
        address = f"{ip}:{port}"
        rc, _, _ = await self._run_adb("disconnect", address)
        return rc == 0

    async def is_reachable(self) -> bool:
        """Check if TV is reachable and authorized."""
        if not self.tv_address:
            return False
        status = await self.get_detailed_status()
        return status["is_ready"]

    async def wake_screen(self) -> bool:
        """Send KEYCODE_WAKEUP to turn on the TV display."""
        if not self.tv_address:
            return False
        rc, stdout, stderr = await self._run_adb(
            "-s", self.tv_address, "shell", "input", "keyevent", "KEYCODE_WAKEUP"
        )
        if rc == 0:
            logger.info(f"TV screen wake command sent to {self.tv_address}")
            return True
        logger.warning(f"Wake screen failed: {stderr}")
        return False

    async def launch_jellyfin(self) -> bool:
        """Launch the official Jellyfin Android TV application."""
        if not self.tv_address:
            return False
        rc, stdout, stderr = await self._run_adb(
            "-s", self.tv_address, "shell",
            "am", "start", "-n",
            "org.jellyfin.androidtv/.ui.startup.StartupActivity"
        )
        if rc == 0:
            logger.info(f"Jellyfin app launch command sent to {self.tv_address}")
            return True
        logger.warning(f"Launch Jellyfin failed: {stderr}")
        return False

    async def send_home(self) -> bool:
        """Send KEYCODE_HOME key event."""
        if not self.tv_address:
            return False
        rc, _, _ = await self._run_adb(
            "-s", self.tv_address, "shell", "input", "keyevent", "KEYCODE_HOME"
        )
        return rc == 0

    async def wake_and_prepare(self) -> bool:
        """Full wake-up workflow: connect -> wake -> home -> launch Jellyfin."""
        if not self.tv_address:
            logger.warning("No TV address configured for wake_and_prepare")
            return False
            
        logger.info(f"Starting TV wake-up sequence for {self.tv_address}")
        
        # Step 1: Connect
        conn_res = await self.connect()
        if not conn_res["is_ready"] and conn_res["state"] != "unauthorized":
            logger.error(f"Failed to connect via ADB: {conn_res['message']}")
            return False
            
        # Step 2: Wake screen
        await self.wake_screen()
        await asyncio.sleep(2)
        
        # Step 3: Press HOME to reset state
        await self.send_home()
        await asyncio.sleep(1)
        
        # Step 4: Launch Jellyfin
        launched = await self.launch_jellyfin()
        if not launched:
            logger.warning("Failed to launch Jellyfin app via ADB")
            return False
            
        logger.info("TV wake-up sequence completed successfully")
        return True
