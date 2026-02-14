export type ConstraintsSummary = {
  os?: string | null;
  python_current?: string | null;
  python_current_full?: string | null;
  python_candidates?: string[];
  critical?: string[];
  pin_overrides?: Record<string, string>;
  warnings?: string[];
  reasons?: string[];
};

export type PlanStep = {
  kind: "env" | "ros" | "validate" | "misc";
  title: string;
  commands: string[];
  why: string;
  evidence?: Record<string, any> | null;
  requires_confirmation: boolean;
};

export type ResolutionAttempt = {
  tool: string;
  success: boolean;
  summary: string;
  stdout_tail: string;
  stderr_tail: string;
};

export type Conflict = {
  package?: string | null;
  message: string;
  raw?: string | null;
};

export type DecisionPointOption = {
  id: string;
  label: string;
  description: string;
};

export type DecisionPoint = {
  reason: string;
  options: DecisionPointOption[];
};

export type SolveDecision = {
  envType: string;
  runTarget: string;
  goal: string;
  strictness: string;
  pythonTarget?: string | null;
  ros2Distro?: string | null;
};

export type SolveResponse = {
  repoPath: string;
  decision: SolveDecision;
  constraints_summary: ConstraintsSummary;
  plan_steps: PlanStep[];
  resolution_attempts: ResolutionAttempt[];
  conflicts: Conflict[];
  schema_version: string;
  decision_point?: DecisionPoint | null;
  notes: string[];
};
