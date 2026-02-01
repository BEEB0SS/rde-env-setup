import * as vscode from "vscode";

export type Services = {
  log: vscode.OutputChannel;
  solverLog: vscode.OutputChannel;
  validatorLog: vscode.OutputChannel;
  backendLog: vscode.OutputChannel; // optional but strongly recommended
};
