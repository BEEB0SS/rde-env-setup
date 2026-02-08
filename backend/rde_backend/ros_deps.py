from __future__ import annotations
from pathlib import Path
from typing import List, Set
import xml.etree.ElementTree as ET

from .models import NormalizedDep, Evidence

# ROS dependency tags we care about (ROS1 + ROS2 compatible)
DEP_TAGS = [
    "depend",
    "exec_depend",
    "build_depend",
    "buildtool_depend",
    "buildtool_export_depend",
    "build_export_depend",
    "test_depend",
    "doc_depend",
]

def _strip_ns(tag: str) -> str:
    # handles "{namespace}tag"
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag

def parse_package_xml(path: Path) -> List[NormalizedDep]:
    """
    Extract ROS package dependencies from a package.xml.
    Returns NormalizedDep(kind="ros", name=..., evidence=...)
    """
    deps: List[NormalizedDep] = []

    try:
        text = path.read_text(errors="ignore")
        root = ET.fromstring(text)
    except Exception:
        return deps

    # We'll de-dup within a single file
    seen: Set[str] = set()

    # Walk all elements and capture known dependency tags
    for elem in root.iter():
        tag = _strip_ns(elem.tag)
        if tag not in DEP_TAGS:
            continue

        name = (elem.text or "").strip()
        if not name:
            continue

        # Ignore common placeholders
        if name in ("${PROJECT_NAME}",):
            continue

        if name in seen:
            continue
        seen.add(name)

        deps.append(
            NormalizedDep(
                kind="ros",
                name=name,
                spec=None,
                evidence=Evidence(
                    source=str(path.relative_to(path.parents[2])) if len(path.parents) >= 3 else str(path),
                    location=f"{path.name}:{tag}",
                    excerpt=f"<{tag}>{name}</{tag}>",
                ),
            )
        )

    return deps
