# QUANTUM MAZE

> **"REALITY IS A STATE"**

An interactive 2D laboratory puzzle game demonstrating quantum-information concepts through real **Qiskit quantum circuits**.

---

## 1. Scientific & Philosophical Overview

**QUANTUM MAZE** is an educational and experimental puzzle game designed to demonstrate authentic quantum-computing concepts through interactive game mechanics.

> [!IMPORTANT]
> **Scientific Transparency**: The game is an interactive software demonstration of quantum-information concepts through a quantum-controlled maze. It does not claim to physically simulate macroscopic quantum mechanics in matter. All quantum gates, statevectors, complex probability amplitudes, and wavefunction collapse projections are computed in real time using **Qiskit** and **Qiskit Aer** in Python.

---

## 2. Core Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 ASTRO CLIENT (Frontend)                     │
│  - TypeScript & Modern Component Architecture               │
│  - 2D HTML5 Canvas Laboratory Renderer                      │
│  - Web Audio API Procedural Synthesizer                     │
│  - Live Dirac Statevector Inspector & ASCII Circuit Display │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP JSON API
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 FASTAPI BACKEND (Python 3.13)               │
│  - REST Endpoints (/quantum/apply-gate, /measure, /state...)│
│  - Authoritative Validation & Energy Enforcement            │
│  - Session Circuit Management                               │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 QISKIT QUANTUM ENGINE                       │
│  - Qiskit QuantumCircuit Execution                          │
│  - Statevector Simulation & Amplitude Extraction            │
│  - Born-Rule Physical Measurement via Aer Simulator         │
│  - Reduced Single-Qubit Density Matrices & Entanglement     │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Quantum Mechanics & Gameplay Concepts

### 3.1 Qubits and Superposition ($H$ Gate)
- Every quantum door and barrier is governed by a qubit ($q_0, q_1, \dots$).
- State $|0\rangle$ corresponds to a closed barrier; state $|1\rangle$ corresponds to an open doorway.
- Applying the **Hadamard ($H$)** gate creates equal superposition:
  $$H|0\rangle = \frac{|0\rangle + |1\rangle}{\sqrt{2}}$$
- The door visually transitions into an oscillating quantum probability field with a $50\%$ chance of passage.

### 3.2 Pauli-X Bit Flip ($X$ Gate)
- The quantum analogue of a classical NOT gate:
  $$X|0\rangle = |1\rangle, \quad X|1\rangle = |0\rangle$$
- Inverts emergency containment blast doors from $|0\rangle$ (locked) directly to $|1\rangle$ (100% open).

### 3.3 Relative Phase & Pauli-Z ($Z$ Gate)
- Flips the relative phase of $|1\rangle$ without altering standard measurement probabilities:
  $$Z|0\rangle = |0\rangle, \quad Z|1\rangle = -|1\rangle$$
- Relative phase ($\pi$ shift) is crucial for Mach-Zehnder style constructive and destructive amplitude interference:
  $$H \cdot Z \cdot H |0\rangle = |1\rangle$$

### 3.4 Entanglement & Controlled-NOT ($CNOT$)
- Entangles paired security bulkheads into Bell states:
  $$|\Phi^+\rangle = \frac{|00\rangle + |11\rangle}{\sqrt{2}}$$
- Entangled doors $A \leftrightarrow B$ share correlated quantum states across isolated sectors.

### 3.5 Wavefunction Collapse & Measurement ($M$)
- Measurement is a non-reversible physical projection (Born rule).
- Collapses a continuous superposition into a single physical eigenstate ($|0\rangle$ or $|1\rangle$).
- Collapsed states remain classical eigenstates until a subsequent unitary transformation is applied.

---

## 4. Controls

| Key | Action |
| --- | --- |
| `W` / `↑` | Move Up |
| `S` / `↓` | Move Down |
| `A` / `←` | Move Left |
| `D` / `→` | Move Right |
| `E` / `Q` / `Space` | Open Quantum Terminal Console |
| `ESC` | Pause Simulation Menu |
| `` ` `` / `~` | Toggle Developer Debug Overlay |

---

## 5. Scoring & Efficiency System

Score calculation is centralized in `src/lib/scoring/scoreEngine.ts`:

- **Base Escape Score**: $+1000$ pts
- **Time Bonus**: Up to $+500$ pts (rewarding fast problem solving)
- **Quantum Gate Efficiency**: Up to $+500$ pts (ratio of minimal gate sequence to actual gates)
- **Exit Probability Bonus**: Up to $+300$ pts (higher quantum state fidelity)
- **Energy Conservation Bonus**: Up to $+300$ pts
- **Measurement Budget Bonus**: Up to $+300$ pts
- **Penalties**:
  - Unnecessary Measurement: $-100$ pts
  - Invalid Gate Attempt: $-25$ pts
  - Level Restarts: $0.9\times$ multiplier per restart

---

## 6. Installation & Running Locally

### Prerequisites
- Python 3.11+ (Python 3.13 recommended)
- Node.js 18+ (Node.js 22+ recommended)

### Step 1: Start Python FastAPI Backend

```bash
# From repository root:
# Setup virtual environment
python -m venv .venv

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Run backend server
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Backend will be active at: `http://127.0.0.1:8000` (Swagger docs at `/docs`).

### Step 2: Start Astro Frontend

```bash
# In a new terminal from repository root:
npm install
npm run dev
```

Frontend will be available at: `http://localhost:4321`.

### Step 3: Run Backend Quantum Tests

```bash
# Run Qiskit automated unit tests
cd backend
python -m pytest tests/test_quantum.py -v
```

---

## 7. Backend API Specification

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Server status & Qiskit version telemetry |
| `GET` | `/quantum/gates-info` | Gate catalog and energy costs |
| `POST` | `/quantum/initialize` | Initialize level circuit with starting qubits |
| `POST` | `/quantum/apply-gate` | Apply $H, X, Z, CNOT, Y, S, T$ to circuit |
| `POST` | `/quantum/measure` | Perform Born-rule measurement & collapse |
| `POST` | `/quantum/state` | Get current statevector, Dirac notation, and basis probs |
| `POST` | `/quantum/entangle` | Apply CNOT between control and target qubits |
| `POST` | `/quantum/reset` | Reset circuit to initial level state |
| `POST` | `/quantum/validate-exit` | Authoritatively validate exit criteria |
| `POST` | `/quantum/execute-circuit` | Execute arbitrary sandbox circuit for Quantum Lab |
