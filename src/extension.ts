import * as vscode from "vscode";
import { createServices } from "./createServices";
import { setServices, getServices } from "./servicesSingleton";

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

    solverLog.appendLine("Solver channel test line.");
    validatorLog.appendLine("Validator channel test line.");
  });

  context.subscriptions.push(helloCmd, oneClickCmd);
}

export function deactivate() {}
