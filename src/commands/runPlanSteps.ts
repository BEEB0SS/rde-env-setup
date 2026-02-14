import * as vscode from "vscode";
import type { PlanStep } from "../types/backendTypes";
import { runInRdeTerminal } from "../terminal/terminalManager";

export async function maybeRunPlanSteps(steps: PlanStep[]): Promise<void> {
  if (!steps.length) {
    return;
  }

  const pick = await vscode.window.showQuickPick(
    [
      { id: "safe", label: "Run safe steps", description: "Runs steps that do not require confirmation" },
      { id: "pick", label: "Pick a step to run", description: "Choose one step and run its commands" },
      { id: "none", label: "Don’t run anything", description: "" },
    ],
    { title: "Run generated commands?", ignoreFocusOut: true }
  );

  if (!pick || pick.id === "none") {
    return;
  }

  if (pick.id === "safe") {
    for (const s of steps) {
      if (s.requires_confirmation) {
        continue;
      }
      for (const cmd of s.commands ?? []) {
        runInRdeTerminal(cmd, true);
      }
    }
    return;
  }

  const stepPick = await vscode.window.showQuickPick(
    steps.map((s, i) => ({
      label: `${i + 1}. [${s.kind}] ${s.title}`,
      description: s.requires_confirmation ? "Requires confirmation" : "Safe",
      index: i,
    })),
    { title: "Pick a step to run", ignoreFocusOut: true }
  );

  if (!stepPick) {
    return;
  }
  const step = steps[stepPick.index];

  if (step.requires_confirmation) {
    const ok = await vscode.window.showWarningMessage(
      `Run step "${step.title}"?`,
      { modal: true },
      "Run"
    );
    if (ok !== "Run") {
        return;
    }
  }

  for (const cmd of step.commands ?? []) {
    runInRdeTerminal(cmd, true);
  }
}
