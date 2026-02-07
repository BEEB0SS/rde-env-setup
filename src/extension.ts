import * as vscode from "vscode";
import { createServices } from "./createServices";
import { setServices, getServices } from "./servicesSingleton";
import { runOneClickWizard } from "./commands/oneClickWizard";
import { runOneClickSetup } from "./commands/oneClickSetup";
import { registerVisualizerCommand } from "./visualizer/visualizer";
import * as fs from "fs";
import * as path from "path";
import { registerDiagnosticsView } from "./views/diagnosticsView";

export function activate(context: vscode.ExtensionContext) {
  const services = createServices();
  setServices(services);

  context.subscriptions.push(
    services.log,
    services.solverLog,
    services.validatorLog,
    services.backendLog
  );

  services.log.appendLine("RDE activated.");

  ensureErrorsForgeFile();
  registerDiagnosticsView(context);

  const aboutCmd = vscode.commands.registerCommand("rde.about", () => {
    const message = "Forge RDE | MVP Version 0.01 | Forged by Solus Labs";
    vscode.window.showInformationMessage(message);
    getServices().log.appendLine("about command invoked.");
  });

  const oneClickCmd = vscode.commands.registerCommand("rde.oneClickSetup", async () => {
  const { log, solverLog, validatorLog } = getServices();

  log.show(true);
  log.appendLine("One-Click Setup invoked.");

  const choices = await runOneClickWizard();
  if (!choices) {
    log.appendLine("User cancelled One-Click Setup.");
    return;
  }

  log.appendLine("User choices:");
  log.appendLine(JSON.stringify(choices, null, 2));

  // Phase 0: no real backend calls required yet.
  // But we can show that these logs are separated.
  solverLog.appendLine(`(stub) choices.envType=${choices.envType}`);
  validatorLog.appendLine(`(stub) runTarget=${choices.runTarget}`);
  });

  registerVisualizerCommand(context);

  context.subscriptions.push(aboutCmd, oneClickCmd);
}

export function deactivate() {}

function ensureErrorsForgeFile(): void {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    return;
  }

  const outputDir = path.join(workspaceRoot, ".rde");
  const filePath = path.join(outputDir, "errors.forge");
  if (fs.existsSync(filePath)) {
    return;
  }

  const template = {
    instructions:
      "This file is reserved for AI agents to record errors and solutions. Any AI agent working in this project should append new problem/solution pairs and consult existing entries before acting.",
    template: {
      problem: "Describe the issue encountered and relevant context.",
      solution: "Describe the fix applied or recommended.",
      metadata: {
        date: "YYYY-MM-DD",
        agent: "Agent name or identifier",
        related_files: ["path/to/file.ext"],
        notes: "Optional extra context"
      }
    },
    entries: []
  };

  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(template, null, 2), "utf-8");
  } catch {
    // Best-effort; no user-facing failure.
  }
}
