from __future__ import annotations
from typing import List, Optional
import re

from .models import Diagnostic, Evidence, Fingerprint
from .readme_expectations import ExpectedPlatform, infer_ros2_from_ubuntu, infer_python_from_ubuntu

UBUNTU_VERSION_RE = re.compile(r"\b(\d{2}\.\d{2})\b")

def _extract_ubuntu_from_os_version(os_version: str) -> Optional[str]:
    # Example: "#37~24.04.1-Ubuntu SMP ..."
    m = UBUNTU_VERSION_RE.search(os_version)
    if not m:
        return None
    # 24.04.1 -> 24.04
    v = m.group(1)
    return v

def _extract_primary_python(f: Fingerprint) -> Optional[str]:
    # prefer python3 if present
    if "python3" in f.python_versions:
        return f.python_versions["python3"]
    if "python" in f.python_versions:
        return f.python_versions["python"]
    return None

def build_platform_diagnostics(exp: ExpectedPlatform, fp: Fingerprint) -> List[Diagnostic]:
    diags: List[Diagnostic] = []

    actual_ubuntu = None
    if fp.os.lower() == "linux":
        actual_ubuntu = _extract_ubuntu_from_os_version(fp.os_version)

    actual_py = _extract_primary_python(fp)
    actual_py_mm = None
    if actual_py:
        parts = actual_py.split(".")
        if len(parts) >= 2:
            actual_py_mm = f"{parts[0]}.{parts[1]}"

    # 1) If README declares Ubuntu version, compare to actual
    if exp.ubuntu and actual_ubuntu and exp.ubuntu != actual_ubuntu:
        diags.append(Diagnostic(
            level="warn",
            code="platform.ubuntu.mismatch",
            message=f"README indicates Ubuntu {exp.ubuntu}, but this machine looks like Ubuntu {actual_ubuntu}. This can break ROS/Gazebo compatibility.",
            evidence=exp.ubuntu_evidence
        ))

    # 2) If README doesn’t specify ROS2 distro but Ubuntu does, infer likely distro + python
    inferred_ros = infer_ros2_from_ubuntu(exp.ubuntu) if exp.ubuntu else None
    inferred_py = infer_python_from_ubuntu(exp.ubuntu) if exp.ubuntu else None

    # 2a) Info suggestion: likely ROS2 distro based on Ubuntu
    if exp.ubuntu and inferred_ros:
        msg = f"Based on Ubuntu {exp.ubuntu}, this repo likely targets ROS 2 {inferred_ros.capitalize()}."
        if inferred_py:
            msg += f" A typical system Python is ~{inferred_py}."
        diags.append(Diagnostic(
            level="info",
            code="platform.ros2.inferred",
            message=msg,
            evidence=exp.ubuntu_evidence
        ))

    # 3) If README explicitly says ROS2 distro, but inference from Ubuntu says something else, warn
    if exp.ros2_distro and inferred_ros and exp.ros2_distro != inferred_ros:
        diags.append(Diagnostic(
            level="warn",
            code="platform.ros2.mismatch",
            message=f"Potential mismatch: README mentions ROS 2 {exp.ros2_distro.capitalize()}, but Ubuntu {exp.ubuntu} often pairs with ROS 2 {inferred_ros.capitalize()}. Double-check the intended distro.",
            evidence=exp.ros_evidence or exp.ubuntu_evidence
        ))

    # 4) If README explicitly says Python version, compare to actual python (major.minor)
    if exp.python_mm and actual_py_mm and exp.python_mm != actual_py_mm:
        diags.append(Diagnostic(
            level="warn",
            code="platform.python.mismatch",
            message=f"README mentions Python {exp.python_mm}, but this machine is using Python {actual_py_mm}. This may cause dependency conflicts.",
            evidence=exp.python_evidence
        ))

    # 5) GPU/CUDA signals: GPU present but no nvcc
    if fp.gpu_present and fp.nvidia_smi_ok and not fp.nvcc_ok:
        diags.append(Diagnostic(
            level="info",
            code="platform.cuda.missing_toolkit",
            message="GPU is detected (nvidia-smi works) but CUDA toolkit (nvcc) is not found. Some GPU builds may require installing CUDA toolkit or using conda/cuda wheels.",
            evidence=None
        ))

    return diags
