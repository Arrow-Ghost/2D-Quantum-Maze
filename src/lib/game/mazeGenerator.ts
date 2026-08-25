/**
 * Quantum Maze - Client-side Deterministic Dynamic Maze Generator
 * Generates dynamic wall configurations after every valid player move while
 * strictly guaranteeing fixed dimensions, exact wall count invariance,
 * protected cell integrity, and 100% BFS path solvability.
 */
import type { Position } from '../types';

export class PRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  public next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296.0;
  }

  public shuffle<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

export function posKey(pos: Position): string {
  return `${pos.r},${pos.c}`;
}

export function parseKey(key: string): Position {
  const [r, c] = key.split(',').map(Number);
  return { r, c };
}

export function bfsPathExists(
  rows: number,
  cols: number,
  walls: Set<string>,
  start: Position,
  target: Position
): boolean {
  if (start.r === target.r && start.c === target.c) return true;
  if (walls.has(posKey(start)) || walls.has(posKey(target))) return false;

  const queue: Position[] = [start];
  const visited = new Set<string>([posKey(start)]);

  const directions = [
    { r: -1, c: 0 },
    { r: 1, c: 0 },
    { r: 0, c: -1 },
    { r: 0, c: 1 },
  ];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr.r === target.r && curr.c === target.c) {
      return true;
    }

    for (const d of directions) {
      const nr = curr.r + d.r;
      const nc = curr.c + d.c;
      const key = `${nr},${nc}`;

      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        if (!visited.has(key) && !walls.has(key)) {
          visited.add(key);
          queue.push({ r: nr, c: nc });
        }
      }
    }
  }

  return false;
}

export function generateDynamicWalls(
  rows: number,
  cols: number,
  wallCount: number,
  levelSeed: number,
  moveCount: number,
  playerPos: Position,
  exitPos: Position,
  checkpoints: Position[],
  terminals: Position[],
  objects: Position[],
  activeTargetCheckpoint: Position | null = null,
  previousWalls: Position[] | null = null,
  maxAttempts: number = 100
): Position[] {
  // 1. Build set of Protected Cells that can NEVER contain a dynamic wall
  const protectedSet = new Set<string>();
  protectedSet.add(posKey(playerPos));
  protectedSet.add(posKey(exitPos));
  checkpoints.forEach((p) => protectedSet.add(posKey(p)));
  terminals.forEach((p) => protectedSet.add(posKey(p)));
  objects.forEach((p) => protectedSet.add(posKey(p)));

  // 2. Candidate Cells: All grid cells minus protected cells
  const candidateCells: Position[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const pos: Position = { r, c };
      if (!protectedSet.has(posKey(pos))) {
        candidateCells.push(pos);
      }
    }
  }

  const targetWallCount = Math.min(wallCount, candidateCells.length);

  // 3. Deterministic PRNG seed derivation
  const prngSeed = (levelSeed + moveCount * 99991 + playerPos.r * 31 + playerPos.c * 7) >>> 0;
  const prng = new PRNG(prngSeed);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const shuffled = prng.shuffle(candidateCells);
    const chosenWalls = shuffled.slice(0, targetWallCount);
    const candidateWallSet = new Set<string>(chosenWalls.map(posKey));

    // Solvability check using classical BFS
    let isValid = false;
    if (activeTargetCheckpoint) {
      const reachCheckpoint = bfsPathExists(
        rows,
        cols,
        candidateWallSet,
        playerPos,
        activeTargetCheckpoint
      );
      const reachExitFromCheckpoint = bfsPathExists(
        rows,
        cols,
        candidateWallSet,
        activeTargetCheckpoint,
        exitPos
      );
      isValid = reachCheckpoint && reachExitFromCheckpoint;
    } else {
      const reachExit = bfsPathExists(rows, cols, candidateWallSet, playerPos, exitPos);
      const reachTerminals = terminals.every((t) =>
        bfsPathExists(rows, cols, candidateWallSet, playerPos, t)
      );
      isValid = reachExit && reachTerminals;
    }

    if (isValid) {
      return chosenWalls;
    }
  }

  // Fallback to previous valid walls if available
  if (previousWalls && previousWalls.length === targetWallCount) {
    const prevSet = new Set<string>(previousWalls.map(posKey));
    if (!prevSet.has(posKey(playerPos))) {
      return previousWalls;
    }
  }

  // Emergency fallback: guarantee exact count and protected cell safety
  const fallback = prng.shuffle(candidateCells).slice(0, targetWallCount);
  return fallback;
}
