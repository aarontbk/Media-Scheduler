"""
Provider factory — instantiates the correct media provider and TV controller
based on the active configuration settings.
"""
from app.media_provider import BaseMediaProvider
from app.tv_controller import BaseTVController


def get_media_provider(cfg: dict) -> BaseMediaProvider:
    """
    Return the configured media provider instance.
    Uses `media_provider` setting: "jellyfin" (default) | "plex"
    """
    provider = cfg.get("media_provider", "jellyfin").lower()

    if provider == "plex":
        from app.plex_client import PlexClient
        return PlexClient(
            base_url=cfg.get("plex_url", ""),
            token=cfg.get("plex_token", ""),
            player_ip=cfg.get("plex_player_ip", ""),
            player_machine_id=cfg.get("plex_client_id", ""),
            tv_device_name=cfg.get("tv_device_name", ""),
        )

    # Default: Jellyfin
    from app.jellyfin_client import JellyfinClient
    return JellyfinClient(
        base_url=cfg.get("jellyfin_url", ""),
        api_key=cfg.get("jellyfin_api_key", ""),
        user_id=cfg.get("jellyfin_user_id", ""),
        tv_device_name=cfg.get("tv_device_name", ""),
    )


def get_tv_controller(cfg: dict) -> BaseTVController:
    """
    Return the configured TV controller instance.
    Uses `tv_type` setting: "android" (default) | "samsung"
    """
    tv_type = cfg.get("tv_type", "android").lower()

    if tv_type == "samsung":
        from app.samsung_tv import SamsungTVClient
        return SamsungTVClient(
            tv_ip=cfg.get("samsung_tv_ip", ""),
            tv_mac=cfg.get("samsung_tv_mac", ""),
            app_id=cfg.get("samsung_app_id", ""),
            app_name=cfg.get("media_provider", "jellyfin"),
            token=cfg.get("samsung_ws_token"),
        )

    # Default: Android TV via ADB
    from app.adb_client import ADBClient
    return ADBClient(
        tv_ip=cfg.get("tv_ip", ""),
        adb_port=cfg.get("adb_port", 5555),
    )
