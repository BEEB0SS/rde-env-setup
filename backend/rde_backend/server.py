from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="RDE Backend", version="0.0.1")


@app.get("/health")
def health():
    return {"ok": True, "service": "rde-backend", "version": "0.0.1"}


class AnalyzeRequest(BaseModel):
    repoPath: str


class SolveRequest(BaseModel):
    repoPath: str
    choices: dict
    analysis: dict


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    # Phase 0 stub: return minimal payload
    return {
        "repoPath": req.repoPath,
        "readmeFound": False,
        "dependenciesFound": [],
        "notes": ["stub analyze response"],
    }


@app.post("/solve")
def solve(req: SolveRequest):
    # Phase 0 stub: echo choices back
    return {
        "repoPath": req.repoPath,
        "choices": req.choices,
        "decision": {"strategy": "stub", "python": "unknown"},
        "notes": ["stub solve response"],
    }


@app.post("/generate")
def generate(payload: dict):
    return {"ok": True, "notes": ["stub generate response"], "payload": payload}


@app.post("/validate")
def validate(payload: dict):
    return {"ok": True, "notes": ["stub validate response"], "payload": payload}


def main():
    # Fixed port for Phase 0. Later we can do dynamic ports.
    uvicorn.run("rde_backend.server:app", host="127.0.0.1", port=8844, log_level="info")
