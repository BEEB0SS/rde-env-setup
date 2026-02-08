import * as vscode from "vscode";
import { runOneClickWizard } from "./oneClickWizard";
import { getServices } from "../servicesSingleton";
import { ensureBackendReady } from "../backend/backendManager";
import { postJson } from "../backend/client";

type Diagnostic = {
  level: "info" | "warn" | "error";
  code: string;
  message: string;
  evidence?: {
    source: string;
    location: string;
    excerpt?: string | null;
  } | null;
};

type AnalyzeResponse = {
  repoPath: string;
  readme_path?: string | null;
  setup_intent?: any;
  dependencies?: any;
  fingerprint?: any;
  diagnostics?: Diagnostic[];
  notes?: string[];
};

export async function runOneClickSetup(): Promise<void> {
  const { log, solverLog, validatorLog } = getServices();

  try {
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
    log.appendLine("Ensuring backend is running...");
    const baseUrl = await ensureBackendReady();
    log.appendLine(`Backend ready at ${baseUrl}`);

    // Call /analyze
    log.appendLine("Calling /analyze ...");
    const analysis = await postJson<AnalyzeResponse>(baseUrl, "/analyze", {
      repoPath: workspaceRoot,
    });

    log.appendLine("Analyze response:");
    log.appendLine(JSON.stringify(analysis, null, 2));

    // Render diagnostics (Part 5)
    log.appendLine("");
    if (analysis?.diagnostics?.length) {
      log.appendLine("Diagnostics:");
      for (const d of analysis.diagnostics) {
        const where = d.evidence?.location ? ` (${d.evidence.location})` : "";
        log.appendLine(`- [${d.level}] ${d.code}: ${d.message}${where}`);
      }
    } else {
      log.appendLine("Diagnostics: none");
    }

    // (Optional) also show “notes” in validator channel, since they’re like meta-validation
    validatorLog.show(true);
    validatorLog.appendLine("Analyze notes:");
    if (analysis?.notes?.length) {
      for (const n of analysis.notes) {
        validatorLog.appendLine(`- ${n}`);
      }
    } else {
      validatorLog.appendLine("- (none)");
    }

    // Call /solve (still stub)
    solverLog.show(true);
    solverLog.appendLine("Calling /solve ...");
    const solve = await postJson<any>(baseUrl, "/solve", {
      repoPath: workspaceRoot,
      choices,
      analysis,
    });

    solverLog.appendLine("Solve response:");
    solverLog.appendLine(JSON.stringify(solve, null, 2));

    vscode.window.showInformationMessage("RDE: Analyze + diagnostics complete.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.appendLine(`ERROR: ${msg}`);
    vscode.window.showErrorMessage(`RDE failed: ${msg}`);
  }
}