"""Interactive entry point for configuring and starting parking CCTV workers."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from parking_profiles import interactive_menu, print_active

PROJECT_DIR = Path(__file__).resolve().parent


def run_active_cctv() -> int:
    print_active()
    command = [sys.executable, str(PROJECT_DIR / "multi_camera.py"), "--active"]
    return subprocess.call(command, cwd=PROJECT_DIR)


def main() -> int:
    action = interactive_menu()
    if action == "start":
        return run_active_cctv()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
