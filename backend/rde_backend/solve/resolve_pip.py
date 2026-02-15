from typing import Dict, Any, List, Tuple
from ..models import PlanStep, ResolutionAttempt, Conflict
from .constraints import ConstraintGraph

from .subprocess_utils import run_cmd, tail

def try_uv_lock(repo_path: str, requirements_in: str) -> tuple[ResolutionAttempt, List[Conflict]]:
    # Write temp requirements.in under .rde/
    import os
    os.makedirs(f"{repo_path}/.rde", exist_ok=True)
    req_in_path = f"{repo_path}/.rde/requirements.in"
    lock_path = f"{repo_path}/.rde/requirements.lock.txt"
    with open(req_in_path, "w") as f:
        f.write(requirements_in)

    code, out, err = run_cmd(["uv", "pip", "compile", req_in_path, "-o", lock_path], cwd=repo_path, timeout_s=120)
    attempt = ResolutionAttempt(
        tool="uv",
        success=(code == 0),
        summary="uv pip compile",
        stdout_tail=tail(out),
        stderr_tail=tail(err),
    )

    conflicts: List[Conflict] = []
    if code != 0:
        conflicts.append(Conflict(message="uv/pip resolution failed", raw=tail(err, 4000)))
    return attempt, conflicts


def build_pip_plan(g: ConstraintGraph) -> List[PlanStep]:
    pins = [f"{k}{v}" for k, v in g.pin_overrides.items()]
    pin_note = f"Pins applied: {', '.join(pins)}" if pins else "No pins applied."
    return [
        PlanStep(
            title="Create Python venv",
            commands=["python -m venv .venv", "source .venv/bin/activate"],
            why="Isolates project dependencies.",
            requires_confirmation=True,
        ),
        PlanStep(
            title="Install pip dependencies",
            commands=["python -m pip install -U pip", "pip install -r requirements.txt"],
            why=f"Installs dependencies from repo. {pin_note}",
            requires_confirmation=True,
        ),
    ]

def build_requirements_in(g: ConstraintGraph) -> str:
    lines = []
    # pins first
    for pkg, spec in g.pin_overrides.items():
        lines.append(f"{pkg}{spec}")
    # then repo deps (if any)
    for d in g.pip_deps:
        name = d.get("name")
        spec = d.get("spec") or ""
        if name:
            lines.append(f"{name}{spec}")
    return "\n".join(dict.fromkeys(lines)) + "\n"
