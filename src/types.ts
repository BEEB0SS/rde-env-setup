export type EnvType =
  | "conda"
  | "venv"
  | "docker"
  | "devcontainer"
  | "repoInstaller"
  | "planOnly";

export type RunTarget = "host" | "wsl2" | "container";
export type Goal = "cpu" | "gpu_if_available" | "auto";
export type Strictness = "compatible" | "latest";

export type SetupChoices = {
  envType: EnvType;
  runTarget: RunTarget;
  goal: Goal;
  strictness: Strictness;
};
