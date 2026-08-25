"""
Quantum Maze - Quantum Engine Package
Real quantum computations via Qiskit and Qiskit Aer.
"""

from .engine import QuantumEngine
from .gates import GateInfo, GATE_COSTS, ALLOWED_GATES
from .states import StateInfo, compute_state_info
from .measurement import perform_measurement, collapse_subsystem
from .interference import compute_interference

__all__ = [
    "QuantumEngine",
    "GateInfo",
    "GATE_COSTS",
    "ALLOWED_GATES",
    "StateInfo",
    "compute_state_info",
    "perform_measurement",
    "collapse_subsystem",
    "compute_interference",
]
