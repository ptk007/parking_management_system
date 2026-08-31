# Changes from the supplied python(1).rar

- Unified single- and multi-camera execution under `multi_camera.py`.
- Added `launcher.py` and interactive Create -> Edit -> Select -> Confirm -> Run sequence.
- Added ordered, confirmed `cctv/parking-cam/active.json` schema.
- Centralized paths in `project_paths.py` and grouped all runtime assets under one root.
- Removed automatic CPU fallback from runtime BAT files.
- `install.bat` installs/verifies CUDA PyTorch before the rest of the AI stack.
- Improved `check_gpu.py` with a real CUDA tensor operation.
- Fixed `print_threshold_config()` dead/unreachable code.
- Stopped rewriting BoT-SORT YAML on every startup.
- Kept low-latency latest-frame RTSP capture and removed the second reconnect owner in the worker.
- Masked RTSP credentials from normal console/result output.
- Restored Thai/Unicode car-label drawing using one Pillow conversion per rendered frame.
- Replaced timestamp-per-run result files with stable snapshots plus append-only/deduplicated parking history.
- Added periodic and parking-transition result persistence.
- Added worker supervision/restart handling in `multi_camera.py`.
- Removed `.venv`, `__pycache__`, `run_parking.bat`, and `parking_profiles.bat` from the clean package.
