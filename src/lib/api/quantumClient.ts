/**
 * Quantum Maze - Backend API Client
 * Strongly-typed HTTP bridge to the FastAPI Qiskit Quantum Engine.
 */
import type {
  GateEntry,
  StateInfo,
  ExitValidationResult,
} from '../types';

export function getInitialApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('quantum_api_base_url');
    if (stored && stored.trim()) {
      return stored.trim();
    }
  }
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PUBLIC_API_BASE_URL) {
    return import.meta.env.PUBLIC_API_BASE_URL.trim();
  }
  return 'http://127.0.0.1:8000';
}

export const API_BASE_URL = getInitialApiBaseUrl();

export interface InitializeResponse {
  session_id: string;
  num_qubits: number;
  gates: GateEntry[];
  state_info: StateInfo;
  ascii_diagram: string;
  move_count?: number;
}

export interface MoveResponse {
  valid_move: boolean;
  player: { r: number; c: number };
  move_count: number;
  walls: { r: number; c: number }[];
  wall_count: number;
  state_info: StateInfo;
  exit_probability: number;
  checkpoint_activated: boolean;
  ascii_diagram: string;
}

export interface GateResponse {
  success: boolean;
  error?: string;
  energy_cost: number;
  gate_entry?: GateEntry;
  state_info?: StateInfo;
  ascii_diagram?: string;
}

export interface MeasureResponse {
  success: boolean;
  error?: string;
  energy_cost: number;
  target_qubit?: number;
  outcome?: number;
  gate_entry?: GateEntry;
  state_info?: StateInfo;
  ascii_diagram?: string;
}

export interface StateResponse {
  session_id: string;
  num_qubits: number;
  gates: GateEntry[];
  state_info: StateInfo;
  ascii_diagram: string;
  collapsed_qubits: Record<number, number>;
}

export class QuantumClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || getInitialApiBaseUrl();
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setBaseUrl(newUrl: string): void {
    this.baseUrl = newUrl.replace(/\/+$/, '');
    if (typeof window !== 'undefined') {
      localStorage.setItem('quantum_api_base_url', this.baseUrl);
    }
  }

  async checkHealth(): Promise<{ status: string; engine: string; qiskit_version: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      if (!res.ok) {
        throw new Error(`Health check failed with status ${res.status}`);
      }
      return await res.json();
    } catch (err: any) {
      throw new Error(`Quantum Engine Offline: Unable to reach backend at ${this.baseUrl}. ${err.message}`);
    }
  }

  async initialize(
    sessionId: string,
    numQubits: number = 1,
    initialGates: { gate: string; target: number; control?: number }[] = [],
    levelSeed: number = 42
  ): Promise<InitializeResponse> {
    const res = await fetch(`${this.baseUrl}/quantum/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        num_qubits: numQubits,
        initial_gates: initialGates,
        level_seed: levelSeed,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(err.detail || `Initialize failed with HTTP ${res.status}`);
    }
    return await res.json();
  }

  async postMove(
    sessionId: string,
    direction: string,
    playerPos: [number, number],
    rows: number,
    cols: number,
    wallCount: number,
    levelSeed: number,
    exitPos: [number, number],
    checkpoints: [number, number][] = [],
    terminals: [number, number][] = [],
    objects: [number, number][] = [],
    activeTargetCheckpoint?: [number, number]
  ): Promise<MoveResponse> {
    const res = await fetch(`${this.baseUrl}/game/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        direction,
        player_pos: playerPos,
        rows,
        cols,
        wall_count: wallCount,
        level_seed: levelSeed,
        exit_pos: exitPos,
        checkpoints,
        terminals,
        objects,
        active_target_checkpoint: activeTargetCheckpoint ?? null,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(err.detail || `Move processing failed with HTTP ${res.status}`);
    }
    return await res.json();
  }

  async applyGate(
    sessionId: string,
    gate: string,
    target: number,
    control?: number | null,
    energyAvailable: number = 100
  ): Promise<GateResponse> {
    const res = await fetch(`${this.baseUrl}/quantum/apply-gate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        gate,
        target,
        control: control ?? null,
        energy_available: energyAvailable,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(err.detail || `Apply gate failed with HTTP ${res.status}`);
    }
    return await res.json();
  }

  async measure(
    sessionId: string,
    target: number,
    energyAvailable: number = 100
  ): Promise<MeasureResponse> {
    const res = await fetch(`${this.baseUrl}/quantum/measure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        target,
        energy_available: energyAvailable,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(err.detail || `Measure failed with HTTP ${res.status}`);
    }
    return await res.json();
  }

  async getState(sessionId: string): Promise<StateResponse> {
    const res = await fetch(`${this.baseUrl}/quantum/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(err.detail || `Get state failed with HTTP ${res.status}`);
    }
    return await res.json();
  }

  async reset(
    sessionId: string,
    initialGates: { gate: string; target: number; control?: number }[] = []
  ): Promise<InitializeResponse> {
    const res = await fetch(`${this.baseUrl}/quantum/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        initial_gates: initialGates,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(err.detail || `Reset failed with HTTP ${res.status}`);
    }
    return await res.json();
  }

  async validateExit(
    sessionId: string,
    conditionType: string,
    targetQubit: number,
    requiredProb: number = 0.8,
    requiredState: number = 1
  ): Promise<ExitValidationResult> {
    const res = await fetch(`${this.baseUrl}/quantum/validate-exit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        condition_type: conditionType,
        target_qubit: targetQubit,
        required_prob: requiredProb,
        required_state: requiredState,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(err.detail || `Validate exit failed with HTTP ${res.status}`);
    }
    return await res.json();
  }

  async executeArbitraryCircuit(
    numQubits: number,
    gates: { gate: string; target: number; control?: number }[]
  ): Promise<{
    num_qubits: number;
    gates: GateEntry[];
    state_info: StateInfo;
    ascii_diagram: string;
  }> {
    const res = await fetch(`${this.baseUrl}/quantum/execute-circuit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        num_qubits: numQubits,
        gates,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(err.detail || `Circuit execution failed with HTTP ${res.status}`);
    }
    return await res.json();
  }
}

export const quantumClient = new QuantumClient();
