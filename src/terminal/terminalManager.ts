import * as vscode from "vscode";

let rdeTerminal: vscode.Terminal | null = null;

export function getOrCreateRdeTerminal(): vscode.Terminal {
  if (rdeTerminal) {
    return rdeTerminal;
  }
  rdeTerminal = vscode.window.createTerminal({ name: "RDE Runner" });
  return rdeTerminal;
}

export function runInRdeTerminal(command: string, reveal = true): void {
  const term = getOrCreateRdeTerminal();
  term.sendText(command, true);
  if (reveal) {
    term.show(true);
  }
}
