# backend/rde_backend/repo_scan.py
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, List

README_CANDIDATES = ["README.md", "README.MD", "README.rst", "README.txt"]
DEP_FILES = ["requirements.txt", "pyproject.toml", "environment.yml", "environment.yaml", "setup.cfg", "Dockerfile"]
SCRIPT_GLOBS = ["*.sh", "*.bash", "install*.sh", "setup*.sh"]

@dataclass
class RepoFiles:
    readme: Optional[Path]
    dep_files: List[Path]
    scripts: List[Path]

def find_first(repo: Path, names: List[str]) -> Optional[Path]:
    for n in names:
        p = repo / n
        if p.exists() and p.is_file():
            return p
    return None

def discover_repo_files(repo_path: str) -> RepoFiles:
    repo = Path(repo_path).resolve()
    readme = find_first(repo, README_CANDIDATES)

    dep_files: List[Path] = []
    for name in DEP_FILES:
        p = repo / name
        if p.exists() and p.is_file():
            dep_files.append(p)

    # also catch ROS package.xml anywhere (common)
    dep_files.extend([p for p in repo.rglob("package.xml") if p.is_file()])

    scripts: List[Path] = []
    for g in SCRIPT_GLOBS:
        scripts.extend([p for p in repo.rglob(g) if p.is_file()])

    # de-dup
    dep_files = sorted(set(dep_files))
    scripts = sorted(set(scripts))
    return RepoFiles(readme=readme, dep_files=dep_files, scripts=scripts)
