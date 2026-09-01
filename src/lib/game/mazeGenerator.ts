/**
 * Quantum Maze - deterministic maze generator.
 *
 * Produces a real, always-solvable maze (randomised depth-first "recursive
 * backtracker" over a room lattice) rather than random noise. The layout is
 * stable within a "phase" and reshuffles every few moves, so the topology still
 * shifts but the player can plan a route.
 *
 * The public signature is kept compatible with the previous version; `wallCount`
 * is now advisory only - solvability always wins.
 */
import type { Position } from '../types';

export class PRNG {
  private state: number;
  constructor(seed: number) {
    this.state = (seed >>> 0) || 1;
  }
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296.0;
  }
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
  shuffle<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

export function posKey(p: Position): string {
  return `${p.r},${p.c}`;
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
  const q: Position[] = [start];
  const seen = new Set<string>([posKey(start)]);
  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  while (q.length) {
    const cur = q.shift()!;
    if (cur.r === target.r && cur.c === target.c) return true;
    for (const [dr, dc] of dirs) {
      const nr = cur.r + dr;
      const nc = cur.c + dc;
      const k = `${nr},${nc}`;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (seen.has(k) || walls.has(k)) continue;
      seen.add(k);
      q.push({ r: nr, c: nc });
    }
  }
  return false;
}

/** How many moves a maze layout stays fixed before it reshuffles. */
export const MAZE_PHASE_MOVES = 1;

/**
 * Backwards-compatible entry point used by the game engine.
 * Extra positional args (terminals, objects, ...) are folded into the protected
 * set so passages are always carved through them.
 */
export function generateDynamicWalls(
  rows: number,
  cols: number,
  _wallCount: number,
  levelSeed: number,
  moveCount: number,
  playerPos: Position,
  exitPos: Position,
  checkpoints: Position[] = [],
  terminals: Position[] = [],
  objects: Position[] = [],
  activeTargetCheckpoint: Position | null = null,
  _previousWalls: Position[] | null = null
): Position[] {
  const phase = Math.floor(moveCount / MAZE_PHASE_MOVES);
  const seed = (levelSeed * 2654435761 + phase * 40503 + 1) >>> 0;
  const prng = new PRNG(seed);

  const protectedCells: Position[] = [
    playerPos,
    exitPos,
    ...checkpoints,
    ...terminals,
    ...objects,
  ];

  // 1. Carve a perfect maze over a lattice of "rooms" at even coordinates.
  const passage: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const roomRows = Math.floor((rows + 1) / 2);
  const roomCols = Math.floor((cols + 1) / 2);
  const visited: boolean[][] = Array.from({ length: roomRows }, () => new Array(roomCols).fill(false));

  const stack: [number, number][] = [[0, 0]];
  visited[0][0] = true;
  passage[0][0] = true;
  const roomDirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  while (stack.length) {
    const [rr, rc] = stack[stack.length - 1];
    const options = prng.shuffle(roomDirs).filter(([dr, dc]) => {
      const nr = rr + dr;
      const nc = rc + dc;
      return nr >= 0 && nr < roomRows && nc >= 0 && nc < roomCols && !visited[nr][nc];
    });
    if (!options.length) {
      stack.pop();
      continue;
    }
    const [dr, dc] = options[0];
    const nr = rr + dr;
    const nc = rc + dc;
    visited[nr][nc] = true;
    // Room cell + the wall cell between the two rooms become passages.
    passage[nr * 2][nc * 2] = true;
    passage[rr * 2 + dr][rc * 2 + dc] = true;
    stack.push([nr, nc]);
  }

  // 2. Force every protected cell open and make sure it has at least one exit.
  const inBounds = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < cols;
  for (const p of protectedCells) {
    if (!inBounds(p.r, p.c)) continue;
    passage[p.r][p.c] = true;
    const neigh = roomDirs
      .map(([dr, dc]) => [p.r + dr, p.c + dc] as [number, number])
      .filter(([r, c]) => inBounds(r, c));
    if (neigh.some(([r, c]) => passage[r][c])) continue;
    if (neigh.length) {
      const pick = neigh[prng.int(neigh.length)];
      passage[pick[0]][pick[1]] = true;
    }
  }

  // 3. Guarantee the critical route with a straight carve if the maze fell short.
  const wallSet = () => {
    const s = new Set<string>();
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) if (!passage[r][c]) s.add(`${r},${c}`);
    return s;
  };
  const carveLine = (from: Position, to: Position) => {
    let r = from.r;
    let c = from.c;
    let guard = 0;
    while ((r !== to.r || c !== to.c) && guard++ < rows * cols) {
      if (Math.abs(to.r - r) > Math.abs(to.c - c)) r += to.r > r ? 1 : -1;
      else c += to.c > c ? 1 : -1;
      if (inBounds(r, c)) passage[r][c] = true;
    }
  };
  const waypoints: Position[] = activeTargetCheckpoint
    ? [playerPos, activeTargetCheckpoint, exitPos]
    : [playerPos, ...checkpoints, exitPos];
  for (let i = 0; i < waypoints.length - 1; i++) {
    if (!bfsPathExists(rows, cols, wallSet(), waypoints[i], waypoints[i + 1])) {
      carveLine(waypoints[i], waypoints[i + 1]);
    }
  }

  // 4. Emit the wall list.
  const walls: Position[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!passage[r][c]) walls.push({ r, c });
    }
  }
  return walls;
}
