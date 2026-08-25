/**
 * Quantum Maze - Core Game Engine (Dynamic Maze Architecture)
 * Coordinates player movement, dynamic wall generation, Qiskit state evolution,
 * checkpoint activations, quantum terminal operators, and exit validations.
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
import { generateDynamicWalls } from './mazeGenerator';
import { quantumClient } from '../api/quantumClient';
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
  public status: GameStatus = 'TITLE';
  public currentLevel: LevelData;
  public player: Player;
  public walls: Position[] = [];
  public checkpoints: QuantumCheckpoint[] = [];
  public terminals: QuantumTerminal[] = [];
  public doors: QuantumDoor[] = [];
  public quantumObjects: QuantumObject[] = [];
  public energyCells: EnergyCell[] = [];

  public movesUsed: number = 0;
  public energy: number = 100;
  public measurementsUsed: number = 0;
  public gatesUsed: number = 0;
  public invalidOperations: number = 0;
  public unnecessaryMeasurements: number = 0;
  public restartsCount: number = 0;
  public elapsedTime: number = 0;

  public exitProbability: number = 0.5;
  public exitUnlocked: boolean = false;
  public exitValidationReason: string = '';
  public activeInteractiveTerminal: QuantumTerminal | null = null;

  // Quantum State synced with Qiskit
  public stateInfo: StateInfo | null = null;
  public circuitGates: GateEntry[] = [];
  public asciiDiagram: string = '';
  public activeSessionId: string = '';

  private listeners: GameEngineListeners = {};
  private timerInterval: number | null = null;
  private isProcessingQuantumOp: boolean = false;

  constructor(listeners: GameEngineListeners = {}) {
    this.listeners = listeners;
    this.currentLevel = LEVELS[0];
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
    this.currentLevel = JSON.parse(JSON.stringify(level)); // Deep clone
    this.checkpoints = [...this.currentLevel.checkpoints];
    this.terminals = [...this.currentLevel.terminals];
    this.doors = [...this.currentLevel.doors];
    this.quantumObjects = [...this.currentLevel.quantumObjects];
    this.energyCells = [...this.currentLevel.energyCells];

    this.movesUsed = 0;
    this.energy = this.currentLevel.initialEnergy;
    this.measurementsUsed = 0;
    this.gatesUsed = 0;
    this.invalidOperations = 0;
    this.unnecessaryMeasurements = 0;
    this.elapsedTime = 0;
    this.exitProbability = 0.5;
    this.exitUnlocked = false;
    this.exitValidationReason = '';
    this.activeInteractiveTerminal = null;

    this.player = {
      r: this.currentLevel.spawnPosition.r,
      c: this.currentLevel.spawnPosition.c,
      direction: 'RIGHT',
      isMoving: false,
      targetR: this.currentLevel.spawnPosition.r,
      targetC: this.currentLevel.spawnPosition.c,
      moveProgress: 0,
    };

    // Initial deterministic wall layout
    const activeCp = this.checkpoints.find((cp) => !cp.activated);
    this.walls = generateDynamicWalls(
      this.currentLevel.rows,
      this.currentLevel.cols,
      this.currentLevel.wallCount,
      this.currentLevel.levelSeed,
      0,
      { r: this.player.r, c: this.player.c },
      { r: this.currentLevel.exitPosition.r, c: this.currentLevel.exitPosition.c },
      this.checkpoints.map((cp) => ({ r: cp.r, c: cp.c })),
      this.terminals.map((t) => ({ r: t.r, c: t.c })),
      this.quantumObjects.map((o) => ({ r: o.r, c: o.c })),
      activeCp ? { r: activeCp.r, c: activeCp.c } : null
    );

    this.activeSessionId = `session_${this.currentLevel.id}_${Date.now()}`;
    this.status = 'PLAYING';

    this.startTimer();
    this.listeners.onWallTransition?.(this.walls);

    // Initialize backend Qiskit circuit
    try {
      this.listeners.onMessage?.('Synchronizing with Qiskit Quantum Engine...', 'info');
      const res = await quantumClient.initialize(
        this.activeSessionId,
        this.currentLevel.numQubits,
        this.currentLevel.initialGates,
        this.currentLevel.levelSeed
      );
      this.stateInfo = res.state_info;
      this.circuitGates = res.gates;
      this.asciiDiagram = res.ascii_diagram;
      this.exitProbability = res.state_info.qubit_probabilities[0]?.p1 ?? 0.5;
      await this.checkExitCondition();
      this.listeners.onMessage?.('Quantum statevector synchronized.', 'success');
    } catch (err: any) {
      console.warn('Backend offline, running in deterministic simulation mode:', err.message);
    }

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
        this.elapsedTime += 0.1;
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

  public movePlayer(dir: Direction) {
    if (this.status !== 'PLAYING' || this.player.isMoving) return;

    this.player.direction = dir;

    let targetR = this.player.r;
    let targetC = this.player.c;

    if (dir === 'UP') targetR -= 1;
    else if (dir === 'DOWN') targetR += 1;
    else if (dir === 'LEFT') targetC -= 1;
    else if (dir === 'RIGHT') targetC += 1;

    // 1. Validate grid bounds
    if (
      targetR < 0 ||
      targetR >= this.currentLevel.rows ||
      targetC < 0 ||
      targetC >= this.currentLevel.cols
    ) {
      audioEngine.playError();
      return;
    }

    // 2. Validate current wall collision
    const isWall = this.walls.some((w) => w.r === targetR && w.c === targetC);
    if (isWall) {
      audioEngine.playError();
      return;
    }

    // 3. Move player
    this.player.targetR = targetR;
    this.player.targetC = targetC;
    this.player.isMoving = true;
    this.player.moveProgress = 0;
    this.movesUsed++;
    audioEngine.playMove();

    // 4. Trigger Dynamic Wall Randomization (Exact Invariant Count)
    const activeCp = this.checkpoints.find((cp) => !cp.activated);
    const newWalls = generateDynamicWalls(
      this.currentLevel.rows,
      this.currentLevel.cols,
      this.currentLevel.wallCount,
      this.currentLevel.levelSeed,
      this.movesUsed,
      { r: targetR, c: targetC },
      { r: this.currentLevel.exitPosition.r, c: this.currentLevel.exitPosition.c },
      this.checkpoints.map((cp) => ({ r: cp.r, c: cp.c })),
      this.terminals.map((t) => ({ r: t.r, c: t.c })),
      this.quantumObjects.map((o) => ({ r: o.r, c: o.c })),
      activeCp ? { r: activeCp.r, c: activeCp.c } : null,
      this.walls
    );

    this.walls = newWalls;
    this.listeners.onWallTransition?.(newWalls);

    // 5. Asynchronously evolve quantum state via Qiskit backend
    quantumClient
      .postMove(
        this.activeSessionId,
        dir,
        [targetR, targetC],
        this.currentLevel.rows,
        this.currentLevel.cols,
        this.currentLevel.wallCount,
        this.currentLevel.levelSeed,
        [this.currentLevel.exitPosition.r, this.currentLevel.exitPosition.c],
        this.checkpoints.map((cp) => [cp.r, cp.c]),
        this.terminals.map((t) => [t.r, t.c]),
        this.quantumObjects.map((o) => [o.r, o.c]),
        activeCp ? [activeCp.r, activeCp.c] : undefined
      )
      .then((res) => {
        if (res.state_info) this.stateInfo = res.state_info;
        if (res.exit_probability !== undefined) this.exitProbability = res.exit_probability;
        if (res.ascii_diagram) this.asciiDiagram = res.ascii_diagram;
        this.checkExitCondition();
      })
      .catch((err) => {
        // Fallback mathematical phase evolution if offline
        const angleDeg =
          (targetR * 37 + targetC * 23 + this.movesUsed * 41 + this.currentLevel.levelSeed * 13) %
          360;
        this.exitProbability = Math.round((Math.sin((angleDeg * Math.PI) / 180) * 0.4 + 0.5) * 100) / 100;
        this.checkExitCondition();
      });

    // Start movement interpolation
    const moveStep = () => {
      this.player.moveProgress += 0.25;
      if (this.player.moveProgress >= 1) {
        this.player.r = this.player.targetR;
        this.player.c = this.player.targetC;
        this.player.isMoving = false;
        this.player.moveProgress = 0;
        this.onPlayerStepCompleted();
      } else {
        requestAnimationFrame(moveStep);
      }
      this.notifyState();
    };
    requestAnimationFrame(moveStep);
  }

  private onPlayerStepCompleted() {
    // 1. Check Energy Cell collection
    const cell = this.energyCells.find(
      (c) => !c.collected && c.r === this.player.r && c.c === this.player.c
    );
    if (cell) {
      cell.collected = true;
      this.energy = Math.min(250, this.energy + cell.energyAmount);
      audioEngine.playEnergyCollect();
      this.listeners.onMessage?.(`+${cell.energyAmount} Quantum Energy acquired!`, 'success');
    }

    // 2. Check Checkpoint Reached
    const checkpoint = this.checkpoints.find(
      (cp) => !cp.activated && cp.r === this.player.r && cp.c === this.player.c
    );
    if (checkpoint) {
      checkpoint.activated = true;
      audioEngine.playVictory();
      this.listeners.onMessage?.(`✓ ${checkpoint.label} Activated! Quantum Terminals unlocked.`, 'success');

      // Unlock all corresponding quantum terminals
      this.terminals.forEach((term) => {
        term.unlocked = true;
      });
    }

    // 3. Check Proximity to Quantum Terminals
    const nearbyTerminal = this.terminals.find(
      (t) => Math.abs(t.r - this.player.r) + Math.abs(t.c - this.player.c) <= 1
    );
    this.activeInteractiveTerminal = nearbyTerminal || null;
    this.listeners.onInteractPrompt?.(this.activeInteractiveTerminal);

    // 4. Check Exit Reached
    const exit = this.currentLevel.exitPosition;
    if (this.player.r === exit.r && this.player.c === exit.c) {
      if (this.exitUnlocked) {
        this.handleVictory();
      } else {
        audioEngine.playError();
        this.listeners.onMessage?.(
          `Exit portal active but locked. Quantum condition required: Exit Probability >= ${Math.round(exit.requiredProbability * 100)}% (Current: ${Math.round(this.exitProbability * 100)}%).`,
          'warning'
        );
      }
    }
  }

  public async applyGate(gate: string, targetQubit: number, controlQubit?: number | null) {
    if (this.isProcessingQuantumOp) return;
    this.isProcessingQuantumOp = true;

    try {
      const res = await quantumClient.applyGate(
        this.activeSessionId,
        gate,
        targetQubit,
        controlQubit ?? null,
        this.energy
      );

      if (!res.success) {
        this.invalidOperations++;
        audioEngine.playError();
        this.listeners.onMessage?.(res.error || 'Gate operation rejected.', 'error');
        this.isProcessingQuantumOp = false;
        return;
      }

      this.energy = Math.max(0, this.energy - res.energy_cost);
      this.gatesUsed++;
      if (res.state_info) {
        this.stateInfo = res.state_info;
        this.exitProbability = res.state_info.qubit_probabilities[0]?.p1 ?? this.exitProbability;
      }
      if (res.gate_entry) this.circuitGates.push(res.gate_entry);
      if (res.ascii_diagram) this.asciiDiagram = res.ascii_diagram;

      const g = gate.toUpperCase();
      if (g === 'H') audioEngine.playGateH();
      else if (g === 'X') audioEngine.playGateX();
      else if (g === 'Z') audioEngine.playGateZ();
      else if (g === 'CNOT' || g === 'CX') audioEngine.playGateCNOT();
      else audioEngine.playDoorOpen();

      this.listeners.onMessage?.(
        `Applied gate ${gate} on q${targetQubit}. Statevector updated.`,
        'success'
      );

      await this.checkExitCondition();
    } catch (err: any) {
      this.invalidOperations++;
      audioEngine.playError();
      this.listeners.onMessage?.(err.message, 'error');
    } finally {
      this.isProcessingQuantumOp = false;
      this.notifyState();
    }
  }

  public async performMeasurement(targetQubit: number) {
    if (this.isProcessingQuantumOp) return;
    if (this.measurementsUsed >= this.currentLevel.measurementBudget) {
      audioEngine.playError();
      this.listeners.onMessage?.(
        `Measurement budget depleted (${this.measurementsUsed}/${this.currentLevel.measurementBudget}).`,
        'warning'
      );
      return;
    }

    this.isProcessingQuantumOp = true;

    try {
      const res = await quantumClient.measure(this.activeSessionId, targetQubit, this.energy);
      if (!res.success) {
        audioEngine.playError();
        this.listeners.onMessage?.(res.error || 'Measurement failed.', 'error');
        this.isProcessingQuantumOp = false;
        return;
      }

      this.energy = Math.max(0, this.energy - res.energy_cost);
      this.measurementsUsed++;
      if (res.state_info) {
        this.stateInfo = res.state_info;
        this.exitProbability = res.state_info.qubit_probabilities[0]?.p1 ?? (res.outcome === 1 ? 1.0 : 0.0);
      }
      if (res.gate_entry) this.circuitGates.push(res.gate_entry);
      if (res.ascii_diagram) this.asciiDiagram = res.ascii_diagram;

      audioEngine.playMeasurement();
      this.listeners.onMessage?.(
        `Wavefunction collapsed! Qubit q${targetQubit} measured into state |${res.outcome}⟩.`,
        'info'
      );

      await this.checkExitCondition();
    } catch (err: any) {
      audioEngine.playError();
      this.listeners.onMessage?.(err.message, 'error');
    } finally {
      this.isProcessingQuantumOp = false;
      this.notifyState();
    }
  }

  public async checkExitCondition() {
    const exit = this.currentLevel.exitPosition;
    const allCheckpointsActive = this.checkpoints.every((cp) => cp.activated);

    try {
      const res = await quantumClient.validateExit(
        this.activeSessionId,
        exit.conditionType,
        exit.targetQubit,
        exit.requiredProbability,
        exit.requiredState
      );

      this.exitUnlocked = res.satisfied && allCheckpointsActive;
      this.exitValidationReason = res.reason;

      if (!allCheckpointsActive) {
        this.exitUnlocked = false;
        this.exitValidationReason = 'Activate all Quantum Checkpoints first.';
      }
    } catch (err) {
      this.exitUnlocked = this.exitProbability >= exit.requiredProbability && allCheckpointsActive;
    }
    this.notifyState();
  }

  private handleVictory() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.status = 'VICTORY';
    audioEngine.playVictory();

    const scoreReport = ScoreEngine.calculate({
      level: this.currentLevel,
      elapsedTime: this.elapsedTime,
      gatesUsed: this.gatesUsed,
      measurementsUsed: this.measurementsUsed,
      finalProbability: this.exitProbability,
      energyRemaining: this.energy,
      unnecessaryMeasurements: this.unnecessaryMeasurements,
      invalidOperations: this.invalidOperations,
      restartsCount: this.restartsCount,
    });

    // Append movesUsed
    (scoreReport as any).movesUsed = this.movesUsed;

    // Record level completion
    const nextLevelIndex = this.currentLevel.levelNumber;
    const nextLevelId = nextLevelIndex < LEVELS.length ? LEVELS[nextLevelIndex].id : null;
    StorageManager.recordLevelCompletion(this.currentLevel.id, nextLevelId, scoreReport);

    // Save to leaderboard
    StorageManager.addLeaderboardEntry({
      levelId: this.currentLevel.id,
      levelNumber: this.currentLevel.levelNumber,
      playerName: StorageManager.getPlayerName(),
      totalScore: scoreReport.totalScore,
      elapsedTime: scoreReport.elapsedTime,
      movesUsed: this.movesUsed,
      gatesUsed: scoreReport.gatesUsed,
      measurementsUsed: scoreReport.measurementsUsed,
      quantumEfficiency: scoreReport.quantumEfficiency,
      finalProbability: scoreReport.finalProbability,
    });

    this.listeners.onVictory?.(scoreReport);
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
