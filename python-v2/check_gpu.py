"""Fail-fast CUDA verification for the realtime parking runtime."""

import shutil
import subprocess
import sys

try:
    import torch
except Exception as exc:
    print("[FAIL] PyTorch cannot be imported:", exc)
    raise SystemExit(2)

print("Python executable :", sys.executable)
print("Torch version     :", torch.__version__)
print("Torch CUDA runtime:", torch.version.cuda)
print("CUDA available    :", torch.cuda.is_available())

if shutil.which("nvidia-smi"):
    print("\n--- nvidia-smi ---")
    subprocess.run(["nvidia-smi"], check=False)
else:
    print("\n[WARN] nvidia-smi was not found in PATH.")

if not torch.cuda.is_available():
    print("\n[FAIL] This .venv cannot use CUDA.")
    if torch.version.cuda is None or "+cpu" in str(torch.__version__).lower():
        print("       PyTorch appears to be a CPU-only build.")
    raise SystemExit(1)

try:
    device = torch.device("cuda:0")
    sample = torch.ones((1024, 1024), device=device)
    result = (sample @ sample).sum()
    torch.cuda.synchronize()
    del sample, result
except Exception as exc:
    print("\n[FAIL] CUDA was reported available but a real GPU operation failed:", exc)
    raise SystemExit(1)

print("\nGPU name          :", torch.cuda.get_device_name(0))
print("GPU capability    :", torch.cuda.get_device_capability(0))
print("[OK] CUDA GPU 0 passed a real tensor operation.")
