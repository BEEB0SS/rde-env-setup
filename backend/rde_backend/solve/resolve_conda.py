from typing import List
from ..models import PlanStep
from .constraints import ConstraintGraph

def build_conda_plan(g: ConstraintGraph, env_name: str = "rde") -> List[PlanStep]:
    python_target = g.python_candidates[0] if g.python_candidates else ""
    pin_note = ", ".join([f"{k}{v}" for k, v in g.pin_overrides.items()]) or "none"
    return [
        PlanStep(
            title="Create conda environment",
            commands=[f"conda create -n {env_name} python={python_target} -y"],
            why="Creates a reproducible environment with pinned Python.",
            requires_confirmation=True,
        ),
        PlanStep(
            title="Activate environment",
            commands=[f"conda activate {env_name}"],
            why="Required before installing dependencies.",
        ),
        PlanStep(
            title="Install project deps",
            commands=[],
            why=f"Install repo deps using conda/pip as appropriate. Pins: {pin_note}",
            requires_confirmation=True,
        ),
    ]
