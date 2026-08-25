/**
 * Quantum Maze - Local Storage & Settings Persistence
 */
import type { GameSettings, LeaderboardEntry, ScoreReport } from '../types';

export interface LevelProgress {
  unlocked: boolean;
  highScore: number;
  stars: number;
  bestTime: number;
  completed: boolean;
}

const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 80,
  sfxVolume: 80,
  musicVolume: 70,
  reducedMotion: false,
  highContrast: false,
  showProbabilityPercent: true,
  showDiracNotation: true,
  difficulty: 'NORMAL',
  debugMode: false,
};

const STORAGE_KEYS = {
  SETTINGS: 'quantum_maze_settings',
  PROGRESS: 'quantum_maze_progress',
  LEADERBOARD: 'quantum_maze_leaderboard',
  PLAYER_NAME: 'quantum_maze_player_name',
};

export class StorageManager {
  public static getSettings(): GameSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  public static saveSettings(settings: Partial<GameSettings>): GameSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
    return updated;
  }

  public static getProgress(): Record<string, LevelProgress> {
    if (typeof window === 'undefined') return { 'level-01': { unlocked: true, highScore: 0, stars: 0, bestTime: 0, completed: false } };
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROGRESS);
      const prog = data ? JSON.parse(data) : {};
      // Ensure level-01 is always unlocked
      if (!prog['level-01']) {
        prog['level-01'] = { unlocked: true, highScore: 0, stars: 0, bestTime: 0, completed: false };
      }
      return prog;
    } catch {
      return { 'level-01': { unlocked: true, highScore: 0, stars: 0, bestTime: 0, completed: false } };
    }
  }

  public static recordLevelCompletion(levelId: string, nextLevelId: string | null, scoreReport: ScoreReport) {
    if (typeof window === 'undefined') return;
    const prog = this.getProgress();
    const currentLevelProg = prog[levelId] || {
      unlocked: true,
      highScore: 0,
      stars: 0,
      bestTime: 9999,
      completed: false,
    };

    prog[levelId] = {
      unlocked: true,
      highScore: Math.max(currentLevelProg.highScore, scoreReport.totalScore),
      stars: Math.max(currentLevelProg.stars, scoreReport.stars),
      bestTime: Math.min(currentLevelProg.bestTime || 9999, scoreReport.elapsedTime),
      completed: true,
    };

    if (nextLevelId) {
      if (!prog[nextLevelId]) {
        prog[nextLevelId] = { unlocked: true, highScore: 0, stars: 0, bestTime: 0, completed: false };
      } else {
        prog[nextLevelId].unlocked = true;
      }
    }

    try {
      localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(prog));
    } catch (e) {
      console.error('Failed to save level progress:', e);
    }
  }

  public static getLeaderboard(): LeaderboardEntry[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LEADERBOARD);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public static addLeaderboardEntry(entry: Omit<LeaderboardEntry, 'id' | 'date'>) {
    if (typeof window === 'undefined') return;
    const list = this.getLeaderboard();
    const newEntry: LeaderboardEntry = {
      ...entry,
      id: 'entry_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      date: new Date().toISOString(),
    };
    list.push(newEntry);
    // Sort descending by score
    list.sort((a, b) => b.totalScore - a.totalScore);
    // Keep top 100 entries
    const trimmed = list.slice(0, 100);
    try {
      localStorage.setItem(STORAGE_KEYS.LEADERBOARD, JSON.stringify(trimmed));
    } catch (e) {
      console.error('Failed to save leaderboard:', e);
    }
  }

  public static getPlayerName(): string {
    if (typeof window === 'undefined') return 'Quantum-Observer';
    return localStorage.getItem(STORAGE_KEYS.PLAYER_NAME) || 'Quantum-Observer';
  }

  public static setPlayerName(name: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, name.trim() || 'Quantum-Observer');
  }
}
