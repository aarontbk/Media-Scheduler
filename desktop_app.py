"""
Media Scheduler - Standalone Desktop Application
Wraps the FastAPI + APScheduler backend with a native Windows desktop window (WebView2)
and System Tray integration for seamless background playback scheduling.
"""

import sys
import os
import io
import time
import socket
import logging
import threading
import webbrowser
import multiprocessing
from PIL import Image

# Ensure standard streams exist when run with console=False (windowed mode)
class NullWriter:
    def write(self, s): pass
    def flush(self): pass
    def isatty(self): return False

if sys.stdout is None:
    sys.stdout = NullWriter()
if sys.stderr is None:
    sys.stderr = NullWriter()

# Ensure standard app paths
def get_base_dir() -> str:
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))

BASE_DIR = get_base_dir()
sys.path.insert(0, BASE_DIR)

# Configure logging in user AppData directory
from app.config import get_data_dir

data_dir = get_data_dir()
log_file = os.path.join(data_dir, "desktop_app.log")

file_handler = logging.FileHandler(log_file, encoding="utf-8")
file_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))

root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO)
root_logger.addHandler(file_handler)

logger = logging.getLogger("desktop_app")

# Global references
server_instance = None
tray_icon = None
main_window = None
app_port = 8081
is_quitting = False


def find_free_port(preferred: int = 8081) -> int:
    """Find an available port starting from preferred."""
    for p in range(preferred, preferred + 50):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", p)) != 0:
                return p
    return preferred


def run_uvicorn_server(port: int):
    """Run Uvicorn FastAPI server in background thread."""
    global server_instance
    try:
        import uvicorn
        from app.main import app

        # Build clean logging config without color formatting (avoids isatty error in windowed mode)
        clean_log_config = {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
                },
            },
            "handlers": {
                "file": {
                    "class": "logging.FileHandler",
                    "filename": log_file,
                    "formatter": "default",
                    "encoding": "utf-8",
                },
            },
            "loggers": {
                "uvicorn": {"handlers": ["file"], "level": "INFO", "propagate": False},
                "uvicorn.error": {"level": "INFO"},
                "uvicorn.access": {"handlers": ["file"], "level": "INFO", "propagate": False},
            },
        }

        config = uvicorn.Config(
            app,
            host="127.0.0.1",
            port=port,
            log_config=clean_log_config,
            loop="asyncio",
            lifespan="on",
        )
        server_instance = uvicorn.Server(config)
        logger.info(f"Starting embedded backend on http://127.0.0.1:{port}")
        server_instance.run()
    except Exception as e:
        logger.exception(f"Fatal error in run_uvicorn_server: {e}")


def wait_for_server(port: int, timeout: float = 20.0) -> bool:
    """Wait until the backend server responds to connections."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.5):
                return True
        except (OSError, ConnectionRefusedError):
            time.sleep(0.15)
    return False


def get_app_icon_image() -> Image.Image:
    """Load application icon for window and system tray."""
    for icon_name in ["logo.png", "logo.ico"]:
        for parent in [os.path.join(BASE_DIR, "frontend"), "frontend", BASE_DIR]:
            cand = os.path.join(parent, icon_name)
            if os.path.exists(cand):
                try:
                    return Image.open(cand)
                except Exception:
                    pass
    return Image.new("RGB", (64, 64), color=(99, 102, 241))


def create_tray_icon(url: str):
    """Create Windows system tray icon."""
    global tray_icon
    import pystray

    icon_img = get_app_icon_image()

    def on_show_window(icon, item):
        global main_window
        if main_window:
            try:
                main_window.show()
                main_window.restore()
            except Exception:
                webbrowser.open(url)
        else:
            webbrowser.open(url)

    def on_open_browser(icon, item):
        webbrowser.open(url)

    def on_quit(icon, item):
        global is_quitting, server_instance, main_window
        is_quitting = True
        logger.info("Quitting Media Scheduler from system tray...")
        if icon:
            icon.stop()
        if main_window:
            try:
                main_window.destroy()
            except Exception:
                pass
        if server_instance:
            server_instance.should_exit = True
        sys.exit(0)

    menu = pystray.Menu(
        pystray.MenuItem("Open Media Scheduler", on_show_window, default=True),
        pystray.MenuItem("Open in Browser", on_open_browser),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Quit", on_quit),
    )

    tray_icon = pystray.Icon(
        "MediaScheduler",
        icon_img,
        "Media Scheduler (Background Active)",
        menu=menu,
    )
    return tray_icon


def main():
    global app_port, main_window, tray_icon, is_quitting

    logger.info("Initializing Media Scheduler Desktop Application...")
    app_port = find_free_port(8081)
    app_url = f"http://127.0.0.1:{app_port}"

    # Start FastAPI in background daemon thread
    server_thread = threading.Thread(target=run_uvicorn_server, args=(app_port,), daemon=True)
    server_thread.start()

    # Wait for server readiness
    if not wait_for_server(app_port, timeout=20.0):
        logger.error("Backend server failed to start within timeout.")
    else:
        logger.info(f"Backend server is UP and accepting connections on {app_url}")

    # Start system tray in background thread
    try:
        tray = create_tray_icon(app_url)
        tray_thread = threading.Thread(target=tray.run, daemon=True)
        tray_thread.start()
        logger.info("System tray initialized.")
    except Exception as e:
        logger.warning(f"Could not initialize system tray: {e}")

    # Launch native desktop window using pywebview (Edge WebView2)
    has_gui = False
    try:
        import webview

        logger.info(f"Opening desktop window on {app_url}...")
        main_window = webview.create_window(
            title="Media Scheduler",
            url=app_url,
            width=1280,
            height=840,
            min_size=(800, 550),
            background_color="#0f0f0f",
            text_select=True,
        )

        def on_closing():
            global is_quitting, tray_icon
            if not is_quitting and tray_icon:
                try:
                    if main_window:
                        main_window.hide()
                    if tray_icon:
                        tray_icon.notify(
                            "Media Scheduler is still running in the system tray to handle your schedules.",
                            "Media Scheduler Active",
                        )
                    return False
                except Exception:
                    pass
            return True

        main_window.events.closing += on_closing
        has_gui = True
        webview.start(gui="edgechromium", debug=False)
    except Exception as e:
        logger.warning(f"Native desktop window unavailable ({e}). Falling back to default browser.")
        webbrowser.open(app_url)

    if not has_gui:
        try:
            while not is_quitting:
                time.sleep(1)
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
