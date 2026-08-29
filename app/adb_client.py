import asyncio
import logging
from app.config import get_settings

logger = logging.getLogger(__name__)

class ADBClient:
    """ADB-over-network client for controlling Android TV."""
    
    def __init__(self):
        """Initialize the ADBClient."""
        self.settings = get_settings()
        self.tv_address = f"{self.settings.tv_ip}:{self.settings.adb_port}"
    
    async def _run_adb(self, *args: str, timeout: float = 10) -> tuple[int, str, str]:
        """
        Run an ADB command and return (returncode, stdout, stderr).
        
        Args:
            *args: Command arguments.
            timeout: Timeout in seconds.
            
        Returns:
            Tuple containing return code, stdout, and stderr.
        """
        cmd = ["adb", *args]
        logger.debug(f"Running: {' '.join(cmd)}")
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            return proc.returncode, stdout.decode().strip(), stderr.decode().strip()
        except asyncio.TimeoutError:
            logger.warning(f"ADB command timed out: {' '.join(cmd)}")
            try:
                proc.kill()
            except Exception as e:
                logger.error(f"Failed to kill proc after timeout: {e}")
            return -1, "", "timeout"
        except FileNotFoundError:
            logger.error("ADB binary not found. Ensure 'adb' is installed and in PATH.")
            return -1, "", "adb not found"
        except Exception as e:
            logger.error(f"Unexpected error running ADB command {' '.join(cmd)}: {e}")
            return -1, "", str(e)
    
    async def connect(self) -> bool:
        """
        Connect to the TV over ADB network.
        
        Returns:
            True if connected, False otherwise.
        """
        try:
            rc, stdout, stderr = await self._run_adb("connect", self.tv_address)
            connected = rc == 0 and ("connected" in stdout.lower() or "already connected" in stdout.lower())
            if connected:
                logger.info(f"ADB connected to {self.tv_address}")
            else:
                logger.warning(f"ADB connect failed: {stdout} {stderr}")
            return connected
        except Exception as e:
            logger.error(f"Error during connect: {e}")
            return False
    
    async def disconnect(self) -> None:
        """Disconnect from the TV."""
        try:
            await self._run_adb("disconnect", self.tv_address)
        except Exception as e:
            logger.error(f"Error during disconnect: {e}")
    
    async def is_reachable(self) -> bool:
        """
        Check if the TV is reachable via ADB.
        
        Returns:
            True if reachable, False otherwise.
        """
        try:
            rc, stdout, _ = await self._run_adb("devices")
            return self.tv_address in stdout and "device" in stdout
        except Exception as e:
            logger.error(f"Error during is_reachable: {e}")
            return False
    
    async def wake_screen(self) -> bool:
        """
        Send WAKEUP key event to turn on the screen.
        
        Returns:
            True if successful, False otherwise.
        """
        try:
            rc, stdout, stderr = await self._run_adb(
                "-s", self.tv_address, "shell", "input", "keyevent", "KEYCODE_WAKEUP"
            )
            if rc == 0:
                logger.info("TV screen wake command sent")
                return True
            logger.warning(f"Wake screen failed: {stderr}")
            return False
        except Exception as e:
            logger.error(f"Error during wake_screen: {e}")
            return False
    
    async def launch_jellyfin(self) -> bool:
        """
        Launch the Jellyfin Android TV app.
        
        Returns:
            True if successful, False otherwise.
        """
        try:
            rc, stdout, stderr = await self._run_adb(
                "-s", self.tv_address, "shell",
                "am", "start", "-n",
                "org.jellyfin.androidtv/.ui.startup.StartupActivity"
            )
            if rc == 0:
                logger.info("Jellyfin app launch command sent")
                return True
            logger.warning(f"Launch Jellyfin failed: {stderr}")
            return False
        except Exception as e:
            logger.error(f"Error during launch_jellyfin: {e}")
            return False
    
    async def send_home(self) -> bool:
        """
        Send HOME key event.
        
        Returns:
            True if successful, False otherwise.
        """
        try:
            rc, _, stderr = await self._run_adb(
                "-s", self.tv_address, "shell", "input", "keyevent", "KEYCODE_HOME"
            )
            return rc == 0
        except Exception as e:
            logger.error(f"Error during send_home: {e}")
            return False
    
    async def wake_and_prepare(self) -> bool:
        """
        Full wake-up sequence: connect -> wake -> launch Jellyfin.
        
        Returns:
            True if successful, False otherwise.
        """
        try:
            logger.info(f"Starting TV wake-up sequence for {self.tv_address}")
            
            # Step 1: Connect
            if not await self.connect():
                logger.error("Failed to connect via ADB")
                return False
            
            # Step 2: Wake screen
            await self.wake_screen()
            await asyncio.sleep(2)  # Wait for screen to turn on
            
            # Step 3: Press HOME to ensure we're at a known state
            await self.send_home()
            await asyncio.sleep(1)
            
            # Step 4: Launch Jellyfin
            if not await self.launch_jellyfin():
                logger.error("Failed to launch Jellyfin app")
                return False
            
            logger.info("TV wake-up sequence completed")
            return True
        except Exception as e:
            logger.error(f"Error during wake_and_prepare: {e}")
            return False
