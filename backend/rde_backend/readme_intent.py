# backend/rde_backend/readme_intent.py
from __future__ import annotations
from pathlib import Path
from typing import List, Optional, Tuple
import re

from .models import SetupIntent, InstallBlock, Evidence

HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)\s*$")
FENCE_RE = re.compile(r"^```(\w+)?\s*$")

KEYWORDS_INSTALL = {"install", "installation", "setup", "getting started", "quickstart"}
KEYWORDS_REQ = {"requirements", "dependencies", "prerequisites", "prereqs"}
KEYWORDS_ISSUES = {"known issues", "troubleshooting", "faq", "common issues"}
KEYWORDS_OS = {"windows", "linux", "mac", "wsl", "ubuntu", "cuda", "gpu", "nvidia"}

def _line_range(start: int, end: int) -> str:
    return f"L{start}-L{end}"

def parse_readme(readme_path: Path) -> SetupIntent:
    text = readme_path.read_text(errors="ignore")
    lines = text.splitlines()

    heading_stack: List[str] = []
    intent = SetupIntent()

    def push_note(bucket: List[str], s: str):
        s = s.strip()
        if s and s not in bucket:
            bucket.append(s)

    i = 0
    while i < len(lines):
        line = lines[i]

        # headings
        m = HEADING_RE.match(line)
        if m:
            level = len(m.group(1))
            title = m.group(2).strip()
            # truncate stack to level-1
            heading_stack[:] = heading_stack[: max(0, level - 1)]
            heading_stack.append(title)
            i += 1
            continue

        # fenced code blocks
        m = FENCE_RE.match(line)
        if m:
            lang = m.group(1)
            start_line = i + 1
            code_lines: List[str] = []
            i += 1
            while i < len(lines) and not lines[i].startswith("```"):
                code_lines.append(lines[i])
                i += 1
            end_line = i + 1 if i < len(lines) else i

            code = "\n".join(code_lines).strip()
            if code:
                hp = heading_stack.copy()
                evidence = Evidence(
                    source=str(readme_path.relative_to(readme_path.parent)),
                    location=_line_range(start_line, end_line),
                    excerpt=None,
                )
                intent.install_blocks.append(
                    InstallBlock(heading_path=hp, language=lang, code=code, evidence=evidence)
                )

                # if heading indicates install/req/issues, also populate other fields
                hjoined = " / ".join(hp).lower()
                if any(k in hjoined for k in KEYWORDS_INSTALL):
                    push_note(intent.expected_commands, f"See install block under: {hjoined}")
                if any(k in hjoined for k in KEYWORDS_REQ):
                    push_note(intent.requirements_notes, f"See requirements block under: {hjoined}")
                if any(k in hjoined for k in KEYWORDS_ISSUES):
                    push_note(intent.known_issues, f"See troubleshooting block under: {hjoined}")

            # consume closing fence
            i += 1
            continue

        # simple keyword-driven notes (single-line)
        low = line.lower()
        if any(k in low for k in KEYWORDS_OS):
            # keep short, don’t spam
            if len(line.strip()) > 0 and len(line.strip()) < 200:
                push_note(intent.requirements_notes, line.strip())

        i += 1

    return intent
