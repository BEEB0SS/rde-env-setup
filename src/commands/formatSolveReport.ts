import type { SolveResponse, PlanStep, ResolutionAttempt, Conflict, ConstraintsSummary } from "../types/backendTypes";


function indent(lines: string[], n = 2) {
  const pad = " ".repeat(n);
  return lines.map((l) => pad + l);
}

function tailLines(s: string, maxLines = 12) {
  const arr = (s || "").split("\n");
  return arr.slice(Math.max(0, arr.length - maxLines));
}

function formatConstraints(cs: ConstraintsSummary): string[] {
  const lines: string[] = [];
  if (cs.os) {
    lines.push(`OS: ${cs.os}`);
  }
  if (cs.python_current || cs.python_current_full) {
    const installed = cs.python_current_full ? ` (installed ${cs.python_current_full})` : "";
    lines.push(`Python: ${cs.python_current ?? ""}${installed}`.trim());
  }

  if (cs.python_candidates?.length) {
    lines.push(`Python candidates: ${cs.python_candidates.join(", ")}`);
  }
  if (cs.critical?.length) {
    lines.push(`Critical packages: ${cs.critical.join(", ")}`);
  }
  const pins = cs.pin_overrides ?? {};
  const pinKeys = Object.keys(pins);
  if (pinKeys.length) {
    lines.push("Pins:");
    for (const k of pinKeys.sort()) {
        lines.push(`- ${k}${pins[k]}`);
    }
  }

  for (const w of cs.warnings ?? []) {
    lines.push(`Warning: ${w}`);
  }
  for (const r of cs.reasons ?? []) {
    lines.push(`Note: ${r}`);
  }

  return lines;
}

function formatAttempts(attempts: ResolutionAttempt[]): string[] {
  const lines: string[] = [];
  if (!attempts.length) {
    return lines;
  }

  lines.push("Resolution attempts:");
  for (const a of attempts) {
    lines.push(`- ${a.tool}: ${a.success ? "OK" : "FAILED"}${a.summary ? ` (${a.summary})` : ""}`);
    if (!a.success && a.stderr_tail) {
      lines.push("  stderr (tail):");
      lines.push(...indent(tailLines(a.stderr_tail), 4));
    }
  }
  return lines;
}

function formatConflicts(conflicts: Conflict[]): string[] {
  const lines: string[] = [];
  if (!conflicts.length) {
    return lines;
  }

  lines.push("Conflicts:");
  for (const c of conflicts) {
    const pkg = c.package ? `${c.package}: ` : "";
    lines.push(`- ${pkg}${c.message}`);
    if (c.raw) {
        lines.push(...indent(tailLines(c.raw), 4));
    }
  }
  return lines;
}

function formatPlanSteps(steps: PlanStep[]): string[] {
  const lines: string[] = [];
  if (!steps.length) {
    return lines;
  }

  lines.push("Plan:");
  steps.forEach((s, i) => {
    lines.push(`${i + 1}. [${s.kind}] ${s.title}${s.requires_confirmation ? " (confirm)" : ""}`);
    if (s.why) {
        lines.push(...indent([`why: ${s.why}`], 3));
    }
    for (const cmd of s.commands ?? []) {
        lines.push(...indent([`$ ${cmd}`], 3));
    }
  });

  return lines;
}

export function formatSolveReport(solve: SolveResponse): string {
  const out: string[] = [];

  out.push(`Schema: ${solve.schema_version}`);
  out.push(`Repo: ${solve.repoPath}`);
  out.push(
    `Decision: env=${solve.decision.envType}, run=${solve.decision.runTarget}, goal=${solve.decision.goal}, strict=${solve.decision.strictness}` +
      (solve.decision.pythonTarget ? `, python=${solve.decision.pythonTarget}` : "") +
      (solve.decision.ros2Distro ? `, ros=${solve.decision.ros2Distro}` : "")
  );
  out.push("");

  const csLines = formatConstraints(solve.constraints_summary ?? {});
  if (csLines.length) {
    out.push("Constraints summary:");
    out.push(...indent(csLines, 2));
    out.push("");
  }

  const attemptLines = formatAttempts(solve.resolution_attempts ?? []);
  if (attemptLines.length) {
    out.push(...attemptLines);
    out.push("");
  }

  const conflictLines = formatConflicts(solve.conflicts ?? []);
  if (conflictLines.length) {
    out.push(...conflictLines);
    out.push("");
  }

  const planLines = formatPlanSteps(solve.plan_steps ?? []);
  if (planLines.length) {
    out.push(...planLines);
    out.push("");
  }

  if (solve.notes?.length) {
    out.push("Notes:");
    out.push(...indent(solve.notes.map((n) => `- ${n}`), 2));
    out.push("");
  }

  if (solve.decision_point) {
    out.push("Decision point pending:");
    out.push(...indent([solve.decision_point.reason], 2));
    for (const opt of solve.decision_point.options) {
      out.push(...indent([`- ${opt.id}: ${opt.label}${opt.description ? ` (${opt.description})` : ""}`], 2));
    }
    out.push("");
  }

  return out.join("\n");
}
