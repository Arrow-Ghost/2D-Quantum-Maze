"""
Quantum Maze - FastAPI Backend Server
Provides real Qiskit-driven quantum computing endpoints.
"""
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import qiskit

import os

from quantum.engine import QuantumEngine
from quantum.gates import GATE_COSTS, GATE_DESCRIPTIONS, get_gate_info

app = FastAPI(
    title="Quantum Maze Backend Engine",
    description="Real Qiskit-driven quantum computation engine for the Quantum Maze 2D Puzzle Game.",
    version="1.0.0",
)

# Enable CORS for Astro / Vercel frontend & local development
allowed_origins_env = os.environ.get("CORS_ORIGINS", "*")
if allowed_origins_env == "*":
    origins = ["*"]
else:
    origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = QuantumEngine()


# --- Request & Response Schemas ---

class HealthResponse(BaseModel):
    status: str
    engine: str
    qiskit_version: str
    message: str


class InitializeRequest(BaseModel):
    session_id: str = Field(..., description="Unique session or level ID")
    num_qubits: int = Field(1, ge=1, le=6, description="Number of qubits in circuit (1-6)")
    initial_gates: Optional[List[Dict[str, Any]]] = Field(None, description="Initial gates on circuit")
    level_seed: int = Field(42, description="Level deterministic seed")


class MoveRequest(BaseModel):
    session_id: str
    direction: str
    player_pos: List[int] = Field(..., description="[row, col] destination")
    rows: int
    cols: int
    wall_count: int
    level_seed: int
    exit_pos: List[int]
    checkpoints: List[List[int]] = []
    terminals: List[List[int]] = []
    objects: List[List[int]] = []
    active_target_checkpoint: Optional[List[int]] = None


class ApplyGateRequest(BaseModel):
    session_id: str
    gate: str
    target: int
    control: Optional[int] = None
    energy_available: int = Field(100, ge=0)


class MeasureRequest(BaseModel):
    session_id: str
    target: int
    energy_available: int = Field(100, ge=0)


class StateRequest(BaseModel):
    session_id: str


class EntangleRequest(BaseModel):
    session_id: str
    control: int
    target: int
    energy_available: int = Field(100, ge=0)


class ResetRequest(BaseModel):
    session_id: str
    initial_gates: Optional[List[Dict[str, Any]]] = None


class ValidateExitRequest(BaseModel):
    session_id: str
    condition_type: str = Field("probability_threshold", description="probability_threshold, collapsed_state, or entangled_pair")
    target_qubit: int = 0
    required_prob: float = 0.8
    required_state: int = 1


class ExecuteCircuitRequest(BaseModel):
    num_qubits: int = Field(..., ge=1, le=6)
    gates: List[Dict[str, Any]] = []


# --- Endpoints ---

@app.get("/health", response_model=HealthResponse)
def health_check():
    return HealthResponse(
        status="online",
        engine="Qiskit Quantum Engine",
        qiskit_version=qiskit.__version__,
        message="Quantum Computing Backend active. Real statevector and Aer simulation operational.",
    )


@app.get("/quantum/gates-info")
def get_all_gates_info():
    gates = {}
    for g, cost in GATE_COSTS.items():
        info = get_gate_info(g)
        if info:
            gates[g] = info.model_dump()
    return {"gates": gates}


@app.post("/quantum/initialize")
def initialize_circuit(req: InitializeRequest):
    try:
        res = engine.initialize(
            session_id=req.session_id,
            num_qubits=req.num_qubits,
            initial_gates=req.initial_gates,
            level_seed=req.level_seed,
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/game/move")
def process_player_move(req: MoveRequest):
    try:
        res = engine.handle_move(
            session_id=req.session_id,
            direction=req.direction,
            player_pos=(req.player_pos[0], req.player_pos[1]),
            rows=req.rows,
            cols=req.cols,
            wall_count=req.wall_count,
            level_seed=req.level_seed,
            exit_pos=(req.exit_pos[0], req.exit_pos[1]),
            checkpoints=[(c[0], c[1]) for c in req.checkpoints],
            terminals=[(t[0], t[1]) for t in req.terminals],
            objects=[(o[0], o[1]) for o in req.objects],
            active_target_checkpoint=(
                (req.active_target_checkpoint[0], req.active_target_checkpoint[1])
                if req.active_target_checkpoint
                else None
            ),
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/quantum/apply-gate")
def apply_gate(req: ApplyGateRequest):
    try:
        res = engine.apply_gate(
            session_id=req.session_id,
            gate=req.gate,
            target=req.target,
            control=req.control,
            energy_available=req.energy_available,
        )
        return res
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/quantum/measure")
def measure_qubit(req: MeasureRequest):
    try:
        res = engine.measure(
            session_id=req.session_id,
            target=req.target,
            energy_available=req.energy_available,
        )
        return res
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/quantum/state")
def get_quantum_state(req: StateRequest):
    try:
        res = engine.get_state(session_id=req.session_id)
        return res
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/quantum/entangle")
def entangle_qubits(req: EntangleRequest):
    try:
        # CNOT gate creates entanglement
        res = engine.apply_gate(
            session_id=req.session_id,
            gate="CNOT",
            target=req.target,
            control=req.control,
            energy_available=req.energy_available,
        )
        return res
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/quantum/reset")
def reset_circuit(req: ResetRequest):
    try:
        res = engine.reset(session_id=req.session_id, initial_gates=req.initial_gates)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/quantum/validate-exit")
def validate_exit(req: ValidateExitRequest):
    try:
        res = engine.validate_exit(
            session_id=req.session_id,
            condition_type=req.condition_type,
            target_qubit=req.target_qubit,
            required_prob=req.required_prob,
            required_state=req.required_state,
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/quantum/execute-circuit")
def execute_circuit(req: ExecuteCircuitRequest):
    try:
        res = engine.execute_arbitrary_circuit(
            num_qubits=req.num_qubits,
            gates=req.gates,
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run("main:app", host=host, port=port, reload=True)
