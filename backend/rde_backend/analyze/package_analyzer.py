from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, List

from rde_backend.models import DependencySummary
from rde_backend.deps import collect_dependencies

@dataclass
class PackageAnalysis:
    name: str
    root: Path
    deps: DependencySummary
    readme: Optional[Path] = None
    scripts: List[Path] = None

def analyze_package(pkg_root: Path) -> PackageAnalysis:
    dep_paths = []
    # include package.xml + any known dep files inside package root
    for p in pkg_root.rglob("*"):
        if not p.is_file():
            continue
        if p.name in ("package.xml", "requirements.txt", "pyproject.toml", "environment.yml", "environment.yaml", "Dockerfile", "setup.cfg"):
            dep_paths.append(p)
    deps = collect_dependencies(dep_paths)
    return PackageAnalysis(
        name=pkg_root.name,
        root=pkg_root,
        deps=deps,
        readme=(pkg_root / "README.md") if (pkg_root / "README.md").exists() else None,
        scripts=[],
    )
