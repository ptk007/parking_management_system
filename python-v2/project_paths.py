"""Central filesystem layout for the parking CCTV runtime.

Every runtime path is kept under one project root so the project can be moved,
archived, or Docker-mounted without hard-coded parent-directory assumptions.
"""

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent

CCTV_DIR = PROJECT_ROOT / "cctv"
CCTV_SOURCE_DIR = CCTV_DIR / "sources"
PROFILE_DIR = CCTV_DIR / "parking-cam"
ACTIVE_FILE = PROFILE_DIR / "active.json"
SELECTION_FILE = PROFILE_DIR / "selection.json"

PARKING_SLOT_DIR = PROJECT_ROOT / "parking_slots"
MODEL_DIR = PROJECT_ROOT / "models"
TRACKER_DIR = PROJECT_ROOT / "tracker"
RESULTS_DIR = PROJECT_ROOT / "results"
LOG_DIR = PROJECT_ROOT / "logs"

DEFAULT_CCTV_JSON = CCTV_SOURCE_DIR / "oldcctvinfo4.json"
DEFAULT_PARKING_JSON = PARKING_SLOT_DIR / "E4_zoneA_cars.json"
DEFAULT_TRACKER_CONFIG = TRACKER_DIR / "parking_botsort_reid.yaml"


def ensure_runtime_directories() -> None:
    for path in (
        CCTV_SOURCE_DIR,
        PROFILE_DIR,
        PARKING_SLOT_DIR,
        MODEL_DIR,
        TRACKER_DIR,
        RESULTS_DIR,
        LOG_DIR,
    ):
        path.mkdir(parents=True, exist_ok=True)


def resolve_project_path(value, *, preferred_dir: Path | None = None) -> Path:
    """Resolve an absolute or project-relative path without depending on cwd."""
    path = Path(value).expanduser()
    if path.is_absolute():
        return path

    candidates = []
    if preferred_dir is not None:
        candidates.append(preferred_dir / path)
        candidates.append(preferred_dir / path.name)
    candidates.extend((PROJECT_ROOT / path, path))

    for candidate in candidates:
        if candidate.exists():
            return candidate.resolve()

    return (PROJECT_ROOT / path).resolve()


ensure_runtime_directories()
