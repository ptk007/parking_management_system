"""Command-line configuration for the realtime parking monitor."""

import argparse
from pathlib import Path


def add_runtime_arguments(
    parser: argparse.ArgumentParser,
    *,
    project_root: Path,
    default_cctv_json: Path,
    default_parking_json: Path,
) -> argparse.ArgumentParser:
    parser.add_argument(
        '--camera',
        default='1',
        help='Camera NO, list index, IP, or name from the CCTV JSON.'
    )
    parser.add_argument(
        '--cctv-json',
        type=Path,
        default=default_cctv_json,
        help='CCTV JSON file containing RTSP URLs.'
    )
    parser.add_argument(
        '--parking',
        choices=('on', 'off'),
        default='on',
        help='Enable or disable parking-slot detection.'
    )
    parser.add_argument(
        '--parking-json',
        type=Path,
        default=default_parking_json,
        help='COCO JSON file containing parking-slot annotations.'
    )
    parser.add_argument(
        '--parking-slots',
        help='Comma-separated parking-slot names; empty means use all slots.'
    )
    parser.add_argument(
        '--video',
        help='Optional RTSP URL or video path; overrides --camera.'
    )
    parser.add_argument(
        '--max-frames',
        type=int,
        default=0,
        help='Stop after this many frames; 0 means keep running.'
    )
    parser.add_argument(
        '--export-dir',
        type=Path,
        default=project_root / 'results',
        help='Directory for the final JSON and CSV result files.'
    )
    parser.add_argument(
        '--no-export',
        action='store_true',
        help='Disable final result export.'
    )
    return parser
