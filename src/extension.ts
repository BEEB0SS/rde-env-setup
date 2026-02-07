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

    await runOneClickSetup();
  });


  context.subscriptions.push(helloCmd, oneClickCmd);
}

export function deactivate() {}
