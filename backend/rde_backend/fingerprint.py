# backend/rde_backend/fingerprint.py
from __future__ import annotations
import platform
import shutil
import subprocess
from typing import Dict, List, Optional

from .models import Fingerprint

def _run(cmd: List[str]) -> bool:
    try:
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        return True
    except Exception:
        return False

def _python_version(exe: str) -> Optional[str]:
    try:
        out = subprocess.check_output([exe, "--version"], stderr=subprocess.STDOUT, text=True).strip()
        return out.replace("Python ", "")
    except Exception:
        return None

def fingerprint_system() -> Fingerprint:
    os_name = platform.system()
    os_ver = platform.version()
    arch = platform.machine()

    # find common python executables
    candidates = ["python", "python3"]
    python_execs = [c for c in candidates if shutil.which(c)]
    py_versions: Dict[str, str] = {}
    for exe in python_execs:
        v = _python_version(exe)
        if v:
            py_versions[exe] = v

    gpu_present = bool(shutil.which("nvidia-smi"))
    nvidia_smi_ok = _run(["nvidia-smi"]) if gpu_present else False
    nvcc_ok = _run(["nvcc", "--version"]) if shutil.which("nvcc") else False

    # WSL availability can be inferred later more precisely; placeholder here
    wsl_available = None
    if os_name.lower() == "windows":
        wsl_available = _run(["wsl", "--status"])

    return Fingerprint(
        os=os_name,
        os_version=os_ver,
        arch=arch,
        python_executables=python_execs,
        python_versions=py_versions,
        gpu_present=gpu_present,
        nvidia_smi_ok=nvidia_smi_ok,
        nvcc_ok=nvcc_ok,
        wsl_available=wsl_available,
    )
