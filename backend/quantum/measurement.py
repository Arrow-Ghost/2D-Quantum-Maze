"""
Quantum measurement and state collapse using Qiskit.
"""
from typing import Tuple, Dict, List, Optional
import numpy as np
from qiskit.quantum_info import Statevector
from qiskit import QuantumCircuit


def perform_measurement(
    sv: Statevector,
    qubit_index: int,
) -> Tuple[int, Statevector]:
    """
    Measures a single qubit using Qiskit's Statevector.measure method.
    Collapses the statevector to the post-measurement state and returns (outcome, post_sv).
    Outcome is 0 or 1.
    """
    num_qubits = sv.num_qubits
    if qubit_index < 0 or qubit_index >= num_qubits:
        raise ValueError(f"Qubit index {qubit_index} out of range [0, {num_qubits - 1}]")

    # Qiskit's measure method measures the specified qubit(s) and returns (outcome_str, post_statevector)
    # The outcome_str is in standard binary format
    outcome_str, post_sv = sv.measure([qubit_index])
    
    # Parse integer outcome (0 or 1)
    outcome = int(outcome_str)
    return outcome, post_sv


def measure_all_qubits(
    sv: Statevector,
) -> Tuple[str, Statevector]:
    """
    Measures all qubits simultaneously, collapsing the full statevector to a computational basis state.
    Returns (outcome_binary_str, post_sv).
    """
    num_qubits = sv.num_qubits
    outcome_str, post_sv = sv.measure(list(range(num_qubits)))
    return outcome_str, post_sv


def collapse_subsystem(
    sv: Statevector,
    qubit_index: int,
    desired_outcome: Optional[int] = None,
) -> Tuple[int, Statevector]:
    """
    Helper to collapse a single qubit. If desired_outcome is provided, forces projection (for testing/debug).
    Otherwise performs true physical Born-rule measurement via Qiskit.
    """
    if desired_outcome is not None:
        if desired_outcome not in (0, 1):
            raise ValueError("Outcome must be 0 or 1")
        
        # Project statevector onto basis state |desired_outcome> for qubit_index
        data = np.copy(sv.data)
        num_qubits = sv.num_qubits
        dim = 2 ** num_qubits

        for i in range(dim):
            bit = (i >> qubit_index) & 1
            if bit != desired_outcome:
                data[i] = 0.0

        norm = np.linalg.norm(data)
        if norm < 1e-12:
            raise ValueError(f"State has zero probability for qubit {qubit_index} in state |{desired_outcome}>")
        
        data = data / norm
        return desired_outcome, Statevector(data)

    return perform_measurement(sv, qubit_index)
