/**
 * Quantum Maze - core game engine.
 *
 * Fully client-side: the maze, the quantum state and the win check all run in the
 * browser (see quantumSim.ts and mazeGenerator.ts). No backend required.
 *
 * Puzzle model:
 *   1. Walk to the Quantum Checkpoint to unlock the terminal.
 *   2. Open the terminal and apply gates / a measurement to drive the target
 *      qubit into the state the exit needs.
 *   3. When the exit reads OPEN, step onto it.
 * Movement no longer perturbs the quantum state, so the puzzle is deterministic.
 */
import type {
  GameStatus,
  Player,
  LevelData,
  Direction,
  Position,
  QuantumCheckpoint,
  QuantumTerminal,
  QuantumDoor,
  QuantumObject,
  EnergyCell,
  StateInfo,
  GateEntry,
  ScoreReport,
} from '../types';
import { GATE_COSTS } from '../types';
import { generateDynamicWalls } from './mazeGenerator';
import { QuantumSim } from './quantumSim';
import { audioEngine } from '../audio/audioEngine';
import { ScoreEngine } from '../scoring/scoreEngine';
import { StorageManager } from '../storage/storage';
import { LEVELS } from '../../data/levels';

export interface GameEngineListeners {
  onStateUpdate?: (engine: GameEngine) => void;
  onWallTransition?: (newWalls: Position[]) => void;
  onVictory?: (report: ScoreReport) => void;
  onFailure?: (reason: string) => void;
  onInteractPrompt?: (terminal: QuantumTerminal | null) => void;
  onMessage?: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export class GameEngine {
  // Amplitude of the per-move "sensor noise" on the displayed exit probability.
  private static readonly EXIT_JITTER = 0.06;

  public status: GameStatus = 'TITLE';
  public currentLevel: LevelData;
  public player: Player;
  public walls: Position[] = [];
  public checkpoints: QuantumCheckpoint[] = [];
  public terminals: QuantumTerminal[] = [];
  public doors: QuantumDoor[] = [];
  public quantumObjects: QuantumObject[] = [];
  public energyCells: EnergyCell[] = [];

  public movesUsed = 0;
  public energy = 100;
  public measurementsUsed = 0;
  public gatesUsed = 0;
  public invalidOperations = 0;
  public unnecessaryMeasurements = 0;
  public restartsCount = 0;
  public elapsedTime = 0;

  public exitProbability = 0.5; // jittered "live readout" shown to the player
  public exitProbabilityTrue = 0.5; // exact value from the statevector
  public exitUnlocked = false;
  public exitValidationReason = '';
  public activeInteractiveTerminal: QuantumTerminal | null = null;

  public stateInfo: StateInfo | null = null;
  public circuitGates: GateEntry[] = [];
  public asciiDiagram = '';
  public activeSessionId = '';

  private sim: QuantumSim;
  private listeners: GameEngineListeners = {};
  private timerInterval: number | null = null;
  private busy = false;

  constructor(listeners: GameEngineListeners = {}) {
    this.listeners = listeners;
    this.currentLevel = LEVELS[0];
    this.sim = new QuantumSim(1, 1);
    this.player = {
      r: 1,
      c: 1,
      direction: 'RIGHT',
      isMoving: false,
      targetR: 1,
      targetC: 1,
      moveProgress: 0,
    };
  }

  public setListeners(listeners: GameEngineListeners) {
    this.listeners = { ...this.listeners, ...listeners };
  }

  public async startLevel(levelId: string) {
    const level = LEVELS.find((l) => l.id === levelId) || LEVELS[0];
    this.currentLevel = JSON.parse(JSON.stringify(level)) as LevelData;
    this.checkpoints = this.currentLevel.checkpoints.map((c) => ({ ...c }));
    this.terminals = this.currentLevel.terminals.map((t) => ({ ...t }));
    this.doors = this.currentLevel.doors.map((d) => ({ ...d }));
    this.quantumObjects = this.currentLevel.quantumObjects.map((o) => ({ ...o }));
    this.energyCells = this.currentLevel.energyCells.map((e) => ({ ...e }));

    this.movesUsed = 0;
    this.energy = this.currentLevel.initialEnergy;
    this.measurementsUsed = 0;
    this.gatesUsed = 0;
    this.invalidOperations = 0;
    this.unnecessaryMeasurements = 0;
    this.elapsedTime = 0;
    this.exitProbability = 0.5;
    this.exitProbabilityTrue = 0.5;
    this.exitUnlocked = false;
    this.exitValidationReason = '';
    this.activeInteractiveTerminal = null;
    this.busy = false;

    this.player = {
      r: this.currentLevel.spawnPosition.r,
      c: this.currentLevel.spawnPosition.c,
      direction: 'RIGHT',
      isMoving: false,
      targetR: this.currentLevel.spawnPosition.r,
      targetC: this.currentLevel.spawnPosition.c,
      moveProgress: 0,
    };

    this.regenerateWalls(0, { r: this.player.r, c: this.player.c });

    this.activeSessionId = `${this.currentLevel.id}-${this.currentLevel.levelSeed}`;

    // Fresh quantum circuit for the level.
    this.sim = new QuantumSim(this.currentLevel.numQubits, this.currentLevel.levelSeed);
    this.sim.applyInitial(this.currentLevel.initialGates);
    this.circuitGates = this.currentLevel.initialGates.map((g, i) => ({
      id: `init${i}`,
      gate: g.gate.toUpperCase(),
      target: g.target,
      control: g.control ?? null,
      param: null,
      step: i + 1,
    }));
    this.syncQuantumState();
    this.checkExitCondition();

    this.status = 'PLAYING';
    this.startTimer();
    this.listeners.onWallTransition?.(this.walls);
    this.notifyState();
  }

  public restartLevel() {
    this.restartsCount++;
    this.startLevel(this.currentLevel.id);
  }

  private startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = window.setInterval(() => {
      if (this.status === 'PLAYING') {
        this.elapsedTime = Math.round((this.elapsedTime + 0.1) * 10) / 10;
        this.notifyState();
      }
    }, 100);
  }

  public pauseGame() {
    if (this.status === 'PLAYING') {
      this.status = 'PAUSED';
      this.notifyState();
    }
  }

  public resumeGame() {
    if (this.status === 'PAUSED') {
      this.status = 'PLAYING';
      this.notifyState();
    }
  }

  private regenerateWalls(moveCount: number, at: Position) {
    const activeCp = this.checkpoints.find((cp) => !cp.activated) || null;
    this.walls = generateDynamicWalls(
      this.currentLevel.rows,
      this.currentLevel.cols,
      this.currentLevel.wallCount,
      this.currentLevel.levelSeed,
      moveCount,
      at,
      { r: this.currentLevel.exitPosition.r, c: this.currentLevel.exitPosition.c },
      this.checkpoints.map((cp) => ({ r: cp.r, c: cp.c })),
      this.terminals.map((t) => ({ r: t.r, c: t.c })),
      [
        ...this.quantumObjects.map((o) => ({ r: o.r, c: o.c })),
        ...this.energyCells.map((e) => ({ r: e.r, c: e.c })),
      ],
      activeCp ? { r: activeCp.r, c: activeCp.c } : null
    );
  }

  public movePlayer(dir: Direction) {
    if (this.status !== 'PLAYING' || this.player.isMoving) return;
    this.player.direction = dir;

    let tr = this.player.r;
    let tc = this.player.c;
    if (dir === 'UP') tr -= 1;
    else if (dir === 'DOWN') tr += 1;
    else if (dir === 'LEFT') tc -= 1;
    else if (dir === 'RIGHT') tc += 1;

    if (tr < 0 || tr >= this.currentLevel.rows || tc < 0 || tc >= this.currentLevel.cols) {
      audioEngine.playError();
      return;
    }
    if (this.walls.some((w) => w.r === tr && w.c === tc)) {
      audioEngine.playError();
      return;
    }

    this.player.targetR = tr;
    this.player.targetC = tc;
    this.player.isMoving = true;
    this.player.moveProgress = 0;
    this.movesUsed++;
    audioEngine.playMove();

    // Every step drains quantum energy...
    const moveCost = this.currentLevel.moveEnergyCost ?? 2;
    this.energy = Math.max(0, this.energy - moveCost);
    if (this.energy === 0) {
      this.listeners.onMessage?.('Quantum energy depleted - collect cells or restart.', 'warning');
    }

    // ...rewrites the maze topology...
    this.regenerateWalls(this.movesUsed, { r: tr, c: tc });
    this.listeners.onWallTransition?.(this.walls);

    // ...and re-reads the (fluctuating) exit probability.
    this.refreshExitDisplay();
    this.checkExitCondition();

    // Drive the step tween on a timer, not requestAnimationFrame: this keeps the
    // move completing (and the input lock releasing) even if the tab is hidden.
    const stepAnim = () => {
      this.player.moveProgress += 0.34;
      if (this.player.moveProgress >= 1) {
        this.player.r = this.player.targetR;
        this.player.c = this.player.targetC;
        this.player.isMoving = false;
        this.player.moveProgress = 0;
        this.onStepCompleted();
      } else {
        setTimeout(stepAnim, 16);
      }
      this.notifyState();
    };
    setTimeout(stepAnim, 16);
  }

  private onStepCompleted() {
    const { r, c } = this.player;

    const cell = this.energyCells.find((e) => !e.collected && e.r === r && e.c === c);
    if (cell) {
      cell.collected = true;
      this.energy = Math.min(this.currentLevel.initialEnergy + 120, this.energy + cell.energyAmount);
      audioEngine.playEnergyCollect();
      this.listeners.onMessage?.(`+${cell.energyAmount} energy`, 'success');
    }

    const cp = this.checkpoints.find((k) => !k.activated && k.r === r && k.c === c);
    if (cp) {
      cp.activated = true;
      audioEngine.playVictory();
      this.terminals.forEach((t) => (t.unlocked = true));
      const remaining = this.checkpoints.filter((k) => !k.activated).length;
      this.listeners.onMessage?.(
        remaining > 0
          ? `${cp.label} secured - ${remaining} checkpoint(s) left.`
          : `${cp.label} secured - terminal online. Press [E].`,
        'success'
      );
      this.regenerateWalls(this.movesUsed, { r, c });
      this.listeners.onWallTransition?.(this.walls);
      this.checkExitCondition();
    }

    const near = this.terminals.find(
      (t) => t.unlocked && Math.abs(t.r - r) + Math.abs(t.c - c) <= 1
    );
    this.activeInteractiveTerminal = near || null;
    this.listeners.onInteractPrompt?.(this.activeInteractiveTerminal);

    const exit = this.currentLevel.exitPosition;
    if (r === exit.r && c === exit.c) {
      if (this.exitUnlocked) this.handleVictory();
      else {
        audioEngine.playError();
        this.listeners.onMessage?.(
          this.exitValidationReason || 'Exit is locked - solve the quantum objective first.',
          'warning'
        );
      }
    }

    this.notifyState();
  }

  private gateCost(gate: string): number {
    return GATE_COSTS[gate.toUpperCase()] ?? 5;
  }

  public async applyGate(gate: string, targetQubit: number, controlQubit?: number | null) {
    if (this.busy || this.status !== 'PLAYING') return;
    if (!this.terminals.some((t) => t.unlocked)) {
      this.listeners.onMessage?.('Reach the checkpoint to unlock the terminal.', 'warning');
      return;
    }
    this.busy = true;
    try {
      const g = gate.toUpperCase();
      const n = this.currentLevel.numQubits;
      const isCnot = g === 'CNOT' || g === 'CX';

      if (targetQubit < 0 || targetQubit >= n) {
        this.fail(`Qubit q${targetQubit} is out of range.`);
        return;
      }
      if (isCnot && (controlQubit == null || controlQubit < 0 || controlQubit >= n || controlQubit === targetQubit)) {
        this.fail('CNOT needs a different, valid control qubit.');
        return;
      }
      const cost = this.gateCost(g);
      if (this.energy < cost) {
        this.fail(`Not enough energy (need ${cost}).`);
        return;
      }

      const entry = this.sim.gate(g, targetQubit, isCnot ? controlQubit ?? null : null);
      this.circuitGates.push(entry);
      this.energy -= cost;
      this.gatesUsed++;

      if (g === 'H') audioEngine.playGateH();
      else if (g === 'X') audioEngine.playGateX();
      else if (g === 'Z') audioEngine.playGateZ();
      else if (isCnot) audioEngine.playGateCNOT();
      else audioEngine.playDoorOpen();

      this.syncQuantumState();
      this.listeners.onMessage?.(`${isCnot ? 'CNOT' : g} applied to q${targetQubit}.`, 'info');
      this.checkExitCondition();
    } catch (err: any) {
      this.fail(err?.message || 'Gate operation failed.');
    } finally {
      this.busy = false;
      this.notifyState();
    }
  }

  public async performMeasurement(targetQubit: number) {
    if (this.busy || this.status !== 'PLAYING') return;
    if (!this.terminals.some((t) => t.unlocked)) {
      this.listeners.onMessage?.('Reach the checkpoint to unlock the terminal.', 'warning');
      return;
    }
    if (this.measurementsUsed >= this.currentLevel.measurementBudget) {
      audioEngine.playError();
      this.listeners.onMessage?.('Measurement budget spent.', 'warning');
      return;
    }
    const n = this.currentLevel.numQubits;
    if (targetQubit < 0 || targetQubit >= n) {
      this.fail(`Qubit q${targetQubit} is out of range.`);
      return;
    }
    const cost = GATE_COSTS.M;
    if (this.energy < cost) {
      this.fail(`Not enough energy to measure (need ${cost}).`);
      return;
    }

    this.busy = true;
    try {
      const { outcome, entry } = this.sim.measure(targetQubit);
      this.circuitGates.push(entry);
      this.energy -= cost;
      this.measurementsUsed++;
      audioEngine.playMeasurement();
      this.syncQuantumState();
      this.listeners.onMessage?.(`q${targetQubit} collapsed to |${outcome}⟩.`, 'info');
      this.checkExitCondition();
    } catch (err: any) {
      this.fail(err?.message || 'Measurement failed.');
    } finally {
      this.busy = false;
      this.notifyState();
    }
  }

  private fail(msg: string) {
    this.invalidOperations++;
    audioEngine.playError();
    this.listeners.onMessage?.(msg, 'error');
  }

  private syncQuantumState() {
    this.stateInfo = this.sim.stateInfo();
    this.asciiDiagram = this.sim.asciiDiagram(this.circuitGates);
    const exit = this.currentLevel.exitPosition;
    const qp = this.stateInfo.qubit_probabilities[exit.targetQubit];
    if (qp) this.exitProbabilityTrue = exit.requiredState === 1 ? qp.p1 : qp.p0;
    this.refreshExitDisplay();
  }

  /**
   * The number the player sees fluctuates every move like a noisy sensor. The
   * jitter is tapered to zero as the true probability approaches 0 or 1, so a
   * definite state reads rock-steady and a superposition looks unstable.
   */
  private refreshExitDisplay() {
    const p = this.exitProbabilityTrue;
    const qp = this.stateInfo?.qubit_probabilities[this.currentLevel.exitPosition.targetQubit];
    if (qp?.collapsed_state !== null && qp?.collapsed_state !== undefined) {
      this.exitProbability = p; // a measured qubit reads dead steady
      return;
    }
    // Largest near a 50/50 superposition, smallest (but never zero) near a
    // definite |0⟩/|1⟩, so the readout always ticks but a solved state stays put.
    const taper = 0.3 + 0.7 * (4 * p * (1 - p));
    const jitter =
      GameEngine.EXIT_JITTER *
      taper *
      Math.sin(
        this.movesUsed * 1.9 +
          this.currentLevel.levelSeed * 0.013 +
          this.player.r * 2.3 +
          this.player.c * 1.7
      );
    this.exitProbability = Math.max(0, Math.min(1, p + jitter));
  }

  public checkExitCondition() {
    const exit = this.currentLevel.exitPosition;
    const allCp = this.checkpoints.every((cp) => cp.activated);
    const info = this.stateInfo;
    const qp = info?.qubit_probabilities[exit.targetQubit];

    let satisfied = false;
    let reason = '';

    if (qp) {
      // The fluctuating readout is what the exit actually checks against.
      const cur = this.exitProbability;
      const pct = Math.round(cur * 100);
      const need = Math.round(exit.requiredProbability * 100);
      if (exit.conditionType === 'collapsed_state') {
        satisfied = qp.collapsed_state === exit.requiredState;
        reason = satisfied
          ? `q${exit.targetQubit} is measured as |${exit.requiredState}⟩.`
          : `Measure q${exit.targetQubit} until it collapses to |${exit.requiredState}⟩.`;
      } else if (exit.conditionType === 'entangled_pair') {
        satisfied = !!qp.is_entangled && cur >= exit.requiredProbability - 1e-4;
        reason = satisfied
          ? `q${exit.targetQubit} is entangled and aligned (${pct}%).`
          : `Entangle q${exit.targetQubit} with the control (need ${need}% and correlation).`;
      } else {
        satisfied = cur >= exit.requiredProbability - 1e-4;
        reason = satisfied
          ? `Exit probability ${pct}% ≥ ${need}%.`
          : `Drive q${exit.targetQubit} to |${exit.requiredState}⟩: ${pct}% / ${need}%.`;
      }
    }

    const wasUnlocked = this.exitUnlocked;
    // Latches: once the objective is met with every checkpoint active, the exit
    // stays open even if the probability readout later dips.
    this.exitUnlocked = allCp && (satisfied || wasUnlocked);
    this.exitValidationReason = !allCp
      ? 'Activate every checkpoint first.'
      : this.exitUnlocked && !satisfied
        ? 'Exit stabilised - portal locked open.'
        : reason;

    if (this.exitUnlocked && !wasUnlocked) {
      audioEngine.playDoorOpen();
      this.listeners.onMessage?.('Exit portal OPEN - step onto it.', 'success');
    }
  }

  private handleVictory() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.status = 'VICTORY';
    audioEngine.playVictory();

    const report = ScoreEngine.calculate({
      level: this.currentLevel,
      elapsedTime: this.elapsedTime,
      gatesUsed: this.gatesUsed,
      measurementsUsed: this.measurementsUsed,
      finalProbability: this.exitProbabilityTrue,
      energyRemaining: this.energy,
      unnecessaryMeasurements: this.unnecessaryMeasurements,
      invalidOperations: this.invalidOperations,
      restartsCount: this.restartsCount,
    });
    (report as any).movesUsed = this.movesUsed;

    const idx = this.currentLevel.levelNumber; // next level index in LEVELS
    const nextId = idx < LEVELS.length ? LEVELS[idx].id : null;
    StorageManager.recordLevelCompletion(this.currentLevel.id, nextId, report);
    StorageManager.addLeaderboardEntry({
      levelId: this.currentLevel.id,
      levelNumber: this.currentLevel.levelNumber,
      playerName: StorageManager.getPlayerName(),
      totalScore: report.totalScore,
      elapsedTime: report.elapsedTime,
      movesUsed: this.movesUsed,
      gatesUsed: report.gatesUsed,
      measurementsUsed: report.measurementsUsed,
      quantumEfficiency: report.quantumEfficiency,
      finalProbability: report.finalProbability,
    });

    this.listeners.onVictory?.(report);
    this.notifyState();
  }

  public handleFailure(reason: string) {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.status = 'FAILURE';
    audioEngine.playError();
    this.listeners.onFailure?.(reason);
    this.notifyState();
  }

  private notifyState() {
    this.listeners.onStateUpdate?.(this);
  }
}
