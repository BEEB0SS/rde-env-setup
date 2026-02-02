import * as vscode from "vscode";
import { runOneClickWizard } from "./oneClickWizard";
import { getServices } from "../servicesSingleton";
import { ensureBackendReady } from "../backend/backendManager";
import { postJson } from "../backend/client";

export async function runOneClickSetup(): Promise<void> {
  const { log, solverLog } = getServices();

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showErrorMessage("Open a repo folder first (File → Open Folder).");
    return;
  }

  log.show(true);
  log.appendLine("One-Click Setup invoked.");

  const choices = await runOneClickWizard();
  if (!choices) {
    log.appendLine("User cancelled One-Click Setup.");
    return;
  }
  log.appendLine("Choices:");
  log.appendLine(JSON.stringify(choices, null, 2));

  // Ensure backend is running
  const baseUrl = await ensureBackendReady();

  // Call stub /analyze
  const analysis = await postJson<any>(baseUrl, "/analyze", { repoPath: workspaceRoot });
  log.appendLine("Analyze response:");
  log.appendLine(JSON.stringify(analysis, null, 2));

  // Call stub /solve
  const solve = await postJson<any>(baseUrl, "/solve", {
    repoPath: workspaceRoot,
    choices,
    analysis,
  });

  solverLog.show(true);
  solverLog.appendLine("Solve response:");
  solverLog.appendLine(JSON.stringify(solve, null, 2));

  vscode.window.showInformationMessage("RDE: Phase 0 backend plumbing is working.");
}
