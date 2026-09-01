/**
 * Quantum Maze - 2D canvas renderer.
 *
 * Draws the maze, actors and exit at a tile size computed to fit the canvas, so
 * every level (6x17 up to 11x27) is fully visible. Colours are read from CSS
 * custom properties so the active theme drives the board.
 */
import type {
  Player,
  Position,
  QuantumCheckpoint,
  QuantumTerminal,
  QuantumDoor,
  QuantumObject,
  EnergyCell,
  ExitPortal,
  StateInfo,
} from '../types';

interface Palette {
  bg: string;
  floorA: string;
  floorB: string;
  grid: string;
  wall: string;
  wallEdge: string;
  accent: string;
  accent2: string;
  ok: string;
  warn: string;
  danger: string;
  player: string;
  text: string;
}

const FALLBACK: Palette = {
  bg: '#0f0a1a',
  floorA: '#161226',
  floorB: '#1b1630',
  grid: '#241c3d',
  wall: '#2b2350',
  wallEdge: '#4b3a86',
  accent: '#a970ff',
  accent2: '#00e0c6',
  ok: '#3ce8a0',
  warn: '#ffb020',
  danger: '#ff4d5e',
  player: '#ffffff',
  text: '#e8e2f5',
};

export class MazeRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  public tileSize = 40;
  private palette: Palette = { ...FALLBACK };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable.');
    this.ctx = ctx;
    this.refreshPalette();
  }

  /** Re-read theme colours from the document (call after a theme switch). */
  public refreshPalette() {
    if (typeof window === 'undefined') return;
    const cs = getComputedStyle(document.documentElement);
    const g = (name: string, fb: string) => {
      const v = cs.getPropertyValue(name).trim();
      return v || fb;
    };
    this.palette = {
      bg: g('--board-bg', FALLBACK.bg),
      floorA: g('--board-floor-a', FALLBACK.floorA),
      floorB: g('--board-floor-b', FALLBACK.floorB),
      grid: g('--board-grid', FALLBACK.grid),
      wall: g('--board-wall', FALLBACK.wall),
      wallEdge: g('--board-wall-edge', FALLBACK.wallEdge),
      accent: g('--accent', FALLBACK.accent),
      accent2: g('--accent-2', FALLBACK.accent2),
      ok: g('--ok', FALLBACK.ok),
      warn: g('--warn', FALLBACK.warn),
      danger: g('--danger', FALLBACK.danger),
      player: g('--board-player', FALLBACK.player),
      text: g('--text', FALLBACK.text),
    };
  }

  // Space kept clear on the right for the quantum readout panel, and on the
  // bottom for the theme dock / help button, so the board never hides behind UI.
  private reserveRight = 0;
  private reserveBottom = 0;

  /** Resize the backing store to the element's box and size tiles to fit. */
  public fit(rows: number, cols: number) {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(240, Math.floor(rect.height));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    this.reserveRight = w > 760 ? 262 : 0;
    this.reserveBottom = 52;
    const availW = w - this.reserveRight - 24;
    const availH = h - this.reserveBottom - 24;
    this.tileSize = Math.max(14, Math.floor(Math.min(availW / cols, availH / rows)));
  }

  // Legacy no-ops kept so callers don't break.
  public resize(_w: number, _h: number) {}
  public triggerWallTransition(_walls: Position[]) {}
  public addParticleBurst(_x: number, _y: number, _c: string, _n?: number) {}

  public render(
    rows: number,
    cols: number,
    walls: Position[],
    player: Player,
    checkpoints: QuantumCheckpoint[],
    terminals: QuantumTerminal[],
    _doors: QuantumDoor[],
    quantumObjects: QuantumObject[],
    energyCells: EnergyCell[],
    exit: ExitPortal,
    exitUnlocked: boolean,
    exitProbability: number,
    _stateInfo: StateInfo | null,
    time: number
  ) {
    const ctx = this.ctx;
    const t = this.tileSize;
    const p = this.palette;

    this.fit(rows, cols);

    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const mazeW = cols * t;
    const mazeH = rows * t;
    const ox = Math.floor((this.canvas.width - this.reserveRight - mazeW) / 2);
    const oy = Math.floor((this.canvas.height - this.reserveBottom - mazeH) / 2);

    ctx.save();
    ctx.translate(ox, oy);

    // Floor
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? p.floorA : p.floorB;
        ctx.fillRect(c * t, r * t, t, t);
      }
    }

    // Walls (flat blocks with a hard top-left edge - arcade look)
    const wallSet = new Set(walls.map((w) => `${w.r},${w.c}`));
    for (const w of walls) {
      const x = w.c * t;
      const y = w.r * t;
      ctx.fillStyle = p.wall;
      ctx.fillRect(x, y, t, t);
      ctx.fillStyle = p.wallEdge;
      if (!wallSet.has(`${w.r - 1},${w.c}`)) ctx.fillRect(x, y, t, 3);
      if (!wallSet.has(`${w.r},${w.c - 1}`)) ctx.fillRect(x, y, 3, t);
    }

    // Board frame
    ctx.strokeStyle = p.grid;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, mazeW - 2, mazeH - 2);

    energyCells.forEach((cell) => {
      if (!cell.collected) this.drawEnergy(cell, t, time);
    });
    quantumObjects.forEach((o) => this.drawObject(o, t));
    checkpoints.forEach((cp) => this.drawCheckpoint(cp, t, time));
    terminals.forEach((term) => this.drawTerminal(term, t, time));
    this.drawExit(exit, t, exitUnlocked, exitProbability, time);
    this.drawPlayer(player, t);

    ctx.restore();
  }

  private center(rc: { r: number; c: number }, t: number) {
    return { x: rc.c * t + t / 2, y: rc.r * t + t / 2 };
  }

  private drawEnergy(cell: EnergyCell, t: number, time: number) {
    const ctx = this.ctx;
    const { x, y } = this.center(cell, t);
    const bob = Math.sin(time * 3 + cell.c) * 2;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.fillStyle = this.palette.ok;
    ctx.beginPath();
    ctx.moveTo(0, -t * 0.16);
    ctx.lineTo(t * 0.14, 0);
    ctx.lineTo(0, t * 0.16);
    ctx.lineTo(-t * 0.14, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawObject(o: QuantumObject, t: number) {
    const ctx = this.ctx;
    const { x, y } = this.center(o, t);
    ctx.save();
    ctx.strokeStyle = this.palette.accent2;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - t * 0.22, y - t * 0.22, t * 0.44, t * 0.44);
    ctx.fillStyle = this.palette.accent2;
    ctx.font = `bold ${Math.round(t * 0.24)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`q${o.qubitIndex}`, x, y);
    ctx.restore();
  }

  private drawCheckpoint(cp: QuantumCheckpoint, t: number, time: number) {
    const ctx = this.ctx;
    const { x, y } = this.center(cp, t);
    const col = cp.activated ? this.palette.ok : this.palette.warn;
    const pulse = cp.activated ? 1 : Math.sin(time * 4) * 0.12 + 0.88;
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - t * 0.3 * pulse, y - t * 0.3 * pulse, t * 0.6 * pulse, t * 0.6 * pulse);
    ctx.fillStyle = col;
    ctx.font = `bold ${Math.round(t * 0.34)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cp.activated ? '✓' : '⚑', x, y);
    ctx.restore();
  }

  private drawTerminal(term: QuantumTerminal, t: number, time: number) {
    const ctx = this.ctx;
    const { x, y } = this.center(term, t);
    const ready = term.unlocked;
    const col = ready ? this.palette.accent : this.palette.grid;
    ctx.save();
    ctx.fillStyle = ready ? 'rgba(0,0,0,0.35)' : 'transparent';
    ctx.fillRect(x - t * 0.3, y - t * 0.3, t * 0.6, t * 0.6);
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - t * 0.3, y - t * 0.3, t * 0.6, t * 0.6);
    if (ready) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(time * 1.6);
      ctx.strokeStyle = this.palette.accent2;
      ctx.lineWidth = 2;
      ctx.strokeRect(-t * 0.12, -t * 0.12, t * 0.24, t * 0.24);
      ctx.restore();
    }
    ctx.fillStyle = col === this.palette.grid ? this.palette.text : col;
    ctx.font = `bold ${Math.round(t * 0.22)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`q${term.qubitIndex}`, x, y);
    ctx.restore();
  }

  private drawExit(exit: ExitPortal, t: number, unlocked: boolean, prob: number, time: number) {
    const ctx = this.ctx;
    const { x, y } = this.center(exit, t);
    const col = unlocked ? this.palette.ok : this.palette.danger;
    ctx.save();
    const pulse = Math.sin(time * 5) * 0.12 + 0.88;
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - t * 0.36 * pulse, y - t * 0.36 * pulse, t * 0.72 * pulse, t * 0.72 * pulse);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * (unlocked ? 2.4 : 0.8));
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.strokeRect(-t * 0.18, -t * 0.18, t * 0.36, t * 0.36);
    ctx.restore();
    ctx.fillStyle = col;
    ctx.font = `bold ${Math.round(t * 0.2)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(unlocked ? 'EXIT' : `${Math.round(prob * 100)}%`, x, y);
    ctx.restore();
  }

  private drawPlayer(player: Player, t: number) {
    const ctx = this.ctx;
    const cc = player.c + (player.targetC - player.c) * player.moveProgress;
    const cr = player.r + (player.targetR - player.r) * player.moveProgress;
    const x = cc * t + t / 2;
    const y = cr * t + t / 2;
    ctx.save();
    ctx.fillStyle = this.palette.player;
    ctx.strokeStyle = this.palette.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, t * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    let vx = 0;
    let vy = 0;
    if (player.direction === 'UP') vy = -t * 0.16;
    else if (player.direction === 'DOWN') vy = t * 0.16;
    else if (player.direction === 'LEFT') vx = -t * 0.16;
    else vx = t * 0.16;
    ctx.fillStyle = this.palette.accent;
    ctx.beginPath();
    ctx.arc(x + vx, y + vy, t * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
