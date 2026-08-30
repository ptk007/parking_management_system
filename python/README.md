# CCTV RTSP Viewer

This folder contains a small Windows Python viewer for the RTSP links in:

`..\parking-backend\src\oldcctvinfo4.json`

and:

`..\parking-backend\src\cctvinfo2.json`

It can also read `oldcctv4.json` or `oldcctvinfo4.json` if you place either file directly in this `python` folder.

The viewer supports Python 3.8 and newer. The installer selects a compatible
OpenCV package for the installed Python version.

## Install

Open PowerShell or Command Prompt:

```bat
cd C:\Users\patta\Documents\GitHub\parking_management_system\python
install.bat
```

## List Cameras

Older CCTV file:

```bat
run.bat --source old --list
```

Newer CCTV file:

```bat
run.bat --source new --list
```

Both files:

```bat
run.bat --source all --list
```

Automatically use the first available CCTV file:

```bat
run.bat --source auto --list
```

Search by name or IP:

```bat
run.bat --search AD1
run.bat --search 172.28.109.31
run.bat --source new --search Guardhouse
run.bat --source all --search ANPR
```

## Watch One Camera

Use the camera `NO` from the JSON:

```bat
run.bat --camera 1
```

Use the newer `cctvinfo2.json`:

```bat
run.bat --source new --camera 1
```

Use the older `oldcctvinfo4.json`:

```bat
run.bat --source old --camera 344
```

Or use a camera name/IP:

```bat
run.bat --camera AD1-FL1-East
run.bat --camera 172.28.109.31
```

Press `q` or `Esc` to close the video window.

## Realtime Parking Monitor

The parking monitor reads the selected CCTV RTSP stream, uses the YOLO models
from `..\yolo_models`, and uses the Zone A parking annotations by default.

```bat
run_parking.bat --camera 1 --parking on
```

Disable parking-slot detection while keeping car and plate recognition:

```bat
run_parking.bat --camera 1 --parking off
```

Useful options:

```bat
run_parking.bat --camera Guardhouse-ANPR-01 --parking on
run_parking.bat --video "rtsp://user:password@camera/stream" --parking off
python parkng_model.py --help
```

Press `q` or `Esc` in the `Parking CCTV` window to stop the realtime monitor.

When the monitor stops normally, with `q`/`Esc`, or with `Ctrl+C`, it exports
the final in-memory results to `..\results`:

- `parking_result_<timestamp>.json`: complete run summary, car results, and slot results
- `parking_result_<timestamp>_cars.csv`: one row per detected car
- `parking_result_<timestamp>_slots.csv`: one row per parking slot
- `parking_result_<timestamp>_history.csv`: completed parking visits with slot, plate, dates, times, and duration

Each slot also includes `date_parking` and `parking_time` when it changes from
`occupied` to `parking`, then `date_exited` and `exited_time` after confirmed
exit. The JSON `parking_history` list keeps completed visits for later history
screens and reports. Timestamps are recorded in UTC.

Use a different output folder or disable exporting when needed:

```bat
run_parking.bat --camera 1 --export-dir "D:\parking-results"
run_parking.bat --camera 1 --no-export
```

## Multiple CCTV Cameras

Create and confirm a reusable camera profile. The interactive creator asks for
the CCTV JSON, camera selector, parking-slot JSON, and selected parking slots:

```bat
python parking_profiles.py create
python parking_profiles.py list
python parking_profiles.py edit PROFILE_NAME
python parking_profiles.py confirm PROFILE_NAME
python parking_profiles.py confirm --all
python parking_profiles.py active
```

Profiles are stored in `..\cctv\parking-cam`. The confirmed profile can be
started directly:

```bat
run_multi_camera.bat --active
```

`active.json` may contain one profile or multiple profiles. To run every saved
profile together, use `confirm --all` and then `run_multi_camera.bat --active`.

Run one isolated model worker per camera. This keeps each camera's tracker,
plate memory, parking state, and history independent:

```bat
run_multi_camera.bat --cameras 1,2,3 --parking on
```

Run several saved profiles, each with its own camera and parking-slot file:

```bat
run_multi_camera.bat --profiles E4-East,E4-West --parking on
```

Camera numbers, list indexes, names, and IP addresses are accepted:

```bat
run_multi_camera.bat --cameras 344,AD1-FL1-East,172.28.109.31 --parking on
```

Every worker uses the same YOLO/EasyOCR settings as the single-camera monitor.
Results are separated automatically into `..\results\camera_<NO>`. Use
`--parking-json` when all cameras share one slot annotation file, or use
`--parking off` when cameras do not have parking-slot annotations.

Each camera starts its own model process, which is safer for BoT-SORT identity
tracking but uses additional GPU memory. Start only as many concurrent cameras
as the GPU can support; for a small GPU, run fewer cameras at a time.

The monitor now keeps CLI configuration in `parking_config.py` and result
serialization in `parking_export.py`. Both modules are independent from the
YOLO/EasyOCR runtime and can be tested or reused without opening a camera.

## Notes

- You must be on the same network or VPN that can reach the CCTV IP addresses.
- If a stream does not open, test the RTSP URL in VLC first.
- The JSON field used for RTSP is `ANPR&PTZ RTSP`.
- Cameras with an empty RTSP field are skipped in the list because there is no stream URL to open.
- Newer JSON files may use aliases such as `rtspUrl`, `streamUrl`, `cameraName`, or `ipAddress`.
- With `--source all`, duplicate camera numbers must be selected by camera name or IP address.
