from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

CRITICAL = {"tensorflow", "torch", "jax", "mujoco", "ray"}

@dataclass
class ConstraintGraph:
    os_name: str
    os_version: str
    arch: str
    run_target: str
    env_type: str
    goal: str
    strictness: str

    python_current: Optional[str] = None
    gpu_present: bool = False
    nvcc_ok: bool = False

    pip_deps: List[Dict[str, Any]] = field(default_factory=list)
    conda_deps: List[Dict[str, Any]] = field(default_factory=list)
    ros_deps: List[Dict[str, Any]] = field(default_factory=list)
    apt_deps: List[Dict[str, Any]] = field(default_factory=list)

    critical: Set[str] = field(default_factory=set)

    # hard constraints to enforce during solve
    python_candidates: List[str] = field(default_factory=list)  # e.g. ["3.12", "3.11", "3.10"]
    pin_overrides: Dict[str, str] = field(default_factory=dict) # e.g. {"tensorflow": "<=2.10.*"}

    warnings: List[str] = field(default_factory=list)
    reasons: List[str] = field(default_factory=list)

def build_constraints(analysis: Dict[str, Any], choices: Dict[str, Any]) -> ConstraintGraph:
    fp = analysis.get("fingerprint", {}) or {}
    deps = analysis.get("dependencies", {}) or {}

    env_type = choices.get("envType")
    run_target = choices.get("runTarget")
    goal = choices.get("goal")
    strictness = choices.get("strictness")

    g = ConstraintGraph(
        os_name=str(fp.get("os", "unknown")),
        os_version=str(fp.get("os_version", "")),
        arch=str(fp.get("arch", "")),
        env_type=str(env_type),
        run_target=str(run_target),
        goal=str(goal),
        strictness=str(strictness),
        python_current=(fp.get("python_versions", {}) or {}).get("python3") or (fp.get("python_versions", {}) or {}).get("python"),
        gpu_present=bool(fp.get("gpu_present")),
        nvcc_ok=bool(fp.get("nvcc_ok")),
        pip_deps=list(deps.get("pip", []) or []),
        conda_deps=list(deps.get("conda", []) or []),
        ros_deps=list(deps.get("ros", []) or []),
        apt_deps=list(deps.get("apt", []) or []),
    )

    # detect critical packages
    def norm(name: str) -> str:
        return name.lower().replace("_", "-")

    for d in g.pip_deps + g.conda_deps:
        nm = norm(d.get("name", ""))
        base = nm.split("[", 1)[0]
        if base in CRITICAL:
            g.critical.add(base)

    # default python candidates (conservative)
    if g.os_name.lower().startswith("linux"):
        g.python_candidates = ["3.12", "3.11", "3.10"] if strictness == "recent" else ["3.12", "3.11", "3.10"]
    else:
        g.python_candidates = ["3.11", "3.10"] if strictness == "compatible" else ["3.11", "3.10"]

    return g
