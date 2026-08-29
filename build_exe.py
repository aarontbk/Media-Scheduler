"""
Build script for packaging Media Scheduler into a standalone Windows desktop executable (.exe).
"""

import os
import sys
import subprocess
import shutil

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def build():
    print("=== Building Media Scheduler Desktop Executable ===")
    
    # 1. Verify bin/ contains adb tools
    bin_dir = os.path.join(BASE_DIR, "bin")
    for f in ["adb.exe", "AdbWinApi.dll", "AdbWinUsbApi.dll"]:
        p = os.path.join(bin_dir, f)
        if not os.path.exists(p):
            print(f"Error: Missing {p}. Please ensure ADB binaries are downloaded.")
            sys.exit(1)
        print(f"Verified {f} in bin/")

    # 2. Clean previous build artifacts
    for d in ["build", "dist"]:
        dp = os.path.join(BASE_DIR, d)
        if os.path.exists(dp):
            print(f"Cleaning {d}/...")
            try:
                shutil.rmtree(dp)
            except Exception as e:
                print(f"Notice: {e}")

    # 3. Run PyInstaller
    spec_file = os.path.join(BASE_DIR, "MediaScheduler.spec")
    cmd = [sys.executable, "-m", "PyInstaller", "--noconfirm", spec_file]
    print(f"Running: {' '.join(cmd)}")
    res = subprocess.run(cmd, cwd=BASE_DIR)
    
    if res.returncode != 0:
        print("Build failed!")
        sys.exit(res.returncode)

    exe_path = os.path.join(BASE_DIR, "dist", "MediaScheduler.exe")
    if os.path.exists(exe_path):
        size_mb = os.path.getsize(exe_path) / (1024 * 1024)
        print(f"\n=======================================================")
        print(f" SUCCESS! Standalone executable generated:")
        print(f" Location: {exe_path}")
        print(f" Size: {size_mb:.2f} MB")
        print(f"=======================================================\n")
    else:
        print("Error: Output executable not found in dist/")
        sys.exit(1)

if __name__ == "__main__":
    build()
