from typing import Any, Dict
import yaml
from pathlib import Path
from .constraints import ConstraintGraph

def load_rules(path: Path) -> Dict[str, Any]:
    return yaml.safe_load(path.read_text())

def apply_rules(g: ConstraintGraph, rules_obj: Dict[str, Any]) -> None:
    rules = rules_obj.get("rules", [])
    for r in rules:
        w = r.get("when", {})
        t = r.get("then", {})

        # match conditions
        ok = True
        if "os" in w and str(w["os"]).lower() not in g.os_name.lower():
            ok = False
        if "runTarget" in w and str(w["runTarget"]) != g.run_target:
            ok = False
        if "gpuPresent" in w and bool(w["gpuPresent"]) != g.gpu_present:
            ok = False
        if "nvccOk" in w and bool(w["nvccOk"]) != g.nvcc_ok:
            ok = False
        if "hasPackage" in w and str(w["hasPackage"]).lower() not in g.critical:
            ok = False

        if not ok:
            continue

        # apply
        pin = t.get("pin", {})
        for k, v in pin.items():
            g.pin_overrides[k.lower()] = v

        note = t.get("note")
        if note:
            g.reasons.append(note)

        warn = t.get("warn")
        if warn:
            g.warnings.append(warn)
