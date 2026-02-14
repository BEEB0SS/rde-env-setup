import * as vscode from "vscode";
import type { DecisionPoint } from "../types/backendTypes";

export async function handleDecisionPoint(dp: DecisionPoint): Promise<string | null> {
  const pick = await vscode.window.showQuickPick(
    dp.options.map((o) => ({
      label: o.label,
      description: o.description,
      detail: o.id,
    })),
    { title: dp.reason, ignoreFocusOut: true }
  );

  return pick?.detail ?? null;
}
