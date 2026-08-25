"""
Gate specifications, energy costs, and validation logic for Quantum Maze.
"""
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

GATE_COSTS: Dict[str, int] = {
    "H": 10,
    "X": 5,
    "Z": 5,
    "CNOT": 20,
    "CX": 20,
    "Y": 5,
    "S": 5,
    "T": 5,
    "M": 15,
}

GATE_DESCRIPTIONS: Dict[str, str] = {
    "H": "Hadamard Gate: Creates equal superposition (|0> -> (|0>+|1>)/sqrt(2), |1> -> (|0>-|1>)/sqrt(2)).",
    "X": "Pauli-X Gate: Quantum NOT gate, bit-flip (|0> -> |1>, |1> -> |0>).",
    "Z": "Pauli-Z Gate: Phase-flip (|0> -> |0>, |1> -> -|1>). Essential for quantum interference.",
    "CNOT": "Controlled-NOT: Inverts target qubit if and only if control qubit is |1>. Creates quantum entanglement.",
    "CX": "Controlled-NOT: Synonym for CNOT.",
    "Y": "Pauli-Y Gate: Bit and phase flip (|0> -> i|1>, |1> -> -i|0>).",
    "S": "Phase Gate S: Applies pi/2 phase shift (|1> -> i|1>).",
    "T": "Phase Gate T: Applies pi/4 phase shift (|1> -> e^(i*pi/4)|1>).",
    "M": "Measurement: Collapses quantum superposition into a definite classical state (|0> or |1>).",
}

ALLOWED_GATES = list(GATE_COSTS.keys())


class GateOperation(BaseModel):
    gate: str = Field(..., description="Gate identifier: H, X, Z, CNOT/CX, Y, S, T, M")
    target: int = Field(..., description="Target qubit index (0-indexed)")
    control: Optional[int] = Field(None, description="Control qubit index for 2-qubit gates like CNOT")


class GateInfo(BaseModel):
    name: str
    symbol: str
    cost: int
    num_qubits: int
    description: str


def get_gate_info(gate_name: str) -> Optional[GateInfo]:
    norm_name = gate_name.upper()
    if norm_name not in GATE_COSTS:
        return None
    
    num_qubits = 2 if norm_name in ["CNOT", "CX"] else 1
    symbol = norm_name
    if norm_name in ["CNOT", "CX"]:
        symbol = "CX"

    return GateInfo(
        name=norm_name,
        symbol=symbol,
        cost=GATE_COSTS[norm_name],
        num_qubits=num_qubits,
        description=GATE_DESCRIPTIONS.get(norm_name, "Quantum Gate Operation"),
    )


def validate_gate_operation(num_qubits: int, op: GateOperation, energy_available: int) -> Dict[str, any]:
    """
    Validates if a gate can be applied given current circuit size and energy.
    Returns dict: {"valid": bool, "error": str or None, "cost": int}
    """
    gate = op.gate.upper()
    if gate not in GATE_COSTS:
        return {
            "valid": False,
            "error": f"Unknown quantum gate '{op.gate}'. Allowed gates: {ALLOWED_GATES}",
            "cost": 0,
        }

    cost = GATE_COSTS[gate]
    if energy_available < cost:
        return {
            "valid": False,
            "error": f"Insufficient quantum energy. Required: {cost} QE, Available: {energy_available} QE.",
            "cost": cost,
        }

    if op.target < 0 or op.target >= num_qubits:
        return {
            "valid": False,
            "error": f"Target qubit q{op.target} out of range (Circuit has {num_qubits} qubits: q0 to q{num_qubits - 1}).",
            "cost": cost,
        }

    if gate in ["CNOT", "CX"]:
        if op.control is None:
            return {
                "valid": False,
                "error": "CNOT gate requires a valid control qubit index.",
                "cost": cost,
            }
        if op.control < 0 or op.control >= num_qubits:
            return {
                "valid": False,
                "error": f"Control qubit q{op.control} out of range (Circuit has {num_qubits} qubits).",
                "cost": cost,
            }
        if op.control == op.target:
            return {
                "valid": False,
                "error": "Control and target qubits cannot be the same qubit.",
                "cost": cost,
            }

    return {"valid": True, "error": None, "cost": cost}
