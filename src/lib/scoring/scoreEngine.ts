/**
 * Quantum Maze - Authoritative Scoring Engine
 * Calculates score breakdowns, quantum efficiency, time bonuses, and performance metrics.
 */
import type { ScoreReport, LevelData } from '../types';

export interface ScoreCalculationParams {
  level: LevelData;
  elapsedTime: number; // in seconds
  movesUsed: number;
  gatesUsed: number;
  measurementsUsed: number;
  finalProbability: number;
  energyRemaining: number;
  unnecessaryMeasurements: number;
  invalidOperations: number;
  restartsCount: number;
}

export class ScoreEngine {
  public static readonly BASE_SCORE = 1000;
  public static readonly MAX_TIME_BONUS = 500;
  public static readonly MAX_QUANTUM_EFFICIENCY = 500;
  public static readonly MAX_PROBABILITY_BONUS = 300;
  public static readonly MAX_ENERGY_BONUS = 300;
  public static readonly MAX_MEASUREMENT_BONUS = 300;

  public static readonly UNNECESSARY_MEASUREMENT_PENALTY = 100;
  public static readonly INVALID_OP_PENALTY = 25;

  public static calculate(params: ScoreCalculationParams): ScoreReport {
    const {
      level,
      elapsedTime,
      movesUsed,
      gatesUsed,
      measurementsUsed,
      finalProbability,
      energyRemaining,
      unnecessaryMeasurements,
      invalidOperations,
      restartsCount,
    } = params;

    // 1. Time Bonus (Linear degradation past target time)
    const targetTime = level.targetTimeSeconds || 60;
    const timeRatio = Math.max(0, 1 - elapsedTime / (targetTime * 1.8));
    const timeBonus = Math.round(this.MAX_TIME_BONUS * timeRatio);

    // 2. Quantum Gate Efficiency (Reward minimal gate solutions)
    // Assume optimal gates is ~ level.numQubits * 2
    const optimalGates = Math.max(1, level.numQubits * 2);
    const gateRatio = Math.max(0.2, Math.min(1.0, optimalGates / Math.max(optimalGates, gatesUsed)));
    const quantumEfficiency = Math.round(this.MAX_QUANTUM_EFFICIENCY * gateRatio);

    // 3. Probability Bonus (Reward high exit fidelity)
    const probBonus = Math.round(this.MAX_PROBABILITY_BONUS * Math.min(1.0, Math.max(0, finalProbability)));

    // 4. Energy Efficiency Bonus
    const energyRatio = Math.max(0, Math.min(1.0, energyRemaining / Math.max(1, level.initialEnergy)));
    const energyBonus = Math.round(this.MAX_ENERGY_BONUS * energyRatio);

    // 5. Measurement Budget Efficiency Bonus
    const remainingMeasurements = Math.max(0, level.measurementBudget - measurementsUsed);
    const measurementRatio = remainingMeasurements / Math.max(1, level.measurementBudget);
    const measurementBonus = Math.round(this.MAX_MEASUREMENT_BONUS * measurementRatio);

    // 6. Penalties
    const measPenalty = unnecessaryMeasurements * this.UNNECESSARY_MEASUREMENT_PENALTY;
    const invalidPenalty = invalidOperations * this.INVALID_OP_PENALTY;

    // Subtotal before multiplier
    let subtotal =
      this.BASE_SCORE +
      timeBonus +
      quantumEfficiency +
      probBonus +
      energyBonus +
      measurementBonus -
      measPenalty -
      invalidPenalty;

    // Restart penalty factor
    const restartMultiplier = Math.pow(0.9, restartsCount);
    let totalScore = Math.max(100, Math.round(subtotal * level.scoreMultiplier * restartMultiplier));

    // Calculate Star Rating (1 to 3 stars)
    // Max theoretical score per level is ~ 3000 * multiplier
    const maxPossible = (this.BASE_SCORE + 1900) * level.scoreMultiplier;
    let stars = 1;
    if (totalScore >= maxPossible * 0.75) {
      stars = 3;
    } else if (totalScore >= maxPossible * 0.5) {
      stars = 2;
    }

    return {
      baseScore: this.BASE_SCORE,
      timeBonus,
      quantumEfficiency,
      probabilityBonus: probBonus,
      energyBonus,
      measurementBonus,
      unnecessaryMeasurementPenalty: measPenalty,
      invalidOpPenalty: invalidPenalty,
      totalScore,
      stars,
      elapsedTime: Math.round(elapsedTime * 10) / 10,
      movesUsed: movesUsed || 0,
      gatesUsed,
      measurementsUsed,
      finalProbability: Math.round(finalProbability * 1000) / 1000,
      energyRemaining,
    };
  }
}
