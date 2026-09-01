/**
 * Quantum Maze - Client-side statevector simulator.
 *
 * A small, dependency-free replacement for the Python/Qiskit backend so the game
 * is fully playable offline. Supports H, X, Y, Z, S, T, CNOT and single-qubit
 * Born-rule measurement, and reports the same StateInfo shape the UI expects.
 *
 * Convention: little-endian. Qubit q occupies bit (1 << q) of the amplitude
 * index. Basis strings are printed most-significant-qubit first, e.g. "q1 q0".
 */
import type { StateInfo, BasisState, QubitProbability, GateEntry } from '../types';

const SQRT1_2 = Math.SQRT1_2;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Complex2x2 = [number, number, number, number, number, number, number, number];
// [a.re, a.im, b.re, b.im, c.re, c.im, d.re, d.im]  for  [[a, b], [c, d]]

const GATES: Record<string, Complex2x2> = {
  H: [SQRT1_2, 0, SQRT1_2, 0, SQRT1_2, 0, -SQRT1_2, 0],
  X: [0, 0, 1, 0, 1, 0, 0, 0],
  Y: [0, 0, 0, -1, 0, 1, 0, 0],
  Z: [1, 0, 0, 0, 0, 0, -1, 0],
  S: [1, 0, 0, 0, 0, 0, 0, 1],
  T: [1, 0, 0, 0, 0, 0, Math.cos(Math.PI / 4), Math.sin(Math.PI / 4)],
};

export class QuantumSim {
  public readonly numQubits: number;
  private re: Float64Array;
  private im: Float64Array;
  public collapsed: Record<number, number> = {};
  private rng: () => number;
  private step = 0;

  constructor(numQubits: number, seed: number = 1) {
    this.numQubits = Math.max(1, Math.min(6, numQubits));
    const dim = 1 << this.numQubits;
    this.re = new Float64Array(dim);
    this.im = new Float64Array(dim);
    this.re[0] = 1;
    this.rng = mulberry32(seed || 1);
  }

  /** Apply a list of {gate,target,control?} without spending energy (level setup). */
  public applyInitial(gates: { gate: string; target: number; control?: number | null }[]) {
    for (const g of gates) {
      this.gate(g.gate, g.target, g.control ?? null);
    }
  }

  private applySingle(m: Complex2x2, q: number) {
    const bit = 1 << q;
    const dim = this.re.length;
    const [are, aim, bre, bim, cre, cim, dre, dim_] = m;
    for (let i = 0; i < dim; i++) {
      if (i & bit) continue;
      const j = i | bit;
      const x0r = this.re[i];
      const x0i = this.im[i];
      const x1r = this.re[j];
      const x1i = this.im[j];
      // new0 = a*x0 + b*x1
      this.re[i] = are * x0r - aim * x0i + bre * x1r - bim * x1i;
      this.im[i] = are * x0i + aim * x0r + bre * x1i + bim * x1r;
      // new1 = c*x0 + d*x1
      this.re[j] = cre * x0r - cim * x0i + dre * x1r - dim_ * x1i;
      this.im[j] = cre * x0i + cim * x0r + dre * x1i + dim_ * x1r;
    }
  }

  private applyCNOT(control: number, target: number) {
    const cbit = 1 << control;
    const tbit = 1 << target;
    const dim = this.re.length;
    for (let i = 0; i < dim; i++) {
      if ((i & cbit) === 0) continue;
      if (i & tbit) continue;
      const j = i | tbit;
      const tr = this.re[i];
      const ti = this.im[i];
      this.re[i] = this.re[j];
      this.im[i] = this.im[j];
      this.re[j] = tr;
      this.im[j] = ti;
    }
  }

  /** Apply a named gate. Returns the circuit entry that was recorded. */
  public gate(name: string, target: number, control: number | null = null): GateEntry {
    const g = name.toUpperCase();
    this.step += 1;
    if (g === 'CNOT' || g === 'CX') {
      if (control === null) throw new Error('CNOT requires a control qubit.');
      // A unitary gate on a previously measured qubit re-activates it.
      delete this.collapsed[target];
      delete this.collapsed[control];
      this.applyCNOT(control, target);
    } else if (GATES[g]) {
      delete this.collapsed[target];
      this.applySingle(GATES[g], target);
    } else {
      throw new Error(`Unknown gate '${name}'.`);
    }
    return {
      id: `g${this.step}`,
      gate: g === 'CX' ? 'CNOT' : g,
      target,
      control,
      param: null,
      step: this.step,
    };
  }

  /** Born-rule measurement of one qubit. Returns the outcome (0 or 1). */
  public measure(target: number): { outcome: number; entry: GateEntry } {
    const bit = 1 << target;
    const dim = this.re.length;
    let p1 = 0;
    for (let i = 0; i < dim; i++) {
      if (i & bit) p1 += this.re[i] * this.re[i] + this.im[i] * this.im[i];
    }
    const outcome = this.rng() < p1 ? 1 : 0;
    const keepP = outcome === 1 ? p1 : 1 - p1;
    const norm = keepP > 1e-12 ? 1 / Math.sqrt(keepP) : 0;
    for (let i = 0; i < dim; i++) {
      const has = (i & bit) !== 0 ? 1 : 0;
      if (has !== outcome) {
        this.re[i] = 0;
        this.im[i] = 0;
      } else {
        this.re[i] *= norm;
        this.im[i] *= norm;
      }
    }
    this.collapsed[target] = outcome;
    this.step += 1;
    return {
      outcome,
      entry: { id: `m${this.step}`, gate: 'M', target, control: null, param: null, step: this.step },
    };
  }

  private reducedPurity(q: number): number {
    // 2x2 reduced density matrix of qubit q, then Tr(rho^2).
    const bit = 1 << q;
    const dim = this.re.length;
    let r00 = 0;
    let r11 = 0;
    let r01re = 0;
    let r01im = 0;
    for (let i = 0; i < dim; i++) {
      if (i & bit) continue;
      const j = i | bit;
      const a0r = this.re[i];
      const a0i = this.im[i];
      const a1r = this.re[j];
      const a1i = this.im[j];
      r00 += a0r * a0r + a0i * a0i;
      r11 += a1r * a1r + a1i * a1i;
      // rho01 += a0 * conj(a1)
      r01re += a0r * a1r + a0i * a1i;
      r01im += a0i * a1r - a0r * a1i;
    }
    return r00 * r00 + r11 * r11 + 2 * (r01re * r01re + r01im * r01im);
  }

  public stateInfo(): StateInfo {
    const dim = this.re.length;
    const n = this.numQubits;
    const basis_states: BasisState[] = [];
    for (let i = 0; i < dim; i++) {
      const re = this.re[i];
      const im = this.im[i];
      const prob = re * re + im * im;
      let deg = (Math.atan2(im, re) * 180) / Math.PI;
      if (deg < 0) deg += 360;
      basis_states.push({
        binary: i.toString(2).padStart(n, '0'),
        amplitude_real: round(re, 6),
        amplitude_imag: round(im, 6),
        probability: round(prob, 6),
        phase_radians: round(Math.atan2(im, re), 6),
        phase_degrees: round(deg, 2),
      });
    }

    const qubit_probabilities: QubitProbability[] = [];
    for (let q = 0; q < n; q++) {
      if (q in this.collapsed) {
        const v = this.collapsed[q];
        qubit_probabilities.push({
          qubit: q,
          p0: v === 0 ? 1 : 0,
          p1: v === 1 ? 1 : 0,
          phase_diff: 0,
          is_entangled: false,
          collapsed_state: v,
        });
        continue;
      }
      const bit = 1 << q;
      let p1 = 0;
      for (let i = 0; i < dim; i++) {
        if (i & bit) p1 += this.re[i] * this.re[i] + this.im[i] * this.im[i];
      }
      const p0 = 1 - p1;
      const purity = n > 1 ? this.reducedPurity(q) : 1;
      let phase_diff = 0;
      if (n === 1) {
        const ph0 = Math.atan2(this.im[0], this.re[0]);
        const ph1 = Math.atan2(this.im[1], this.re[1]);
        phase_diff = round((((ph1 - ph0) * 180) / Math.PI + 360) % 360, 2);
      }
      qubit_probabilities.push({
        qubit: q,
        p0: round(p0, 6),
        p1: round(p1, 6),
        phase_diff,
        is_entangled: purity < 0.98,
        collapsed_state: null,
      });
    }

    return {
      num_qubits: n,
      basis_states,
      qubit_probabilities,
      dirac_notation: diracNotation(basis_states, n),
      is_pure: true,
      purity: 1,
    };
  }

  public asciiDiagram(gates: GateEntry[]): string {
    const n = this.numQubits;
    const lines: string[] = [];
    for (let q = 0; q < n; q++) {
      let line = `q${q}: |0>`;
      for (const g of gates) {
        if (g.gate === 'CNOT') {
          if (g.control === q) line += '──●──';
          else if (g.target === q) line += '──⊕──';
          else line += '─────';
        } else if (g.target === q) {
          line += `──[${g.gate}]──`;
        } else {
          line += '─────';
        }
      }
      lines.push(line);
    }
    return lines.join('\n');
  }
}

function round(v: number, d: number): number {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}

function diracNotation(basis: BasisState[], n: number): string {
  const terms: string[] = [];
  for (const b of basis) {
    if (b.probability <= 1e-4) continue;
    const mag = Math.sqrt(b.probability);
    if (Math.abs(b.amplitude_imag) < 1e-4) {
      const sign = b.amplitude_real >= 0 ? '+' : '-';
      terms.push(`${sign} ${mag.toFixed(3)}|${b.binary}⟩`);
    } else {
      terms.push(
        `+ (${b.amplitude_real.toFixed(3)}${b.amplitude_imag >= 0 ? '+' : ''}${b.amplitude_imag.toFixed(3)}i)|${b.binary}⟩`
      );
    }
  }
  if (!terms.length) return `|${'0'.repeat(n)}⟩`;
  let out = terms.join(' ').trim();
  if (out.startsWith('+ ')) out = out.slice(2);
  return out;
}
