# backend/rde_backend/deps.py
from __future__ import annotations
from pathlib import Path
from typing import List, Optional, Tuple
import re
import tomllib  # Python 3.11+. If you’re on 3.10, use 'tomli' instead.
import yaml

from .models import NormalizedDep, Evidence, DependencySummary

REQ_LINE_RE = re.compile(r"^\s*([A-Za-z0-9_.\-]+)\s*([<>=!~].+)?\s*$")

def parse_requirements_txt(p: Path) -> List[NormalizedDep]:
    deps: List[NormalizedDep] = []
    lines = p.read_text(errors="ignore").splitlines()
    for idx, line in enumerate(lines, start=1):
        s = line.strip()
        if not s or s.startswith("#") or s.startswith("-r") or s.startswith("--"):
            continue
        m = REQ_LINE_RE.match(s)
        if not m:
            continue
        name = m.group(1)
        spec = (m.group(2) or "").strip() or None
        deps.append(
            NormalizedDep(
                kind="pip",
                name=name,
                spec=spec,
                evidence=Evidence(source=str(p.name), location=f"{p.name}:{idx}", excerpt=line.strip()[:200]),
            )
        )
    return deps

def parse_pyproject_toml(p: Path) -> List[NormalizedDep]:
    deps: List[NormalizedDep] = []
    data = tomllib.loads(p.read_text(errors="ignore"))
    # PEP 621 style: [project] dependencies
    project = data.get("project", {})
    for dep in project.get("dependencies", []) or []:
        # dep string like "numpy>=1.23"
        s = str(dep).strip()
        if not s:
            continue
        name, spec = split_name_spec(s)
        deps.append(
            NormalizedDep(
                kind="pip",
                name=name,
                spec=spec,
                evidence=Evidence(source=str(p.name), location=f"{p.name}:[project].dependencies", excerpt=s[:200]),
            )
        )
    # Poetry style: [tool.poetry.dependencies]
    tool = data.get("tool", {})
    poetry = tool.get("poetry", {})
    pdeps = poetry.get("dependencies", {}) or {}
    for name, specval in pdeps.items():
        if name.lower() == "python":
            continue
        spec = None
        if isinstance(specval, str):
            spec = specval
        elif isinstance(specval, dict):
            # e.g., {version="^1.0", optional=true}
            spec = specval.get("version")
        deps.append(
            NormalizedDep(
                kind="pip",
                name=str(name),
                spec=spec,
                evidence=Evidence(source=str(p.name), location=f"{p.name}:[tool.poetry.dependencies]", excerpt=str(specval)[:200]),
            )
        )
    return deps

def split_name_spec(s: str) -> Tuple[str, Optional[str]]:
    # very simple split: first token is name; rest is spec
    # handles "pkg>=1.2" too
    m = re.match(r"^([A-Za-z0-9_.\-]+)\s*(.*)$", s)
    if not m:
        return s, None
    name = m.group(1)
    rest = m.group(2).strip()
    return name, (rest if rest else None)

def parse_environment_yml(p: Path) -> List[NormalizedDep]:
    deps: List[NormalizedDep] = []
    data = yaml.safe_load(p.read_text(errors="ignore")) or {}
    entries = data.get("dependencies", []) or []
    for entry in entries:
        if isinstance(entry, str):
            name, spec = split_name_spec(entry)
            deps.append(
                NormalizedDep(
                    kind="conda",
                    name=name,
                    spec=spec,
                    evidence=Evidence(source=str(p.name), location=f"{p.name}:dependencies", excerpt=str(entry)[:200]),
                )
            )
        elif isinstance(entry, dict) and "pip" in entry:
            for pipdep in entry["pip"] or []:
                s = str(pipdep).strip()
                if not s:
                    continue
                name, spec = split_name_spec(s)
                deps.append(
                    NormalizedDep(
                        kind="pip",
                        name=name,
                        spec=spec,
                        evidence=Evidence(source=str(p.name), location=f"{p.name}:dependencies.pip", excerpt=s[:200]),
                    )
                )
    return deps

def parse_dockerfile_apt(p: Path) -> List[NormalizedDep]:
    deps: List[NormalizedDep] = []
    lines = p.read_text(errors="ignore").splitlines()
    for idx, line in enumerate(lines, start=1):
        low = line.lower()
        if "apt-get" in low and "install" in low:
            # naive tokenization: capture packages after 'install'
            # handles: RUN apt-get update && apt-get install -y pkg1 pkg2
            parts = re.split(r"\s+", line.strip())
            if "install" in parts:
                j = parts.index("install")
                pkgs = [t for t in parts[j+1:] if not t.startswith("-") and t not in ["&&", "\\"]]
                for pkg in pkgs:
                    deps.append(
                        NormalizedDep(
                            kind="apt",
                            name=pkg,
                            spec=None,
                            evidence=Evidence(source=str(p.name), location=f"{p.name}:{idx}", excerpt=line.strip()[:200]),
                        )
                    )
    return deps

def collect_dependencies(dep_paths: List[Path]) -> DependencySummary:
    summary = DependencySummary()
    for p in dep_paths:
        name = p.name.lower()
        try:
            if name == "requirements.txt":
                summary.pip.extend(parse_requirements_txt(p))
            elif name == "pyproject.toml":
                summary.pip.extend(parse_pyproject_toml(p))
            elif name in ("environment.yml", "environment.yaml"):
                envdeps = parse_environment_yml(p)
                for d in envdeps:
                    if d.kind == "conda":
                        summary.conda.append(d)
                    elif d.kind == "pip":
                        summary.pip.append(d)
            elif name == "dockerfile":
                summary.apt.extend(parse_dockerfile_apt(p))
            # setup.cfg and package.xml can be added next (we’ll do those right after)
        except Exception:
            # keep analysis robust; never crash on a parser
            continue
    return summary
