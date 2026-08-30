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
    print("If nvidia-smi works but Torch CUDA runtime is None, the venv likely has a CPU-only PyTorch build.")
    raise SystemExit(1)

print("\nGPU name          :", torch.cuda.get_device_name(0))
print("GPU capability    :", torch.cuda.get_device_capability(0))
print("\n[OK] parkng_model.py can use CUDA GPU 0.")
