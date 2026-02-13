import subprocess
from typing import List, Tuple

def run_cmd(cmd: List[str], cwd: str, timeout_s: int = 60) -> Tuple[int, str, str]:
    p = subprocess.run(
        cmd,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=timeout_s,
    )
    return p.returncode, p.stdout, p.stderr

def tail(s: str, n: int = 2000) -> str:
    return s[-n:] if s else ""
