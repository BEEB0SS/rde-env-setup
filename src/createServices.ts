import * as vscode from "vscode";
import type { Services } from "./services";

export function createServices(): Services {
  const log = vscode.window.createOutputChannel("RDE");
  const solverLog = vscode.window.createOutputChannel("RDE Solver");
  const validatorLog = vscode.window.createOutputChannel("RDE Validator");
  const backendLog = vscode.window.createOutputChannel("RDE Backend");

  return { log, solverLog, validatorLog, backendLog };
}
