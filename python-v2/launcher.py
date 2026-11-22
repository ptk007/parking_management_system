"""Start YOLO workers from the CCTV presets configured in the backend."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
import os
import re

PROJECT_DIR = Path(__file__).resolve().parent
BACKEND_ENV_FILE = PROJECT_DIR.parent / "parking-back" / ".env"


def _read_backend_setting(name: str) -> str:
    """Read one non-exported setting from the backend .env file."""
    try:
        lines = BACKEND_ENV_FILE.read_text(encoding="utf-8-sig").splitlines()
    except OSError:
        return ""
    for line in lines:
        match = re.match(rf"^\s*(?:export\s+)?{re.escape(name)}\s*=\s*(.*?)\s*$", line)
        if not match:
            continue
        value = match.group(1)
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        elif " #" in value:
            value = value.split(" #", 1)[0].rstrip()
        return value
    return ""


def configure_backend_sync() -> None:
    """Connect run.bat's Python runtime to this repository's backend by default."""
    if not os.environ.get("PARKING_MODEL_API_KEY", "").strip():
        key = _read_backend_setting("PARKING_MODEL_API_KEY")
        if key:
            os.environ["PARKING_MODEL_API_KEY"] = key

    port = os.environ.get("PORT", "").strip() or _read_backend_setting("PORT") or "3000"
    base_url = f"http://localhost:{port}/api"
    if not os.environ.get("PARKING_MODEL_RUNTIME_URL", "").strip():
        os.environ["PARKING_MODEL_RUNTIME_URL"] = f"{base_url}/model-runtime/sync"
    if not os.environ.get("PARKING_MODEL_EVENTS_URL", "").strip():
        os.environ["PARKING_MODEL_EVENTS_URL"] = f"{base_url}/parking-logs/model-events"

    if not os.environ.get("PARKING_MODEL_API_KEY", "").strip():
        os.environ.pop("PARKING_MODEL_RUNTIME_URL", None)
        os.environ.pop("PARKING_MODEL_EVENTS_URL", None)
        print(
            "[Parking API] Backend sync is not configured: set PARKING_MODEL_API_KEY "
            "in parking-back/.env or the environment. Backend preset startup "
            "cannot continue without this key."
        )
    else:
        print("[Parking API] Backend preset control and parking-log sync are configured.")


def main() -> int:
    configure_backend_sync()
    if not os.environ.get("PARKING_MODEL_API_KEY", "").strip():
        return 1
    command = [sys.executable, str(PROJECT_DIR / "multi_camera.py"), "--backend-presets"]
    return subprocess.call(command, cwd=PROJECT_DIR)


if __name__ == "__main__":
    raise SystemExit(main())
