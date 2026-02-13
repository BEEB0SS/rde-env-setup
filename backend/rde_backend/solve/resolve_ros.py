from typing import Dict, Any, List, Optional
from ..models import PlanStep

def infer_ros2_distro(os_name: str, os_version: str) -> Optional[str]:
    # Minimal heuristic: Ubuntu 24.04 -> jazzy
    if "Ubuntu" in os_name or "Linux" in os_name:
        if "24.04" in os_version:
            return "jazzy"
        if "22.04" in os_version:
            return "humble"
    return None

def build_ros_plan(analysis: Dict[str, Any], os_name: str, os_version: str) -> List[PlanStep]:
    deps = (analysis.get("dependencies") or {}).get("ros") or []
    readme_blocks = (analysis.get("setup_intent") or {}).get("install_blocks") or []

    mentions_rosdep = any("rosdep" in (b.get("code") or "") for b in readme_blocks)
    has_ros = bool(deps) or mentions_rosdep
    if not has_ros:
        return []

    distro = infer_ros2_distro(os_name, os_version)
    steps: List[PlanStep] = []

    steps.append(PlanStep(
        title=f"Install ROS 2 ({distro or 'distro TBD'})",
        commands=[],
        why="ROS packages are required for this workspace. We infer distro from OS; confirm if README specifies otherwise.",
        requires_confirmation=True,
    ))

    if mentions_rosdep:
        steps.append(PlanStep(
            title="Install ROS dependencies with rosdep",
            commands=[
                "sudo rosdep init || true",
                "rosdep update",
                "rosdep install --from-paths src -y --ignore-src",
            ],
            why="README includes rosdep install for system/ROS dependencies.",
        ))

    steps.append(PlanStep(
        title="Build workspace (colcon)",
        commands=["colcon build"],
        why="Most ROS2 workspaces build with colcon; adjust if repo specifies.",
        requires_confirmation=True,
    ))

    steps.append(PlanStep(
        title="Source environment",
        commands=["source install/setup.bash"],
        why="Required for ROS packages and launch files.",
    ))

    return steps
