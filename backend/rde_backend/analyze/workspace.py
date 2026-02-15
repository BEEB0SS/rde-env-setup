from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Dict

@dataclass
class PackageInfo:
    kind: str                 # "ros" | "python" | "node" | "unknown"
    name: str
    root: Path
    manifest_path: Optional[Path] = None

def is_ros_workspace(root: Path) -> bool:
    # Typical colcon workspace: root/src exists and contains package.xml files
    src = root / "src"
    if not src.exists() or not src.is_dir():
        return False
    return any(p.name == "package.xml" for p in src.rglob("package.xml"))

def discover_packages(root: Path, max_depth: int = 12) -> List[PackageInfo]:
    """
    Recursively find recognizable package roots.
    Priority: ROS package.xml, then Python pyproject/setup.cfg/setup.py, then Node package.json.
    """
    pkgs: List[PackageInfo] = []

    # 1) ROS packages (package.xml)
    for pkg_xml in root.rglob("package.xml"):
        pkg_root = pkg_xml.parent
        pkgs.append(PackageInfo(kind="ros", name=pkg_root.name, root=pkg_root, manifest_path=pkg_xml))

    # 2) Python packages
    for pyproj in root.rglob("pyproject.toml"):
        pkg_root = pyproj.parent
        # avoid double counting if this folder is already a ROS package root
        if any(p.root == pkg_root for p in pkgs):
            continue
        pkgs.append(PackageInfo(kind="python", name=pkg_root.name, root=pkg_root, manifest_path=pyproj))

    for setup_cfg in root.rglob("setup.cfg"):
        pkg_root = setup_cfg.parent
        if any(p.root == pkg_root for p in pkgs):
            continue
        pkgs.append(PackageInfo(kind="python", name=pkg_root.name, root=pkg_root, manifest_path=setup_cfg))

    for setup_py in root.rglob("setup.py"):
        pkg_root = setup_py.parent
        if any(p.root == pkg_root for p in pkgs):
            continue
        pkgs.append(PackageInfo(kind="python", name=pkg_root.name, root=pkg_root, manifest_path=setup_py))

    # 3) Node packages
    for pkg_json in root.rglob("package.json"):
        pkg_root = pkg_json.parent
        if any(p.root == pkg_root for p in pkgs):
            continue
        pkgs.append(PackageInfo(kind="node", name=pkg_root.name, root=pkg_root, manifest_path=pkg_json))

    # Deduplicate by root (keep first)
    seen = set()
    unique: List[PackageInfo] = []
    for p in pkgs:
        if str(p.root) in seen:
            continue
        seen.add(str(p.root))
        unique.append(p)

    return unique
