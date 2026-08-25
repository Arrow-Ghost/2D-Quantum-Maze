"""
Circuit definitions, templates, and serialization for Quantum Maze.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from qiskit import QuantumCircuit


class GateEntry(BaseModel):
    id: str
    gate: str
    target: int
    control: Optional[int] = None
    param: Optional[float] = None
    step: int = 0


class CircuitState(BaseModel):
    num_qubits: int
    gates: List[GateEntry] = []
    ascii_diagram: str = ""


def build_qiskit_circuit(num_qubits: int, gates: List[GateEntry]) -> QuantumCircuit:
    """
    Constructs a Qiskit QuantumCircuit from a list of GateEntry specifications.
    """
    qc = QuantumCircuit(num_qubits)
    for entry in gates:
        gate_name = entry.gate.upper()
        if gate_name == "H":
            qc.h(entry.target)
        elif gate_name == "X":
            qc.x(entry.target)
        elif gate_name == "Z":
            qc.z(entry.target)
        elif gate_name == "Y":
            qc.y(entry.target)
        elif gate_name == "S":
            qc.s(entry.target)
        elif gate_name == "T":
            qc.t(entry.target)
        elif gate_name in ["CNOT", "CX"]:
            if entry.control is not None:
                qc.cx(entry.control, entry.target)
        elif gate_name == "RY":
            param = entry.param if entry.param is not None else 0.0
            qc.ry(param, entry.target)
        elif gate_name == "RX":
            param = entry.param if entry.param is not None else 0.0
            qc.rx(param, entry.target)
        elif gate_name == "RZ":
            param = entry.param if entry.param is not None else 0.0
            qc.rz(param, entry.target)
        elif gate_name in ["P", "PHASE"]:
            param = entry.param if entry.param is not None else 0.0
            qc.p(param, entry.target)
        # Note: Measurement operations are handled through state projection / collapse
    return qc


def render_ascii_circuit(qc: QuantumCircuit) -> str:
    """
    Renders ASCII representation of a quantum circuit.
    """
    try:
        return str(qc.draw(output="text"))
    except Exception:
        # Fallback simple diagram
        lines = []
        for q in range(qc.num_qubits):
            lines.append(f"q{q}: ──[|0⟩]──")
        return "\n".join(lines)
