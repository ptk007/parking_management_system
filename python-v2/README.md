# Parking CCTV Runtime v2

Production-oriented Windows runtime for:

- CCTV RTSP input
- YOLO car detection
- BoT-SORT + ReID tracking
- YOLO license-plate detection
- EasyOCR Thai plate reading
- Parking-slot state tracking
- Persistent parking history

## Project layout

```text
parking_runtime_v2/
├─ run.bat                    # primary interactive entry point
├─ run_multi_camera.bat       # direct runner for confirmed active CCTV(s)
├─ install.bat
├─ launcher.py
├─ parkng_model.py            # one isolated camera worker
├─ multi_camera.py            # supervisor for one or many workers
├─ parking_model_events.py    # asynchronous backend parking-event publisher
├─ parking_profiles.py        # create/edit/select/confirm CCTV profiles
├─ cctv_viewer.py             # CCTV JSON + low-latency RTSP reader
├─ parking_config.py
├─ parking_export.py
├─ project_paths.py           # central path definitions
├─ check_gpu.py
├─ requirements.txt
│
├─ models/
│  ├─ trained_car_detector.pt
│  └─ best_license_plate_detector.pt
│
├─ tracker/
│  └─ parking_botsort_reid.yaml
│
├─ cctv/
│  ├─ sources/
│  │  ├─ oldcctvinfo4.json
│  │  └─ cctvinfo2.json
│  └─ parking-cam/
│     ├─ active.json          # confirmed CCTV selection
│     ├─ selection.json       # temporary selection before confirmation
│     └─ <profile>.json       # saved CCTV profiles
│
├─ parking_slots/
│  └─ <zone>.json
│
├─ results/
└─ logs/
```

Everything is kept under one project root. Move the whole folder together; do
not depend on `..\yolo_models`, `..\json_file`, or another repository folder.

## First install

1. Copy the two trained `.pt` files into `models/`.
2. Copy parking-slot COCO JSON files into `parking_slots/`.
3. Confirm the CCTV source JSON files under `cctv/sources/`.
4. Run:

```bat
install.bat
```

The installer is GPU-first. It will not silently install/run CPU PyTorch for the
realtime parking application. The default PyTorch wheel index is CUDA 12.6 and
can be overridden with `PARKING_TORCH_INDEX_URL` before running `install.bat`.

## Normal startup sequence

Run:

```bat
run.bat
```

The setup menu is:

```text
1. Create CCTV profile
2. Edit saved CCTV profile
3. Load / select saved CCTV profile(s)
4. Confirm selected CCTV profile(s)
5. Start confirmed CCTV profile(s)
0. Exit
```

### Optional parking-management API sync and YOLO control

The Python supervisor can accept per-camera YOLO ON/OFF commands from the
backend, and workers can send stable plate detections and parking/exit
transitions. Set these environment variables in the same Windows environment
that starts `run.bat` (child camera workers inherit them):

```bat
set "PARKING_MODEL_RUNTIME_URL=http://localhost:5000/api/model-runtime/sync"
set "PARKING_MODEL_EVENTS_URL=http://localhost:5000/api/parking-logs/model-events"
set "PARKING_MODEL_API_KEY=replace-with-the-same-private-value-as-the-backend"
```

`PARKING_MODEL_API_KEY` must match the backend's private environment value. Do
not commit the key or place it in frontend configuration. Replace port `5000`
with the backend's configured port if needed. The confirmed profiles in
`cctv/parking-cam/active.json` are the only cameras this supervisor can control.
The backend ON command is remembered in MongoDB, so the supervisor starts
enabled cameras after `run.bat` starts again. An ON request is rejected if the
preset is disabled, lacks parking-slot categories/map assignments, or has an
ambiguous camera identity. If the local confirmed profile is absent or its
parking JSON does not contain every mapped slot category, the preset reports an
error instead of starting the wrong worker.

When `PARKING_MODEL_RUNTIME_URL` is configured, `multi_camera.py` waits for
backend commands and starts/stops each worker independently. If it is not
configured, the existing behavior remains: every confirmed profile starts.
`PARKING_MODEL_EVENTS_URL` enables database event updates; configure both URLs
for YOLO control plus parking map/history updates. Events are queued and retried
outside the frame-processing thread; API/configuration failures are printed to
the worker or supervisor console. Worker status is written under that camera's
results directory and reported to the backend on each supervisor heartbeat.
When remote control is enabled, `multi_camera.py` gives each worker a
`PARKING_RUNTIME_FRAME_FILE` path under `results/runtime_frames/`; the filename
is derived from the normalized camera number and CCTV source filename. The
worker publishes its rendered frame atomically at no more than 5 FPS, bounded
by the existing 1280×720 display size. The supervisor removes the frame when
that worker stops or restarts, so a stopped camera does not keep showing an old
frame. The backend serves the latest frame to the authenticated admin CCTV
preset preview; it includes car boxes/tracks, detected license-plate
boxes/confidence, OCR labels, and parking-slot overlays. The browser preview
displays actual worker output; the separate raw RTSP preview is used when YOLO
is off. This frame publishing is enabled only in remote-control mode; without
`PARKING_MODEL_RUNTIME_URL`, existing local `run.bat` operation remains
unchanged and does not report YOLO frames to the frontend.

The top of the menu always displays the currently confirmed CCTV selection.
Saved profiles are numbered by sorted profile filename. The selected source
index is stored in `cctv/parking-cam/active.json` after confirmation.

### One camera and many cameras use the same runtime

There is no separate single-camera runtime anymore.

- One confirmed profile -> `multi_camera.py` starts one worker.
- Multiple confirmed profiles -> `multi_camera.py` starts one isolated worker
  per camera.

For direct service/runtime start without opening the setup menu:

```bat
run_multi_camera.bat
```

With no arguments it runs `--active` automatically.

## Profile lifecycle

Creating a profile stores:

- profile name
- CCTV JSON file
- camera NO/name/IP selection
- resolved camera name/IP for display
- parking-slot JSON file
- optional selected parking slots

Option 3 stages one or more saved profiles into `selection.json`. Option 4 is the
explicit confirmation step that writes the confirmed ordered selection into
`active.json`.

## Result files

The old `parking_result_<timestamp>...` pattern is removed.

Each active camera/profile gets one stable result directory such as:

```text
results/E4-East__camera_12/
├─ latest.json
├─ cars_latest.csv
├─ slots_latest.csv
├─ parking_history.csv
└─ runtime_status.json
```

Behavior:

- `latest.json` is overwritten with the latest snapshot.
- `cars_latest.csv` is overwritten with current car state.
- `slots_latest.csv` is overwritten with current parking-slot state.
- `parking_history.csv` keeps the same filename and appends only new completed
  parking visits. Existing visits are deduplicated.
- Parking history includes event date/time plus `recorded_at_utc`,
  `recorded_at_local`, `recorded_date`, and `recorded_time`.
- Runtime data is persisted periodically (default every 15 seconds) and
  immediately after parking start/exit state changes, then once more at clean
  shutdown.

This avoids creating a new result file set every program run and reduces data
loss if a worker terminates unexpectedly.

## GPU behavior

`run.bat` and `run_multi_camera.bat` call `check_gpu.py` before starting.
If CUDA is unavailable, the CCTV workers do not start. This prevents the old
behavior where a broken/CPU-only PyTorch environment silently fell back to CPU
and produced severe realtime lag.

## Tracker configuration

`tracker/parking_botsort_reid.yaml` is now a real configuration file and is not
overwritten by `parkng_model.py` on every startup. Tune it deliberately and keep
it under version control.

## Low-latency CCTV input

`cctv_viewer.LatestFrameCapture` continuously drains RTSP in a background
thread and exposes the latest frame only, avoiding multi-second stale-frame
backlogs. The main worker no longer creates a second competing RTSP reconnect
loop.

## Files intentionally removed from the clean runtime

The clean package does not include:

- `.venv/` — recreate it per machine with `install.bat`.
- `__pycache__/` — generated automatically.
- `run_parking.bat` — redundant; single and multi CCTV now use the same
  `multi_camera.py` path.
- `parking_profiles.bat` — redundant; profile setup is available from `run.bat`.
- Timestamped result files — replaced by persistent stable files.

`cctv_viewer.py` is kept because it is both a useful diagnostic tool and the
shared camera/RTSP layer used by the actual parking workers.
