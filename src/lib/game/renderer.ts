/**
 * Quantum Maze - 2D Canvas Laboratory Renderer
 * Renders high-fidelity laboratory floor tiles, dynamic wall topology with dissolve transitions,
 * quantum checkpoints, terminals, correlated doors, and exit stability vortices.
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

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export class MazeRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  public tileSize: number = 54;
  private particles: Particle[] = [];
  private wallTransitionProgress: number = 1.0; // 0 to 1 for wall dissolve/materialize
  private previousWalls: Set<string> = new Set();
  private currentWalls: Set<string> = new Set();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not obtain 2D canvas context.');
    this.ctx = context;
  }

  public resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  public triggerWallTransition(newWalls: Position[]) {
    this.previousWalls = new Set(this.currentWalls);
    this.currentWalls = new Set(newWalls.map((w) => `${w.r},${w.c}`));
    this.wallTransitionProgress = 0.0;
  }

  public addParticleBurst(x: number, y: number, color: string, count: number = 20) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 2 + Math.random() * 3,
        alpha: 1.0,
        life: 0,
        maxLife: 25 + Math.random() * 15,
      });
    }
  }

  public render(
    rows: number,
    cols: number,
    walls: Position[],
    player: Player,
    checkpoints: QuantumCheckpoint[],
    terminals: QuantumTerminal[],
    doors: QuantumDoor[],
    quantumObjects: QuantumObject[],
    energyCells: EnergyCell[],
    exit: ExitPortal,
    exitUnlocked: boolean,
    exitProbability: number,
    stateInfo: StateInfo | null,
    time: number
  ) {
    const ctx = this.ctx;
    const tileSize = this.tileSize;

    // Advance wall transition animation
    if (this.wallTransitionProgress < 1.0) {
      this.wallTransitionProgress = Math.min(1.0, this.wallTransitionProgress + 0.08);
    }

    // Set wall set
    const wallSet = new Set(walls.map((w) => `${w.r},${w.c}`));
    if (this.currentWalls.size === 0) {
      this.currentWalls = wallSet;
    }

    // Clear background with dark laboratory gradient
    ctx.fillStyle = '#06090e';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Calculate centering offset
    const mazeWidth = cols * tileSize;
    const mazeHeight = rows * tileSize;
    const offsetX = Math.max(16, (this.canvas.width - mazeWidth) / 2);
    const offsetY = Math.max(16, (this.canvas.height - mazeHeight) / 2);

    ctx.save();
    ctx.translate(offsetX, offsetY);

    // 1. Render Floor Grid
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = c * tileSize;
        const py = r * tileSize;
        this.renderFloorTile(ctx, px, py, tileSize, r, c);
      }
    }

    // 2. Render Dynamic Walls with Glitch/Dissolve Transition
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const key = `${r},${c}`;
        const isWall = wallSet.has(key);
        const wasWall = this.previousWalls.has(key);
        const px = c * tileSize;
        const py = r * tileSize;

        if (isWall && wasWall) {
          // Stable wall
          this.renderWall(ctx, px, py, tileSize, 1.0);
        } else if (isWall && !wasWall) {
          // Materializing wall
          this.renderWall(ctx, px, py, tileSize, this.wallTransitionProgress);
        } else if (!isWall && wasWall) {
          // Dissolving wall
          if (this.wallTransitionProgress < 1.0) {
            this.renderDissolvingWall(ctx, px, py, tileSize, 1.0 - this.wallTransitionProgress);
          }
        }
      }
    }

    // 3. Render Entanglement Beams
    this.renderEntanglementBeams(ctx, doors, tileSize, time);

    // 4. Render Checkpoints
    checkpoints.forEach((cp) => {
      this.renderCheckpoint(ctx, cp, tileSize, time);
    });

    // 5. Render Quantum Terminals
    terminals.forEach((term) => {
      this.renderTerminal(ctx, term, tileSize, time);
    });

    // 6. Render Quantum Objects
    quantumObjects.forEach((obj) => {
      this.renderQuantumObject(ctx, obj, tileSize, time);
    });

    // 7. Render Energy Cells
    energyCells.forEach((cell) => {
      if (!cell.collected) {
        this.renderEnergyCell(ctx, cell, tileSize, time);
      }
    });

    // 8. Render Doors
    doors.forEach((door) => {
      this.renderQuantumDoor(ctx, door, tileSize, stateInfo, time);
    });

    // 9. Render Exit Portal
    this.renderExitPortal(ctx, exit, tileSize, exitUnlocked, exitProbability, time);

    // 10. Render Player
    this.renderPlayer(ctx, player, tileSize, time);

    // 11. Render Particles
    this.renderParticles(ctx);

    ctx.restore();
  }

  private renderFloorTile(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, r: number, c: number) {
    const isAlt = (r + c) % 2 === 0;
    ctx.fillStyle = isAlt ? '#080d14' : '#0b111a';
    ctx.fillRect(x, y, size, size);

    ctx.strokeStyle = '#121c28';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x, y, size, size);
  }

  private renderWall(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    // Metallic laboratory bulkhead
    ctx.fillStyle = '#0f1722';
    ctx.fillRect(x, y, size, size);

    // Border highlight
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);

    // Inner plating
    ctx.fillStyle = '#141e2c';
    ctx.fillRect(x + 4, y + 4, size - 8, size - 8);

    // Cyan quantum micro-circuit traces
    ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.fillRect(x + 3, y + 3, 2, 2);
    ctx.fillRect(x + size - 5, y + 3, 2, 2);
    ctx.fillRect(x + 3, y + size - 5, 2, 2);
    ctx.fillRect(x + size - 5, y + size - 5, 2, 2);

    ctx.restore();
  }

  private renderDissolvingWall(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
    ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
    ctx.strokeStyle = '#00f0ff';
    ctx.setLineDash([2, 4]);
    ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
    ctx.restore();
  }

  private renderCheckpoint(ctx: CanvasRenderingContext2D, cp: QuantumCheckpoint, size: number, time: number) {
    const cx = cp.c * size + size / 2;
    const cy = cp.r * size + size / 2;
    const isAct = cp.activated;

    ctx.save();
    const color = isAct ? '#00f59b' : '#ffb703';
    const pulse = Math.sin(time * 4) * 0.15 + 0.85;

    ctx.shadowColor = color;
    ctx.shadowBlur = isAct ? 14 : 8;

    // Outer beacon ring
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.38 * pulse, 0, Math.PI * 2);
    ctx.stroke();

    // Checkpoint base circle
    ctx.fillStyle = '#0f1722';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.26, 0, Math.PI * 2);
    ctx.fill();

    // Center icon
    ctx.fillStyle = color;
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isAct ? '✓' : '⚑', cx, cy);

    ctx.restore();
  }

  private renderTerminal(ctx: CanvasRenderingContext2D, term: QuantumTerminal, size: number, time: number) {
    const cx = term.c * size + size / 2;
    const cy = term.r * size + size / 2;
    const isReady = term.unlocked;

    ctx.save();
    const color = isReady ? '#00f0ff' : '#64748b';

    ctx.fillStyle = '#0f1722';
    ctx.fillRect(cx - size * 0.3, cy - size * 0.3, size * 0.6, size * 0.6);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - size * 0.3, cy - size * 0.3, size * 0.6, size * 0.6);

    // Rotating core glyph if unlocked
    if (isReady) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(time * 2);
      ctx.strokeStyle = '#00f59b';
      ctx.lineWidth = 1;
      ctx.strokeRect(-size * 0.12, -size * 0.12, size * 0.24, size * 0.24);
      ctx.restore();
    }

    ctx.fillStyle = color;
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`q${term.qubitIndex}`, cx, cy);

    ctx.restore();
  }

  private renderQuantumObject(ctx: CanvasRenderingContext2D, obj: QuantumObject, size: number, time: number) {
    const cx = obj.c * size + size / 2;
    const cy = obj.r * size + size / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(123, 44, 191, 0.25)';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#c77dff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#c77dff';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Ψ${obj.qubitIndex}`, cx, cy);
    ctx.restore();
  }

  private renderQuantumDoor(
    ctx: CanvasRenderingContext2D,
    door: QuantumDoor,
    size: number,
    stateInfo: StateInfo | null,
    time: number
  ) {
    const px = door.c * size;
    const py = door.r * size;
    const cx = px + size / 2;
    const cy = py + size / 2;

    let pOpen = 0.5;
    let isCollapsed = false;
    let collapsedVal: number | null = null;

    if (stateInfo && stateInfo.qubit_probabilities[door.qubitIndex]) {
      const qp = stateInfo.qubit_probabilities[door.qubitIndex];
      pOpen = door.requiredState === 1 ? qp.p1 : qp.p0;
      if (qp.collapsed_state !== null) {
        isCollapsed = true;
        collapsedVal = qp.collapsed_state;
      }
    }

    ctx.save();

    // Side jambs
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(px, py, 4, size);
    ctx.fillRect(px + size - 4, py, 4, size);

    // Probability forcefield
    const oscillation = Math.sin(time * 6 + door.qubitIndex) * 0.15;
    const alpha = Math.max(0.2, 1.0 - pOpen + oscillation);

    if (pOpen >= 0.85) {
      // Open
      ctx.fillStyle = 'rgba(0, 245, 155, 0.2)';
      ctx.fillRect(px + 4, py, size - 8, size);
      ctx.strokeStyle = '#00f59b';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(px + 4, py + 2, size - 8, size - 4);
    } else {
      // Barrier active
      ctx.fillStyle = `rgba(0, 240, 255, ${alpha * 0.6})`;
      ctx.fillRect(px + 4, py, size - 8, size);
      ctx.strokeStyle = pOpen <= 0.2 ? '#ff3366' : '#00f0ff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + 4, py + 2, size - 8, size - 4);
    }

    // Probability text
    const probPct = Math.round(pOpen * 100);
    ctx.fillStyle = isCollapsed
      ? (collapsedVal === door.requiredState ? '#00f59b' : '#ff3366')
      : (probPct >= 70 ? '#00f59b' : '#00f0ff');
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${probPct}%`, cx, cy);

    ctx.restore();
  }

  private renderEntanglementBeams(ctx: CanvasRenderingContext2D, doors: QuantumDoor[], size: number, time: number) {
    doors.forEach((doorA) => {
      if (doorA.isEntangled && doorA.entangledWith) {
        const doorB = doors.find((d) => d.id === doorA.entangledWith);
        if (doorB && doorA.id < doorB.id) {
          const ax = doorA.c * size + size / 2;
          const ay = doorA.r * size + size / 2;
          const bx = doorB.c * size + size / 2;
          const by = doorB.r * size + size / 2;

          ctx.save();
          ctx.strokeStyle = 'rgba(199, 125, 255, 0.4)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 6]);
          ctx.lineDashOffset = -time * 20;

          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
          ctx.restore();
        }
      }
    });
  }

  private renderEnergyCell(ctx: CanvasRenderingContext2D, cell: EnergyCell, size: number, time: number) {
    const cx = cell.c * size + size / 2;
    const cy = cell.r * size + size / 2;
    const floatY = cy + Math.sin(time * 4 + cell.c) * 3;

    ctx.save();
    ctx.shadowColor = '#00f59b';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#00f59b';
    ctx.beginPath();
    ctx.moveTo(cx, floatY - 7);
    ctx.lineTo(cx + 6, floatY);
    ctx.lineTo(cx, floatY + 7);
    ctx.lineTo(cx - 6, floatY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private renderExitPortal(
    ctx: CanvasRenderingContext2D,
    exit: ExitPortal,
    size: number,
    unlocked: boolean,
    prob: number,
    time: number
  ) {
    const cx = exit.c * size + size / 2;
    const cy = exit.r * size + size / 2;

    ctx.save();

    // Color gradient based on real quantum probability
    let color = '#ff3366';
    if (prob >= 0.7) color = '#00f59b';
    else if (prob >= 0.4) color = '#ffb703';

    ctx.shadowColor = color;
    ctx.shadowBlur = unlocked ? 20 : 10;

    // Outer ring
    const pulse = Math.sin(time * 5) * 0.15 + 0.85;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.38 * pulse, 0, Math.PI * 2);
    ctx.stroke();

    // Inner vortex
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * (unlocked ? 3 : 1.2));
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI / 2) * i;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * size * 0.28, Math.sin(angle) * size * 0.28);
    }
    ctx.stroke();
    ctx.restore();

    // Probability percentage / status badge
    ctx.fillStyle = color;
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(unlocked ? 'EXIT' : `${Math.round(prob * 100)}%`, cx, cy);

    ctx.restore();
  }

  private renderPlayer(ctx: CanvasRenderingContext2D, player: Player, size: number, time: number) {
    const currentC = player.c + (player.targetC - player.c) * player.moveProgress;
    const currentR = player.r + (player.targetR - player.r) * player.moveProgress;

    const cx = currentC * size + size / 2;
    const cy = currentR * size + size / 2;

    ctx.save();
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;

    // Halo
    ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Torso
    ctx.fillStyle = '#0e2439';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Directional visor
    let vx = 0;
    let vy = 0;
    if (player.direction === 'UP') vy = -size * 0.14;
    else if (player.direction === 'DOWN') vy = size * 0.14;
    else if (player.direction === 'LEFT') vx = -size * 0.14;
    else if (player.direction === 'RIGHT') vx = size * 0.14;

    ctx.fillStyle = '#00f59b';
    ctx.beginPath();
    ctx.arc(cx + vx, cy + vy, size * 0.09, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderParticles(ctx: CanvasRenderingContext2D) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.life++;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
