from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, List, Tuple
import re
from pathlib import Path

from .models import Evidence

# Regex patterns
UBUNTU_RE = re.compile(r"\bUbuntu\s*(\d{2}\.\d{2})\b", re.IGNORECASE)
ROS2_RE = re.compile(
    r"\bROS\s*2\s*(Foxy|Galactic|Humble|Iron|Jazzy|Rolling)\b|\b(Foxy|Galactic|Humble|Iron|Jazzy|Rolling)\b",
    re.IGNORECASE
)
PY_RE = re.compile(r"\bPython\s*(\d)\.(\d+)\b", re.IGNORECASE)

@dataclass
class ExpectedPlatform:
    ubuntu: Optional[str] = None           # e.g. "24.04"
    ros2_distro: Optional[str] = None      # e.g. "jazzy"
    python_mm: Optional[str] = None        # e.g. "3.12"
    ubuntu_evidence: Optional[Evidence] = None
    ros_evidence: Optional[Evidence] = None
    python_evidence: Optional[Evidence] = None

# Heuristic mapping (best-effort)
# We treat this as inference, not a hard truth.
UBUNTU_TO_ROS2 = {
    "20.04": "foxy",
    "22.04": "humble",
    "24.04": "jazzy",
}

UBUNTU_TO_PY = {
    "20.04": "3.8",
    "22.04": "3.10",
    "24.04": "3.12",
}

def _find_first_line_match(lines: List[str], pattern: re.Pattern) -> Optional[Tuple[int, re.Match]]:
    for i, line in enumerate(lines, start=1):
        m = pattern.search(line)
        if m:
            return i, m
    return None

def extract_expected_platform(readme_path: Path) -> ExpectedPlatform:
    text = readme_path.read_text(errors="ignore")
    lines = text.splitlines()

    exp = ExpectedPlatform()

    # Ubuntu
    m = _find_first_line_match(lines, UBUNTU_RE)
    if m:
        line_no, match = m
        exp.ubuntu = match.group(1)
        exp.ubuntu_evidence = Evidence(source=readme_path.name, location=f"{readme_path.name}:{line_no}", excerpt=lines[line_no-1].strip()[:200])

    # ROS2 distro
    m = _find_first_line_match(lines, ROS2_RE)
    if m:
        line_no, match = m
        distro = (match.group(1) or match.group(2) or "").lower()
        if distro:
            exp.ros2_distro = distro
            exp.ros_evidence = Evidence(source=readme_path.name, location=f"{readme_path.name}:{line_no}", excerpt=lines[line_no-1].strip()[:200])

    # Python version
    m = _find_first_line_match(lines, PY_RE)
    if m:
        line_no, match = m
        exp.python_mm = f"{match.group(1)}.{match.group(2)}"
        exp.python_evidence = Evidence(source=readme_path.name, location=f"{readme_path.name}:{line_no}", excerpt=lines[line_no-1].strip()[:200])

    return exp

def infer_ros2_from_ubuntu(ubuntu: Optional[str]) -> Optional[str]:
    if not ubuntu:
        return None
    return UBUNTU_TO_ROS2.get(ubuntu)

def infer_python_from_ubuntu(ubuntu: Optional[str]) -> Optional[str]:
    if not ubuntu:
        return None
    return UBUNTU_TO_PY.get(ubuntu)
