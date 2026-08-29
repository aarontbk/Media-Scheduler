# -*- mode: python ; coding: utf-8 -*-

import os
import sys

block_cipher = None

BASE_DIR = os.path.abspath(SPECPATH)

datas = [
    (os.path.join(BASE_DIR, 'frontend'), 'frontend'),
    (os.path.join(BASE_DIR, 'bin'), 'bin'),
]

hiddenimports = [
    'apscheduler',
    'apscheduler.datastores.sqlalchemy',
    'apscheduler.triggers.date',
    'apscheduler.triggers.cron',
    'apscheduler.triggers.interval',
    'apscheduler.eventbrokers.local',
    'apscheduler.eventbrokers.async_local',
    'sqlalchemy.dialects.sqlite.aiosqlite',
    'aiosqlite',
    'sqlite3',
    'pydantic_settings',
    'python_dotenv',
    'wakeonlan',
    'websockets',
    'websockets.legacy',
    'websockets.legacy.client',
    'uvicorn',
    'uvicorn.logging',
    'uvicorn.loops.auto',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.http.h11_impl',
    'uvicorn.protocols.http.httptools_impl',
    'uvicorn.lifespan.on',
    'pystray',
    'pystray._win32',
    'webview',
    'webview.platforms.winforms',
    'webview.platforms.edgechromium',
    'clr_loader',
    'pythonnet',
    'PIL',
    'PIL.Image',
    'zoneinfo',
    'tzdata',
    'tzlocal',
]

a = Analysis(
    [os.path.join(BASE_DIR, 'desktop_app.py')],
    pathex=[BASE_DIR],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'scipy', 'torch', 'torchaudio', 'torchvision', 'pandas', 'IPython'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='MediaScheduler',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=os.path.join(BASE_DIR, 'frontend', 'logo.ico'),
)
