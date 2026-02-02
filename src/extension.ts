import * as vscode from "vscode";
import { createServices } from "./createServices";
import { setServices, getServices } from "./servicesSingleton";
import { runOneClickWizard } from "./commands/oneClickWizard";
import { runOneClickSetup } from "./commands/oneClickSetup";

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

  const helloCmd = vscode.commands.registerCommand("rde.helloWorld", () => {
    vscode.window.showInformationMessage("Hello World from RDE!");
    getServices().log.appendLine("helloWorld command invoked.");
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


  context.subscriptions.push(helloCmd, oneClickCmd);
}

export function deactivate() {}
