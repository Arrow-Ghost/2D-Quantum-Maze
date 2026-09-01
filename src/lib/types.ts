/**
 * Core Type Definitions for Quantum Maze - Dynamic Maze Architecture
 */

export const GATE_COSTS: Record<string, number> = {
  H: 10,
  X: 5,
  Z: 5,
  CNOT: 20,
  CX: 20,
  Y: 5,
  S: 5,
  T: 5,
  M: 15,
};

export const GATE_DESCRIPTIONS: Record<string, string> = {
  H: 'Hadamard: Creates equal superposition (|0> -> (|0>+|1>)/sqrt(2)).',
  X: 'Pauli-X: Bit-flip NOT gate (|0> -> |1>, |1> -> |0>).',
  Z: 'Pauli-Z: Phase-flip gate (|1> -> -|1>). Essential for interference.',
  CNOT: 'Controlled-NOT: Entangles control and target into Bell states.',
  CX: 'Controlled-NOT: Entangles control and target into Bell states.',
  Y: 'Pauli-Y: Bit and phase flip.',
  S: 'Phase Gate S: Applies pi/2 phase shift.',
  T: 'Phase Gate T: Applies pi/4 phase shift.',
  M: 'Measurement: Collapses superposition into definite classical eigenstate.',
};

export type GameStatus =
  | 'TITLE'
  | 'MENU'
  | 'PLAYING'
  | 'INTERACTING'
  | 'MEASURING'
  | 'PAUSED'
  | 'VICTORY'
  | 'FAILURE';

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface Position {
  r: number; // Row index (0-indexed)
  c: number; // Column index (0-indexed)
}

export interface Player {
  r: number;
  c: number;
  direction: Direction;
  isMoving: boolean;
  targetR: number;
  targetC: number;
  moveProgress: number; // 0 to 1 for smooth interpolation
}

export interface QuantumCheckpoint {
  id: string;
  r: number;
  c: number;
  label: string;
  activated: boolean;
  requiredForTerminal: boolean;
}

export interface QuantumTerminal {
  id: string;
  r: number;
  c: number;
  qubitIndex: number;
  label: string;
  allowedGates: string[];
  unlocked: boolean;
}

export interface QuantumDoor {
  id: string;
  r: number;
  c: number;
  qubitIndex: number;
  requiredState: 0 | 1;
  label: string;
  isEntangled: boolean;
  entangledWith?: string;
}

export interface QuantumObject {
  id: string;
  r: number;
  c: number;
  label: string;
  qubitIndex: number;
}

export interface EnergyCell {
  id: string;
  r: number;
  c: number;
  energyAmount: number;
  collected: boolean;
}

export interface ExitPortal {
  r: number;
  c: number;
  targetQubit: number;
  requiredState: 0 | 1;
  requiredProbability: number; // e.g. 0.70 (70%)
  conditionType: 'probability_threshold' | 'collapsed_state' | 'entangled_pair';
  description: string;
}

export interface BasisState {
  binary: string;
  amplitude_real: number;
  amplitude_imag: number;
  probability: number;
  phase_radians: number;
  phase_degrees: number;
}

export interface QubitProbability {
  qubit: number;
  p0: number;
  p1: number;
  phase_diff: number;
  is_entangled: boolean;
  collapsed_state: number | null;
}

export interface StateInfo {
  num_qubits: number;
  basis_states: BasisState[];
  qubit_probabilities: QubitProbability[];
  dirac_notation: string;
  is_pure: boolean;
  purity: number;
}

export interface ExitValidationResult {
  satisfied: boolean;
  reason: string;
  target_qubit?: number;
  required_state?: number;
  required_prob?: number;
  current_probability: number;
  state_info?: StateInfo;
}

export interface GateEntry {
  id: string;
  gate: string;
  target: number;
  control?: number | null;
  param?: number | null;
  step: number;
}

export interface LevelData {
  id: string;
  levelNumber: number;
  title: string;
  subtitle: string;
  briefing: string;
  quantumConcept: string;
  hint?: string;
  difficulty: 'EASY' | 'NORMAL' | 'EXPERT';
  rows: number; // Fixed grid rows
  cols: number; // Fixed grid columns
  wallCount: number; // Exact invariant count of walls
  levelSeed: number; // Deterministic PRNG seed
  spawnPosition: Position;
  exitPosition: ExitPortal;
  checkpoints: QuantumCheckpoint[];
  terminals: QuantumTerminal[];
  doors: QuantumDoor[];
  quantumObjects: QuantumObject[];
  energyCells: EnergyCell[];
  numQubits: number;
  initialGates: { gate: string; target: number; control?: number }[];
  allowedGates: string[];
  initialEnergy: number;
  moveEnergyCost?: number; // QE drained per step (default 2)
  measurementBudget: number;
  targetTimeSeconds: number;
  scoreMultiplier: number;
}

export interface ScoreReport {
  baseScore: number;
  timeBonus: number;
  quantumEfficiency: number;
  probabilityBonus: number;
  energyBonus: number;
  measurementBonus: number;
  unnecessaryMeasurementPenalty: number;
  invalidOpPenalty: number;
  totalScore: number;
  stars: number;
  elapsedTime: number;
  movesUsed: number;
  gatesUsed: number;
  measurementsUsed: number;
  finalProbability: number;
  energyRemaining: number;
}

export interface GameSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  reducedMotion: boolean;
  highContrast: boolean;
  showProbabilityPercent: boolean;
  showDiracNotation: boolean;
  difficulty: 'EASY' | 'NORMAL' | 'EXPERT';
  debugMode: boolean;
}

export interface LeaderboardEntry {
  id: string;
  levelId: string;
  levelNumber: number;
  playerName: string;
  totalScore: number;
  elapsedTime: number;
  movesUsed: number;
  gatesUsed: number;
  measurementsUsed: number;
  quantumEfficiency: number;
  finalProbability: number;
  date: string;
}
