from fastapi import FastAPI
from pydantic import BaseModel
from pathlib import Path
from .models import AnalyzeRequest, AnalyzeResponse, SetupIntent, DependencySummary, SolveRequest, SolveResponse
import uvicorn
import json
from .repo_scan import discover_repo_files
from .readme_intent import parse_readme
from .deps import collect_dependencies
from .fingerprint import fingerprint_system
from .readme_expectations import extract_expected_platform
from .diagnostics import build_platform_diagnostics
from .solve.solve import solve as solver
from .analyze.package_analyzer import analyze_package

app = FastAPI(title="RDE Backend", version="0.0.1")


@app.get("/health")
def health():
    return {"ok": True, "service": "rde-backend", "version": "0.0.1"}

"""
class AnalyzeRequest(BaseModel):
    repoPath: str


class SolveRequest(BaseModel):
    repoPath: str
    choices: dict
    analysis: dict
"""

@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    repo_files = discover_repo_files(req.repoPath)

    setup_intent = SetupIntent()
    readme_path = None
    diagnostics = []
    fp = fingerprint_system()

    # README intent extraction (root README only for now)
    if repo_files.readme:
        readme_path = str(repo_files.readme)

        # 1) Procedural intent (install blocks, etc.)
        setup_intent = parse_readme(repo_files.readme)

        # 2) Platform expectations + mismatch diagnostics
        exp = extract_expected_platform(repo_files.readme)
        diagnostics = build_platform_diagnostics(exp, fp)

    # Dependency extraction
    notes = []
    if not repo_files.readme:
        notes.append("No README found at repo root.")

    is_ws = getattr(repo_files, "is_workspace", False)
    if is_ws:
        notes.append("Workspace detected: ROS-style (src/ contains package.xml).")
        notes.append(f"Discovered {len(repo_files.package_roots or [])} ROS packages.")

        # 2.0/2.1: analyze each package root and aggregate deps
        pkg_analyses = [analyze_package(r) for r in (repo_files.package_roots or [])]

        deps = DependencySummary()
        for pa in pkg_analyses:
            deps.pip.extend(pa.deps.pip)
            deps.conda.extend(pa.deps.conda)
            deps.apt.extend(pa.deps.apt)
            deps.ros.extend(pa.deps.ros)

        # TEMP: provide per-package summary for extension (easy render)
        pkg_index = []
        for pa in pkg_analyses:
            pkg_index.append({
                "name": pa.name,
                "root": str(pa.root),
                "ros_dep_count": len(pa.deps.ros),
                "pip_dep_count": len(pa.deps.pip),
                "apt_dep_count": len(pa.deps.apt),
                "conda_dep_count": len(pa.deps.conda),
            })
        notes.append("RDE_PACKAGES_JSON=" + json.dumps(pkg_index))

    else:
        # non-workspace behavior stays as-is
        deps = collect_dependencies(repo_files.dep_files)

    notes.append(f"Found {len(repo_files.dep_files)} dependency-related files.")
    notes.append(f"Found {len(repo_files.scripts)} scripts.")

    return AnalyzeResponse(
        repoPath=req.repoPath,
        readme_path=readme_path,
        setup_intent=setup_intent,
        dependencies=deps,
        fingerprint=fp,
        diagnostics=diagnostics,
        notes=notes,
    )



@app.post("/solve", response_model=SolveResponse)
def solve(req: SolveRequest):
    return solver(req.repoPath, req.choices, req.analysis)


@app.post("/generate")
def generate(payload: dict):
    return {"ok": True, "notes": ["stub generate response"], "payload": payload}


@app.post("/validate")
def validate(payload: dict):
    return {"ok": True, "notes": ["stub validate response"], "payload": payload}


def main():
    # Fixed port for Phase 0. Later we can do dynamic ports.
    uvicorn.run("rde_backend.server:app", host="127.0.0.1", port=8844, log_level="info")
