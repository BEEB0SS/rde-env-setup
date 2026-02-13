# backend/rde_backend/models.py
from pydantic import BaseModel
from typing import List, Optional, Literal, Dict, Any

class Evidence(BaseModel):
    source: str              # file path, e.g., "README.md"
    location: str            # e.g., "L120-L160" or "requirements.txt:4"
    excerpt: Optional[str] = None

class InstallBlock(BaseModel):
    heading_path: List[str]  # e.g. ["Installation", "Linux"]
    language: Optional[str] = None
    code: str
    evidence: Evidence

class SetupIntent(BaseModel):
    requirements_notes: List[str] = []
    known_issues: List[str] = []
    expected_commands: List[str] = []
    install_blocks: List[InstallBlock] = []

class NormalizedDep(BaseModel):
    kind: Literal["pip", "conda", "apt", "ros"]
    name: str
    spec: Optional[str] = None
    evidence: Evidence

class Diagnostic(BaseModel):
    level: Literal["info", "warn", "warning", "error"]
    code: str
    message: str
    evidence: Optional[Evidence] = None

class DependencySummary(BaseModel):
    pip: List[NormalizedDep] = []
    conda: List[NormalizedDep] = []
    apt: List[NormalizedDep] = []
    ros: List[NormalizedDep] = []

class Fingerprint(BaseModel):
    os: str
    os_version: str
    arch: str
    python_executables: List[str] = []
    python_versions: Dict[str, str] = {}
    gpu_present: bool = False
    nvidia_smi_ok: bool = False
    nvcc_ok: bool = False
    wsl_available: Optional[bool] = None

class AnalyzeRequest(BaseModel):
    repoPath: str

class AnalyzeResponse(BaseModel):
    repoPath: str
    readme_path: Optional[str] = None
    setup_intent: SetupIntent
    dependencies: DependencySummary
    fingerprint: Fingerprint
    diagnostics: List[Diagnostic] = []
    notes: List[str] = []

class PlanStep(BaseModel):
    title: str
    commands: List[str] = []
    why: str = ""
    evidence: Optional[Dict[str, Any]] = None
    requires_confirmation: bool = True

class ResolutionAttempt(BaseModel):
    tool: str                      # "uv" | "pip-tools" | "micromamba"
    success: bool
    summary: str = ""
    stdout_tail: str = ""
    stderr_tail: str = ""

class Conflict(BaseModel):
    package: Optional[str] = None
    message: str
    raw: Optional[str] = None

class DecisionPointOption(BaseModel):
    id: str
    label: str
    description: str = ""

class DecisionPoint(BaseModel):
    reason: str
    options: List[DecisionPointOption]

class SolveDecision(BaseModel):
    envType: str                   # conda|venv|docker|devcontainer|repo_installer|plan_only
    runTarget: str                 # host|wsl2|container
    goal: str                      # cpu_only|gpu_if_available|auto
    strictness: str                # compatible|recent
    pythonTarget: Optional[str] = None
    ros2Distro: Optional[str] = None

class SolveRequest(BaseModel):
    repoPath: str
    choices: Dict[str, Any]
    analysis: Dict[str, Any]

class SolveResponse(BaseModel):
    repoPath: str
    decision: SolveDecision
    constraints_summary: Dict[str, Any] = {}
    plan_steps: List[PlanStep] = []
    resolution_attempts: List[ResolutionAttempt] = []
    conflicts: List[Conflict] = []
    decision_point: Optional[DecisionPoint] = None
    notes: List[str] = []