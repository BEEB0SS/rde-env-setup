from pathlib import Path
from typing import Dict, Any, List
from ..models import SolveResponse, SolveDecision, PlanStep, ResolutionAttempt, Conflict, DecisionPoint, DecisionPointOption
from .constraints import build_constraints
from .rules import load_rules, apply_rules
from .resolve_ros import build_ros_plan, infer_ros2_distro
from .resolve_pip import build_pip_plan, build_requirements_in, try_uv_lock
from .resolve_conda import build_conda_plan

RULES_PATH = Path(__file__).parent / "rules_db.yaml"

def solve(repo_path: str, choices: Dict[str, Any], analysis: Dict[str, Any]) -> SolveResponse:
    g = build_constraints(analysis, choices)
    rules = load_rules(RULES_PATH)
    apply_rules(g, rules)

    decision = SolveDecision(
        envType=str(choices.get("envType")),
        runTarget=str(choices.get("runTarget")),
        goal=str(choices.get("goal")),
        strictness=str(choices.get("strictness")),
        pythonTarget=g.python_candidates[0] if g.python_candidates else g.python_current,
        ros2Distro=infer_ros2_distro(g.os_name, g.os_version),
    )

    plan_steps: List[PlanStep] = []
    attempts: List[ResolutionAttempt] = []
    conflicts: List[Conflict] = []
    notes: List[str] = []

    # C) ROS plan (independent of env type)
    plan_steps.extend(build_ros_plan(analysis, g.os_name, g.os_version))

    # A/B plans + attempts
    if decision.envType == "venv":
        plan_steps.extend(build_pip_plan(g))
        # try lock if uv exists
        req_in = build_requirements_in(g)
        try:
            attempt, confs = try_uv_lock(repo_path, req_in)
            attempts.append(attempt)
            conflicts.extend(confs)
        except FileNotFoundError:
            attempts.append(ResolutionAttempt(tool="uv", success=False, summary="uv not installed", stderr_tail="Install uv to enable lock."))
    elif decision.envType == "conda":
        plan_steps.extend(build_conda_plan(g))
        # conda dry-run can be added next

    # Decision point example (Windows TF case)
    # (You can expand this later; keeping it simple)
    decision_point = None
    if "tensorflow" in g.critical and g.os_name.lower().startswith("windows") and decision.runTarget == "host":
        decision_point = DecisionPoint(
            reason="TensorFlow on native Windows can be constrained. Choose a path:",
            options=[
                DecisionPointOption(id="cpu", label="CPU-only on Windows", description="Most compatible."),
                DecisionPointOption(id="wsl2", label="Use WSL2", description="Better Linux compatibility."),
                DecisionPointOption(id="docker", label="Use Docker", description="Isolated env."),
            ],
        )

    constraints_summary = {
        "os": g.os_name,
        "python_current": g.python_current,
        "python_candidates": g.python_candidates,
        "critical": sorted(list(g.critical)),
        "pin_overrides": g.pin_overrides,
        "warnings": g.warnings,
        "reasons": g.reasons,
    }

    return SolveResponse(
        repoPath=repo_path,
        decision=decision,
        constraints_summary=constraints_summary,
        plan_steps=plan_steps,
        resolution_attempts=attempts,
        conflicts=conflicts,
        decision_point=decision_point,
        notes=notes,
    )
