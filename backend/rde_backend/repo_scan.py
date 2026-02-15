# backend/rde_backend/repo_scan.py
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, List, Set

README_CANDIDATES = ["README.md", "README.MD", "README.rst", "README.txt"]
DEP_FILES = ["requirements.txt", "pyproject.toml", "environment.yml", "environment.yaml", "setup.cfg", "Dockerfile"]
SCRIPT_GLOBS = ["*.sh", "*.bash", "install*.sh", "setup*.sh"]

# Hard skip dirs to keep scans fast + clean
SKIP_DIRS: Set[str] = {
    ".git",
    ".hg",
    ".svn",
    "build",
    "install",
    "log",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".idea",
    ".vscode",
}

def _should_skip(path: Path) -> bool:
    return any(part in SKIP_DIRS for part in path.parts)

@dataclass
class RepoFiles:
    readme: Optional[Path]
    dep_files: List[Path]
    scripts: List[Path]

    # NEW: workspace awareness (safe defaults keep old callers working)
    repo_root: Optional[Path] = None
    scan_root: Optional[Path] = None
    is_workspace: bool = False
    package_xmls: List[Path] = None
    package_roots: List[Path] = None

def find_first(repo: Path, names: List[str]) -> Optional[Path]:
    for n in names:
        p = repo / n
        if p.exists() and p.is_file():
            return p
    return None

def _is_ros_workspace(repo: Path) -> bool:
    """
    Basic ROS workspace heuristic:
    - repo/src exists
    - at least one package.xml under repo/src
    """
    src = repo / "src"
    if not src.exists() or not src.is_dir():
        return False
    for p in src.rglob("package.xml"):
        if p.is_file() and not _should_skip(p):
            return True
    return False

def discover_repo_files(repo_path: str) -> RepoFiles:
    repo = Path(repo_path).resolve()
    readme = find_first(repo, README_CANDIDATES)

    is_ws = _is_ros_workspace(repo)
    scan_root = (repo / "src") if is_ws else repo

    dep_files: List[Path] = []
    scripts: List[Path] = []

    # 1) Root-level dep files (if not workspace, still ok)
    for name in DEP_FILES:
        p = repo / name
        if p.exists() and p.is_file():
            dep_files.append(p)

    # 2) Recursive scan for key files under scan_root
    #    - package.xml is common in ROS and monorepos
    #    - also allow nested requirements/pyproject/env yml/Dockerfile
    package_xmls: List[Path] = []
    package_roots: List[Path] = []

    for p in scan_root.rglob("*"):
        if _should_skip(p):
            continue
        if not p.is_file():
            continue

        lname = p.name.lower()

        # ROS package manifests
        if lname == "package.xml":
            package_xmls.append(p)
            package_roots.append(p.parent)
            dep_files.append(p)
            continue

        # Nested dependency files
        if p.name in DEP_FILES or lname in (d.lower() for d in DEP_FILES):
            dep_files.append(p)
            continue

    # 3) Scripts (keep your existing behavior but only under scan_root)
    for g in SCRIPT_GLOBS:
        for p in scan_root.rglob(g):
            if p.is_file() and not _should_skip(p):
                scripts.append(p)

    # de-dup + sort
    dep_files = sorted(set(dep_files))
    scripts = sorted(set(scripts))

    # de-dup package roots
    seen = set()
    uniq_pkg_roots: List[Path] = []
    for r in package_roots:
        rs = str(r)
        if rs in seen:
            continue
        seen.add(rs)
        uniq_pkg_roots.append(r)

    return RepoFiles(
        readme=readme,
        dep_files=dep_files,
        scripts=scripts,
        repo_root=repo,
        scan_root=scan_root,
        is_workspace=is_ws,
        package_xmls=sorted(set(package_xmls)),
        package_roots=uniq_pkg_roots,
    )
