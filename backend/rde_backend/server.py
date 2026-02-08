from fastapi import FastAPI
from pydantic import BaseModel
from pathlib import Path
from .models import AnalyzeRequest, AnalyzeResponse, SetupIntent, DependencySummary
import uvicorn
from .repo_scan import discover_repo_files
from .readme_intent import parse_readme
from .deps import collect_dependencies
from .fingerprint import fingerprint_system
from .readme_expectations import extract_expected_platform
from .diagnostics import build_platform_diagnostics

app = FastAPI(title="RDE Backend", version="0.0.1")


@app.get("/health")
def health():
    return {"ok": True, "service": "rde-backend", "version": "0.0.1"}


class AnalyzeRequest(BaseModel):
    repoPath: str


class SolveRequest(BaseModel):
    repoPath: str
    choices: dict
    analysis: dict


@app.post("/analyze", response_model = AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    repo_files = discover_repo_files(req.repoPath)

    # README intent extraction
    setup_intent = SetupIntent()
    readme_path = None
    diagnostics = []
    fp = fingerprint_system()
    if repo_files.readme:
        readme_path = str(repo_files.readme)

        # 1) Procedural intent (install blocks, etc.)
        setup_intent = parse_readme(repo_files.readme)

        # 2) Platform expectations + mismatch diagnostics
        exp = extract_expected_platform(repo_files.readme)
        
        diagnostics = build_platform_diagnostics(exp, fp)
    # Dependency extraction (deterministic parsers)
    deps = collect_dependencies(repo_files.dep_files)

    # Notes (human-readable summary)
    notes = []
    if not repo_files.readme:
        notes.append("No README found at repo root.")
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


@app.post("/solve")
def solve(req: SolveRequest):
    # Phase 0 stub: echo choices back
    return {
        "repoPath": req.repoPath,
        "choices": req.choices,
        "decision": {"strategy": "stub", "python": "unknown"},
        "notes": ["stub solve response"],
    }


@app.post("/generate")
def generate(payload: dict):
    return {"ok": True, "notes": ["stub generate response"], "payload": payload}


@app.post("/validate")
def validate(payload: dict):
    return {"ok": True, "notes": ["stub validate response"], "payload": payload}


def main():
    # Fixed port for Phase 0. Later we can do dynamic ports.
    uvicorn.run("rde_backend.server:app", host="127.0.0.1", port=8844, log_level="info")
