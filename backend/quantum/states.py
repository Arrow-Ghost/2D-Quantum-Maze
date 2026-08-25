"""
Statevector parsing, Dirac notation formatting, and probability extraction from Qiskit.
"""
import cmath
import math
import numpy as np
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field
from qiskit.quantum_info import Statevector, DensityMatrix, partial_trace


class BasisState(BaseModel):
    binary: str = Field(..., description="Basis state binary representation e.g. '00', '01'")
    amplitude_real: float
    amplitude_imag: float
    probability: float
    phase_radians: float
    phase_degrees: float


class QubitProbability(BaseModel):
    qubit: int
    p0: float = Field(..., description="Probability of measuring |0>")
    p1: float = Field(..., description="Probability of measuring |1>")
    phase_diff: float = Field(0.0, description="Relative phase between |1> and |0> in degrees")
    is_entangled: bool = Field(False, description="Whether this qubit is entangled with other qubits in the system")
    collapsed_state: Optional[int] = Field(None, description="0 or 1 if measured and collapsed, else None")


class StateInfo(BaseModel):
    num_qubits: int
    basis_states: List[BasisState]
    qubit_probabilities: List[QubitProbability]
    dirac_notation: str
    is_pure: bool = True
    purity: float = 1.0


def format_dirac_notation(basis_states: List[BasisState], num_qubits: int) -> str:
    """
    Constructs a readable Dirac notation string like 0.707|00> + 0.707|11>
    """
    terms = []
    for bs in basis_states:
        if bs.probability > 0.0001:
            mag = math.sqrt(bs.probability)
            phase_rad = bs.phase_radians
            
            # Format amplitude with sign/phase
            if abs(bs.amplitude_imag) < 1e-4:
                # Real amplitude
                val = bs.amplitude_real
                sign = "+" if val >= 0 else "-"
                term = f"{abs(val):.3f}|{bs.binary}⟩"
                terms.append((sign, term))
            else:
                # Complex amplitude
                c_val = complex(bs.amplitude_real, bs.amplitude_imag)
                sign = "+"
                term = f"({c_val.real:+.3f}{c_val.imag:+.3f}i)|{bs.binary}⟩"
                terms.append((sign, term))

    if not terms:
        return "|0⟩" if num_qubits == 1 else f"|{'0'*num_qubits}⟩"

    # Assemble formula
    first_sign, first_term = terms[0]
    result = first_term if first_sign == "+" else f"- {first_term}"
    for sign, term in terms[1:]:
        result += f" {sign} {term}"
    return result


def compute_state_info(
    sv: Statevector,
    collapsed_qubits: Optional[Dict[int, int]] = None,
) -> StateInfo:
    """
    Analyzes a Qiskit Statevector and returns comprehensive basis state probabilities,
    per-qubit marginal probabilities, Dirac notation, and entanglement status.
    """
    if collapsed_qubits is None:
        collapsed_qubits = {}

    num_qubits = sv.num_qubits
    dim = 2 ** num_qubits
    data = sv.data

    basis_states: List[BasisState] = []
    # Qiskit basis order: index i corresponds to binary string format(i, f'0{num_qubits}b')
    # Note that in Qiskit bit ordering, index binary string is [q_{n-1} ... q_1 q_0]
    probs = np.abs(data) ** 2

    for i in range(dim):
        # Format binary string with num_qubits digits
        bin_str = format(i, f"0{num_qubits}b")
        amp = data[i]
        prob = float(probs[i])
        phase = cmath.phase(amp)
        deg = math.degrees(phase)
        if deg < 0:
            deg += 360.0

        basis_states.append(
            BasisState(
                binary=bin_str,
                amplitude_real=float(amp.real),
                amplitude_imag=float(amp.imag),
                probability=round(prob, 6),
                phase_radians=round(phase, 6),
                phase_degrees=round(deg, 2),
            )
        )

    # Compute marginal single-qubit probabilities
    # In Qiskit, qubit index `q` is bit position `num_qubits - 1 - q` from left in binary string
    qubit_probs: List[QubitProbability] = []
    
    # Calculate density matrix for entanglement testing
    rho = DensityMatrix(sv)

    for q in range(num_qubits):
        if q in collapsed_qubits:
            val = collapsed_qubits[q]
            p0 = 1.0 if val == 0 else 0.0
            p1 = 1.0 if val == 1 else 0.0
            qubit_probs.append(
                QubitProbability(
                    qubit=q,
                    p0=p0,
                    p1=p1,
                    phase_diff=0.0,
                    is_entangled=False,
                    collapsed_state=val,
                )
            )
            continue

        # Marginalize over qubit q
        p0_sum = 0.0
        p1_sum = 0.0
        for i in range(dim):
            # Check bit at position q (from right in binary, or (i >> q) & 1)
            bit = (i >> q) & 1
            if bit == 0:
                p0_sum += float(probs[i])
            else:
                p1_sum += float(probs[i])

        # Relative phase calculation if 1 qubit or separable
        # Compute reduced density matrix for qubit q
        other_qubits = [k for k in range(num_qubits) if k != q]
        if other_qubits:
            red_rho = partial_trace(rho, other_qubits)
            # Von Neumann entropy or purity: Tr(rho^2)
            purity = float(np.real(np.trace(red_rho.data @ red_rho.data)))
            # A pure subsystem has purity = 1.0; entangled has purity < 0.999
            is_entangled = purity < 0.98
        else:
            is_entangled = False

        # Phase difference for single qubit
        phase_diff = 0.0
        if num_qubits == 1:
            amp0 = data[0]
            amp1 = data[1]
            phase0 = cmath.phase(amp0)
            phase1 = cmath.phase(amp1)
            diff_deg = math.degrees(phase1 - phase0) % 360.0
            phase_diff = round(diff_deg, 2)

        qubit_probs.append(
            QubitProbability(
                qubit=q,
                p0=round(p0_sum, 6),
                p1=round(p1_sum, 6),
                phase_diff=phase_diff,
                is_entangled=is_entangled,
                collapsed_state=None,
            )
        )

    dirac_str = format_dirac_notation(basis_states, num_qubits)

    return StateInfo(
        num_qubits=num_qubits,
        basis_states=basis_states,
        qubit_probabilities=qubit_probs,
        dirac_notation=dirac_str,
        is_pure=True,
        purity=1.0,
    )
