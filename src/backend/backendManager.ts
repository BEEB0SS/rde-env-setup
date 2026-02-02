import * as vscode from "vscode";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { getServices } from "../servicesSingleton";

const DEFAULT_BASE_URL = "http://127.0.0.1:8844";

let backendProc: ChildProcessWithoutNullStreams | undefined;
let readyPromise: Promise<string> | undefined;

type HealthResponse = {
  ok: boolean;
  service?: string;
  version?: string;
};


async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function isHealthy(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/health`, { method: "GET" });
    if (!res.ok) {
        return false;
    }

    const data = (await res.json()) as HealthResponse;
    return data.ok === true;
  } catch {
    return false;
  }
}


function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function pickPythonCommand(): { cmd: string; argsPrefix: string[] } {
  // Phase 0: simple heuristic
  if (process.platform === "win32") {
    return { cmd: "py", argsPrefix: ["-3"] };
  }
  return { cmd: "python3", argsPrefix: [] };
}

function spawnBackend(baseUrl: string) {
  const { backendLog } = getServices();

  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    throw new Error("No workspace folder open. Open a repo folder first.");
  }

  const backendDir = `${workspaceRoot}/backend`;
  const { cmd, argsPrefix } = pickPythonCommand();

  // Run: python -m rde_backend
  const args = [...argsPrefix, "-m", "rde_backend"];

  backendLog.appendLine(`[backend] spawning: ${cmd} ${args.join(" ")}`);
  backendLog.appendLine(`[backend] cwd: ${backendDir}`);

  backendProc = spawn(cmd, args, {
    cwd: backendDir,
    env: process.env,
  });

  backendProc.stdout.on("data", (buf) => backendLog.appendLine(buf.toString()));
  backendProc.stderr.on("data", (buf) => backendLog.appendLine(buf.toString()));

  backendProc.on("exit", (code, signal) => {
    backendLog.appendLine(`[backend] exited code=${code} signal=${signal}`);
    backendProc = undefined;
    readyPromise = undefined;
  });

  backendProc.on("error", (err) => {
    backendLog.appendLine(`[backend] process error: ${String(err)}`);
    backendProc = undefined;
    readyPromise = undefined;
  });
}

/**
 * Ensures the backend is running and healthy.
 * Returns the base URL when ready.
 */
export async function ensureBackendReady(): Promise<string> {
  const { backendLog } = getServices();
  const baseUrl = DEFAULT_BASE_URL;

  if (readyPromise) {
    return readyPromise;
  } 

  readyPromise = (async () => {
    // If already healthy, don’t spawn
    if (await isHealthy(baseUrl)) {
      backendLog.appendLine("[backend] already healthy.");
      return baseUrl;
    }

    // Spawn if not running
    if (!backendProc) {
      spawnBackend(baseUrl);
    }

    // Poll health
    const timeoutMs = 15_000;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      if (await isHealthy(baseUrl)) {
        backendLog.appendLine("[backend] healthy.");
        return baseUrl;
      }
      await sleep(250);
    }

    throw new Error("Backend did not become healthy within 15s. Check RDE Backend logs.");
  })();

  return readyPromise;
}
