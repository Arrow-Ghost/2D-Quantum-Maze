"""
Core QuantumEngine class managing active Qiskit quantum circuits and state simulations.
"""
import uuid
import math
from typing import Dict, List, Optional, Any, Tuple
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

from .gates import GateOperation, validate_gate_operation, GATE_COSTS, get_gate_info
from .circuits import GateEntry, build_qiskit_circuit, render_ascii_circuit
from .states import StateInfo, compute_state_info
from .measurement import perform_measurement, collapse_subsystem
from .maze import generate_dynamic_walls, bfs_path_exists


class CircuitSession:
    def __init__(
        self,
        session_id: str,
        num_qubits: int = 1,
        initial_gates: Optional[List[GateEntry]] = None,
        level_seed: int = 42,
    ):
        self.session_id = session_id
        self.num_qubits = max(1, min(6, num_qubits))
        self.level_seed = level_seed
        self.gates: List[GateEntry] = list(initial_gates or [])
        self.movement_gates: List[GateEntry] = []
        self.collapsed_qubits: Dict[int, int] = {}
        self.current_statevector: Optional[Statevector] = None
        self.step_counter: int = len(self.gates)
        self.move_count: int = 0
        self.checkpoint_activated: bool = False
        self.player_pos: Tuple[int, int] = (1, 1)
        self.current_walls: List[Tuple[int, int]] = []
        self.history: List[Dict[str, Any]] = []
        self._recompute_state()

    def _recompute_state(self):
        """
        Recomputes the current statevector from initial gates + movement evolution + applied gates.
        """
        all_gates = self.gates + self.movement_gates
        qc = build_qiskit_circuit(self.num_qubits, all_gates)
        sv = Statevector.from_instruction(qc)

        if self.collapsed_qubits:
            for q_idx, val in self.collapsed_qubits.items():
                try:
                    _, sv = collapse_subsystem(sv, q_idx, desired_outcome=val)
                except Exception:
                    pass

        self.current_statevector = sv

    def evolve_movement_quantum_state(self, direction: str, player_pos: Tuple[int, int]):
        """
        Evolves the quantum circuit state dynamically based on the player's physical movement.
        Applies a rotation angle theta = f(x, y, move_count, direction, seed).
        """
        self.move_count += 1
        self.player_pos = player_pos

        dir_idx = {"UP": 1, "DOWN": 2, "LEFT": 3, "RIGHT": 4}.get(direction.upper(), 0)
        
        # Calculate continuous rotation angle in radians [0, 2*pi)
        angle_deg = (
            (player_pos[0] * 37 + player_pos[1] * 23 + self.move_count * 41 + dir_idx * 17 + self.level_seed * 13)
            % 360
        )
        theta = (angle_deg / 360.0) * (2 * math.pi)

        # Update movement evolution gate with physical rotation RY(theta)
        entry = GateEntry(
            id=f"move_{self.move_count}",
            gate="RY",
            target=0,
            param=round(theta, 4),
            step=self.step_counter + self.move_count,
        )
        
        # We maintain a dynamic superposition parameter
        self.movement_gates = [entry]
        self._recompute_state()

    def apply_gate(
        self,
        gate: str,
        target: int,
        control: Optional[int] = None,
        param: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Applies a quantum gate to the circuit and recalculates the statevector.
        """
        gate_name = gate.upper()
        # If target qubit was previously collapsed and we apply a new unitary gate, it evolves from the collapsed state
        if target in self.collapsed_qubits:
            del self.collapsed_qubits[target]
        if control is not None and control in self.collapsed_qubits:
            del self.collapsed_qubits[control]

        entry = GateEntry(
            id=str(uuid.uuid4())[:8],
            gate=gate_name,
            target=target,
            control=control,
            param=param,
            step=self.step_counter + 1,
        )
        self.gates.append(entry)
        self.step_counter += 1

        self._recompute_state()
        
        self.history.append({
            "action": "apply_gate",
            "gate": gate_name,
            "target": target,
            "control": control,
            "step": self.step_counter,
        })

        return {
            "success": True,
            "gate_entry": entry.model_dump(),
            "state_info": self.get_state_info().model_dump(),
            "ascii_diagram": self.get_ascii_diagram(),
        }

    def measure(self, target: int) -> Dict[str, Any]:
        """
        Performs physical Born-rule measurement on target qubit using Qiskit.
        Permanently collapses target qubit until a new unitary gate is applied.
        """
        if self.current_statevector is None:
            self._recompute_state()

        outcome, post_sv = perform_measurement(self.current_statevector, target)
        self.collapsed_qubits[target] = outcome
        self.current_statevector = post_sv

        # Record measurement in circuit history
        entry = GateEntry(
            id=str(uuid.uuid4())[:8],
            gate="M",
            target=target,
            control=None,
            step=self.step_counter + 1,
        )
        self.gates.append(entry)
        self.step_counter += 1

        self.history.append({
            "action": "measure",
            "target": target,
            "outcome": outcome,
            "step": self.step_counter,
        })

        return {
            "success": True,
            "target_qubit": target,
            "outcome": outcome,
            "gate_entry": entry.model_dump(),
            "state_info": self.get_state_info().model_dump(),
            "ascii_diagram": self.get_ascii_diagram(),
        }

    def get_state_info(self) -> StateInfo:
        if self.current_statevector is None:
            self._recompute_state()
        return compute_state_info(self.current_statevector, self.collapsed_qubits)

    def get_ascii_diagram(self) -> str:
        qc = build_qiskit_circuit(self.num_qubits, self.gates)
        return render_ascii_circuit(qc)

    def reset(self, initial_gates: Optional[List[GateEntry]] = None):
        self.gates = list(initial_gates or [])
        self.collapsed_qubits.clear()
        self.step_counter = len(self.gates)
        self._recompute_state()


class QuantumEngine:
    """
    Central Manager for quantum sessions in the game.
    """
    def __init__(self):
        self.sessions: Dict[str, CircuitSession] = {}

    def get_or_create_session(
        self,
        session_id: str,
        num_qubits: int = 1,
        initial_gates: Optional[List[GateEntry]] = None,
    ) -> CircuitSession:
        if session_id not in self.sessions:
            self.sessions[session_id] = CircuitSession(
                session_id=session_id,
                num_qubits=num_qubits,
                initial_gates=initial_gates,
            )
        return self.sessions[session_id]

    def initialize(
        self,
        session_id: str,
        num_qubits: int = 1,
        initial_gates: Optional[List[Dict[str, Any]]] = None,
        level_seed: int = 42,
    ) -> Dict[str, Any]:
        parsed_gates = []
        if initial_gates:
            for g in initial_gates:
                parsed_gates.append(GateEntry(**g))

        session = CircuitSession(
            session_id=session_id,
            num_qubits=num_qubits,
            initial_gates=parsed_gates,
            level_seed=level_seed,
        )
        self.sessions[session_id] = session

        return {
            "session_id": session_id,
            "num_qubits": session.num_qubits,
            "gates": [g.model_dump() for g in session.gates],
            "state_info": session.get_state_info().model_dump(),
            "ascii_diagram": session.get_ascii_diagram(),
            "move_count": session.move_count,
        }

    def handle_move(
        self,
        session_id: str,
        direction: str,
        player_pos: Tuple[int, int],
        rows: int,
        cols: int,
        wall_count: int,
        level_seed: int,
        exit_pos: Tuple[int, int],
        checkpoints: List[Tuple[int, int]],
        terminals: List[Tuple[int, int]],
        objects: List[Tuple[int, int]],
        active_target_checkpoint: Optional[Tuple[int, int]] = None,
    ) -> Dict[str, Any]:
        """
        Processes a valid player movement:
        1. Generates 100% solvable new dynamic wall layout with exact wall count.
        2. Evolves quantum circuit state and computes new exit probability from Qiskit.
        3. Checks if player activated a checkpoint or unlocked the exit.
        """
        session = self.get_or_create_session(session_id, 1, None)
        session.level_seed = level_seed

        # 1. Generate new dynamic walls
        new_walls = generate_dynamic_walls(
            rows=rows,
            cols=cols,
            wall_count=wall_count,
            level_seed=level_seed,
            move_count=session.move_count + 1,
            player_pos=player_pos,
            exit_pos=exit_pos,
            checkpoint_positions=checkpoints,
            terminal_positions=terminals,
            object_positions=objects,
            active_target_checkpoint=active_target_checkpoint,
            previous_walls=session.current_walls,
        )
        session.current_walls = new_walls

        # 2. Evolve quantum circuit state
        session.evolve_movement_quantum_state(direction, player_pos)
        state_info = session.get_state_info()

        # Extract exit probability (P(1) on target qubit 0)
        exit_prob = state_info.qubit_probabilities[0].p1 if state_info.qubit_probabilities else 0.5

        # 3. Check checkpoint activation
        checkpoint_reached = player_pos in checkpoints
        if checkpoint_reached:
            session.checkpoint_activated = True

        return {
            "valid_move": True,
            "player": {"r": player_pos[0], "c": player_pos[1]},
            "move_count": session.move_count,
            "walls": [{"r": w[0], "c": w[1]} for w in new_walls],
            "wall_count": len(new_walls),
            "state_info": state_info.model_dump(),
            "exit_probability": round(exit_prob, 6),
            "checkpoint_activated": session.checkpoint_activated,
            "exit": {
                "r": exit_pos[0],
                "c": exit_pos[1],
                "unlocked": session.checkpoint_activated and exit_prob >= 0.70,
            },
            "ascii_diagram": session.get_ascii_diagram(),
        }

    def apply_gate(
        self,
        session_id: str,
        gate: str,
        target: int,
        control: Optional[int] = None,
        energy_available: int = 100,
    ) -> Dict[str, Any]:
        if session_id not in self.sessions:
            raise ValueError(f"Session '{session_id}' not found. Please initialize level circuit first.")

        session = self.sessions[session_id]
        op = GateOperation(gate=gate, target=target, control=control)
        validation = validate_gate_operation(session.num_qubits, op, energy_available)

        if not validation["valid"]:
            return {
                "success": False,
                "error": validation["error"],
                "energy_cost": 0,
            }

        result = session.apply_gate(gate=gate, target=target, control=control)
        result["energy_cost"] = validation["cost"]
        return result

    def measure(
        self,
        session_id: str,
        target: int,
        energy_available: int = 100,
    ) -> Dict[str, Any]:
        if session_id not in self.sessions:
            raise ValueError(f"Session '{session_id}' not found.")

        session = self.sessions[session_id]
        if target < 0 or target >= session.num_qubits:
            return {
                "success": False,
                "error": f"Qubit q{target} out of range [0, {session.num_qubits - 1}].",
                "energy_cost": 0,
            }

        cost = GATE_COSTS["M"]
        if energy_available < cost:
            return {
                "success": False,
                "error": f"Insufficient energy for measurement. Required: {cost} QE, Available: {energy_available} QE.",
                "energy_cost": 0,
            }

        result = session.measure(target=target)
        result["energy_cost"] = cost
        return result

    def get_state(self, session_id: str) -> Dict[str, Any]:
        if session_id not in self.sessions:
            raise ValueError(f"Session '{session_id}' not found.")
        session = self.sessions[session_id]
        return {
            "session_id": session_id,
            "num_qubits": session.num_qubits,
            "gates": [g.model_dump() for g in session.gates],
            "state_info": session.get_state_info().model_dump(),
            "ascii_diagram": session.get_ascii_diagram(),
            "collapsed_qubits": session.collapsed_qubits,
        }

    def reset(self, session_id: str, initial_gates: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        if session_id not in self.sessions:
            return self.initialize(session_id, 1, initial_gates)
        
        parsed_gates = []
        if initial_gates:
            for g in initial_gates:
                parsed_gates.append(GateEntry(**g))
        
        session = self.sessions[session_id]
        session.reset(parsed_gates)
        return {
            "session_id": session_id,
            "num_qubits": session.num_qubits,
            "gates": [g.model_dump() for g in session.gates],
            "state_info": session.get_state_info().model_dump(),
            "ascii_diagram": session.get_ascii_diagram(),
        }

    def validate_exit(
        self,
        session_id: str,
        condition_type: str,
        target_qubit: int,
        required_prob: float = 0.8,
        required_state: int = 1,
    ) -> Dict[str, Any]:
        """
        Authoritatively validates if exit condition is satisfied by real Qiskit statevector.
        """
        if session_id not in self.sessions:
            return {
                "satisfied": False,
                "reason": "Quantum session not initialized.",
                "current_probability": 0.0,
            }

        session = self.sessions[session_id]
        state_info = session.get_state_info()

        if target_qubit < 0 or target_qubit >= session.num_qubits:
            return {
                "satisfied": False,
                "reason": f"Target qubit q{target_qubit} out of range.",
                "current_probability": 0.0,
            }

        q_prob = state_info.qubit_probabilities[target_qubit]
        current_prob = q_prob.p1 if required_state == 1 else q_prob.p0

        if condition_type == "probability_threshold":
            satisfied = current_prob >= (required_prob - 1e-4)
            reason = (
                f"Exit unlocked! Probability {current_prob*100:.1f}% satisfies requirement (>= {required_prob*100:.0f}%)."
                if satisfied
                else f"Quantum condition not met: Current probability is {current_prob*100:.1f}% (Required: >= {required_prob*100:.0f}%)."
            )
        elif condition_type == "collapsed_state":
            satisfied = q_prob.collapsed_state == required_state
            reason = (
                f"Exit unlocked! Qubit q{target_qubit} is measured and collapsed to |{required_state}⟩."
                if satisfied
                else f"Exit requires qubit q{target_qubit} to be collapsed into state |{required_state}⟩."
            )
        elif condition_type == "entangled_pair":
            # For entangled condition, verify statevector has high correlation
            # Check Bell state purity / concurrence
            satisfied = q_prob.is_entangled and current_prob >= (required_prob - 1e-4)
            reason = (
                f"Exit unlocked! Target qubit is entangled and satisfied target threshold {current_prob*100:.1f}%."
                if satisfied
                else f"Exit requires entangled correlation with probability >= {required_prob*100:.0f}%."
            )
        else:
            satisfied = current_prob >= (required_prob - 1e-4)
            reason = f"State probability: {current_prob*100:.1f}%"

        return {
            "satisfied": satisfied,
            "reason": reason,
            "target_qubit": target_qubit,
            "required_state": required_state,
            "required_prob": required_prob,
            "current_probability": round(current_prob, 6),
            "state_info": state_info.model_dump(),
        }

    def execute_arbitrary_circuit(self, num_qubits: int, gates: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Executes a custom circuit on-the-fly for the Quantum Lab Sandbox.
        """
        parsed_gates = [GateEntry(**g) for g in gates]
        qc = build_qiskit_circuit(num_qubits, parsed_gates)
        sv = Statevector.from_instruction(qc)
        state_info = compute_state_info(sv)
        ascii_diag = render_ascii_circuit(qc)

        return {
            "num_qubits": num_qubits,
            "gates": [g.model_dump() for g in parsed_gates],
            "state_info": state_info.model_dump(),
            "ascii_diagram": ascii_diag,
        }
