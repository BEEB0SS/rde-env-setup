import * as vscode from "vscode";
import type { EnvType, Goal, RunTarget, SetupChoices, Strictness } from "../types";

type PickItem<T extends string> = vscode.QuickPickItem & { value: T };

function isWindows(): boolean {
  return process.platform === "win32";
}

/**
 * Step 1: Env type selection
 * (Order exactly as you requested)
 */
async function pickEnvType(): Promise<EnvType | undefined> {
  const items: PickItem<EnvType>[] = [
    {
      label: "Conda environment",
      description: "Generate environment.yml (and later: lockfile)",
      value: "conda",
    },
    {
      label: "Python venv",
      description: "Generate venv + requirements lock",
      value: "venv",
    },
    {
      label: "Docker (Dockerfile)",
      description: "Generate a Dockerfile and setup script",
      value: "docker",
    },
    {
      label: "Dev Container (.devcontainer)",
      description: "Generate devcontainer.json + Dockerfile",
      value: "devcontainer",
    },
    {
      label: "Use repo installer (setup.py / install.sh) with safety plan",
      description: "Plan first, then optionally run installer",
      value: "repoInstaller",
    },
    {
      label: "Just give me the plan (no files generated)",
      description: "Analyze + resolve + report only",
      value: "planOnly",
    },
  ];

  const picked = await vscode.window.showQuickPick(items, {
    title: "RDE: One-Click Setup",
    placeHolder: "How do you want this environment configured?",
    ignoreFocusOut: true,
  });

  return picked?.value;
}

/**
 * Step 2: Where should this run?
 * - Host always available
 * - WSL2 only if Windows
 * - Container only if Docker/devcontainer selected
 */
async function pickRunTarget(envType: EnvType): Promise<RunTarget | undefined> {
  const items: PickItem<RunTarget>[] = [];

  items.push({
    label: "Host machine",
    description: "Run directly on this machine",
    value: "host",
  });

  if (isWindows()) {
    items.push({
      label: "WSL2",
      description: "Run inside WSL2 (optional)",
      value: "wsl2",
    });
  }

  if (envType === "docker" || envType === "devcontainer") {
    items.push({
      label: "Container",
      description: "Run inside a container environment",
      value: "container",
    });
  }

  const picked = await vscode.window.showQuickPick(items, {
    title: "RDE: One-Click Setup",
    placeHolder: "Where should this environment run?",
    ignoreFocusOut: true,
  });

  return picked?.value;
}

/**
 * Step 3: CPU/GPU goal
 */
async function pickGoal(): Promise<Goal | undefined> {
  const items: PickItem<Goal>[] = [
    {
      label: "CPU only",
      description: "Prefer CPU installs even if GPU exists",
      value: "cpu",
    },
    {
      label: "GPU if available",
      description: "Use GPU if detected and supported",
      value: "gpu_if_available",
    },
    {
      label: "I don’t know (auto-detect and propose)",
      description: "Let RDE decide based on repo + machine",
      value: "auto",
    },
  ];

  const picked = await vscode.window.showQuickPick(items, {
    title: "RDE: One-Click Setup",
    placeHolder: "What’s the goal for compute?",
    ignoreFocusOut: true,
  });

  return picked?.value;
}

/**
 * Step 4: Strictness
 */
async function pickStrictness(): Promise<Strictness | undefined> {
  const items: PickItem<Strictness>[] = [
    {
      label: "Most compatible (conservative pins)",
      description: "Prefer stability and known-good combinations",
      value: "compatible",
    },
    {
      label: "Most recent possible (aggressive upgrades)",
      description: "Prefer newest versions when possible",
      value: "latest",
    },
  ];

  const picked = await vscode.window.showQuickPick(items, {
    title: "RDE: One-Click Setup",
    placeHolder: "How strict should version selection be?",
    ignoreFocusOut: true,
  });

  return picked?.value;
}

/**
 * Main wizard: returns SetupChoices or undefined if user cancels at any step.
 */
export async function runOneClickWizard(): Promise<SetupChoices | undefined> {
  const envType = await pickEnvType();
  if (!envType) {
    return undefined;
  }

  const runTarget = await pickRunTarget(envType);
  if (!runTarget) {
    return undefined;
  }

  const goal = await pickGoal();
  if (!goal) {
    return undefined;
  }

  const strictness = await pickStrictness();
  if (!strictness) {
    return undefined;
  }

  return { envType, runTarget, goal, strictness };
}
