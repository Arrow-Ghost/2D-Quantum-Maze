"""
Quantum interference calculation and analysis.
Demonstrates Mach-Zehnder style constructive and destructive amplitude interference.
"""
import math
from typing import Dict, Any
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector


def compute_interference(phase_angle_radians: float = 0.0) -> Dict[str, Any]:
    """
    Simulates a 1-qubit Mach-Zehnder quantum interferometer:
    |0> -> H -> Phase(theta) -> H -> Final State

    Constructive/Destructive interference determines whether output emerges in |0> or |1>.
    """
    qc = QuantumCircuit(1)
    qc.h(0)
    qc.p(phase_angle_radians, 0)
    qc.h(0)

    sv = Statevector.from_instruction(qc)
    probs = sv.probabilities()

    p0 = float(probs[0])
    p1 = float(probs[1])

    # Categorize interference nature
    if math.isclose(p0, 1.0, abs_tol=1e-3):
        interference_type = "Constructive (|0⟩)"
        description = "Amplitudes constructively interfere into channel |0⟩ (100% probability)."
    elif math.isclose(p1, 1.0, abs_tol=1e-3):
        interference_type = "Destructive (|0⟩) / Constructive (|1⟩)"
        description = "Phase shift caused complete destructive cancellation in channel |0⟩; 100% output in channel |1⟩."
    else:
        interference_type = "Partial Interference"
        description = f"Superposition split: {p0*100:.1f}% into channel |0⟩, {p1*100:.1f}% into channel |1⟩."

    return {
        "phase_angle_degrees": round(math.degrees(phase_angle_radians), 2),
        "phase_angle_radians": round(phase_angle_radians, 4),
        "p0": round(p0, 6),
        "p1": round(p1, 6),
        "interference_type": interference_type,
        "description": description,
    }
