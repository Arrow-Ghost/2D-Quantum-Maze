/**
 * QuantumMasterScene.ts
 * Master Three.js WebGL Experience Engine for the Quantum Maze Landing Page.
 * Renders a continuous procedural quantum probability field, evolving smoothly
 * through all experiment phases: Hero, Dynamic Maze, Superposition, H/X/Z Gates,
 * CNOT Entanglement, Measurement Collapse, Game Loop, and Exit Vortex.
 */
import * as THREE from 'three';

export interface SceneConfig {
  canvas: HTMLCanvasElement;
  particleCount?: number;
}

export class QuantumMasterScene {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  // Particles System
  private particleCount: number = 6000;
  private particlesGeometry!: THREE.BufferGeometry;
  private particlesMaterial!: THREE.ShaderMaterial;
  private particleSystem!: THREE.Points;

  // Particle Attributes Buffers
  private initialPositions!: Float32Array;
  private mazePositions!: Float32Array;
  private superpositionPositions!: Float32Array;
  private hGatePositions!: Float32Array;
  private xGatePositions!: Float32Array;
  private zGatePositions!: Float32Array;
  private cnotPositions!: Float32Array;
  private collapsePositions!: Float32Array;
  private exitPositions!: Float32Array;
  private particleColors!: Float32Array;
  private particlePhases!: Float32Array;

  // Auxiliary Scene Objects
  private ambientRings: THREE.Group = new THREE.Group();
  private entanglementBeam!: THREE.Line;
  private gridPlane!: THREE.GridHelper;
  private exitPortalMesh!: THREE.Mesh;

  // State & Uniforms
  private scrollProgress: number = 0.0;
  private targetScrollProgress: number = 0.0;
  private mouse = new THREE.Vector2(0, 0);
  private targetMouse = new THREE.Vector2(0, 0);
  private clock: THREE.Clock = new THREE.Clock();
  private isRunning: boolean = true;
  private animationFrameId: number | null = null;

  constructor(config: SceneConfig) {
    this.canvas = config.canvas;
    if (config.particleCount) {
      this.particleCount = config.particleCount;
    } else {
      // Adjust particle count for mobile vs desktop
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      this.particleCount = isMobile ? 2500 : 6500;
    }

    // 1. Initialize WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0.0);

    // 2. Initialize Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 9);

    // 3. Build Geometries & Systems
    this.initParticleBuffers();
    this.createParticleSystem();
    this.createAuxiliaryVisuals();

    // 4. Attach Event Listeners
    this.onWindowResize = this.onWindowResize.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);

    window.addEventListener('resize', this.onWindowResize, { passive: true });
    window.addEventListener('mousemove', this.onMouseMove, { passive: true });

    // 5. Start Animation Loop
    this.animate = this.animate.bind(this);
    this.animate();
  }

  private initParticleBuffers() {
    const count = this.particleCount;
    this.initialPositions = new Float32Array(count * 3);
    this.mazePositions = new Float32Array(count * 3);
    this.superpositionPositions = new Float32Array(count * 3);
    this.hGatePositions = new Float32Array(count * 3);
    this.xGatePositions = new Float32Array(count * 3);
    this.zGatePositions = new Float32Array(count * 3);
    this.cnotPositions = new Float32Array(count * 3);
    this.collapsePositions = new Float32Array(count * 3);
    this.exitPositions = new Float32Array(count * 3);
    this.particleColors = new Float32Array(count * 3);
    this.particlePhases = new Float32Array(count);

    const cyan = new THREE.Color(0x00f0ff);
    const emerald = new THREE.Color(0x00f59b);
    const magenta = new THREE.Color(0xc77dff);
    const amber = new THREE.Color(0xffb703);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const phase = Math.random() * Math.PI * 2;
      this.particlePhases[i] = phase;

      // 1. Initial State: Volumetric Probability Cloud
      const r = Math.pow(Math.random(), 0.6) * 3.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      this.initialPositions[i3] = r * Math.sin(phi) * Math.cos(theta);
      this.initialPositions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      this.initialPositions[i3 + 2] = r * Math.cos(phi) * 0.7;

      // 2. Maze Grid Layout
      const cols = 17;
      const rows = 6;
      const colIdx = Math.floor(Math.random() * cols);
      const rowIdx = Math.floor(Math.random() * rows);
      const cellX = (colIdx - cols / 2 + 0.5) * 0.45 + (Math.random() - 0.5) * 0.2;
      const cellY = (rowIdx - rows / 2 + 0.5) * 0.45 + (Math.random() - 0.5) * 0.2;
      const cellZ = (Math.random() - 0.5) * 0.3;
      this.mazePositions[i3] = cellX;
      this.mazePositions[i3 + 1] = cellY;
      this.mazePositions[i3 + 2] = cellZ;

      // 3. Superposition Splitting: Dual |0> and |1> Lobes
      const isStateOne = i % 2 === 0;
      const lobeCenterX = isStateOne ? 1.8 : -1.8;
      const lobeR = Math.pow(Math.random(), 0.7) * 1.3;
      const lobeAngle = Math.random() * Math.PI * 2;
      this.superpositionPositions[i3] = lobeCenterX + lobeR * Math.cos(lobeAngle);
      this.superpositionPositions[i3 + 1] = lobeR * Math.sin(lobeAngle) * 0.9;
      this.superpositionPositions[i3 + 2] = (Math.random() - 0.5) * 0.6;

      // 4. Hadamard Transformation Plane
      const hX = (Math.random() - 0.5) * 4.5;
      const hY = Math.sin(hX * 2 + phase) * 0.8 + (Math.random() - 0.5) * 0.5;
      const hZ = Math.cos(hX * 2 + phase) * 0.8 + (Math.random() - 0.5) * 0.5;
      this.hGatePositions[i3] = hX;
      this.hGatePositions[i3 + 1] = hY;
      this.hGatePositions[i3 + 2] = hZ;

      // 5. Pauli-X Bit Flip Trajectory
      const tParam = (i / count);
      const xAngle = tParam * Math.PI;
      this.xGatePositions[i3] = -2.2 * Math.cos(xAngle);
      this.xGatePositions[i3 + 1] = 1.6 * Math.sin(xAngle) + (Math.random() - 0.5) * 0.3;
      this.xGatePositions[i3 + 2] = (Math.random() - 0.5) * 0.4;

      // 6. Pauli-Z Phase Wave & Interference
      const zX = (i / count - 0.5) * 6.0;
      const wave1 = Math.sin(zX * 3.0);
      const wave2 = isStateOne ? Math.sin(zX * 3.0 + Math.PI) : Math.sin(zX * 3.0);
      this.zGatePositions[i3] = zX;
      this.zGatePositions[i3 + 1] = (wave1 + wave2) * 0.7 + (Math.random() - 0.5) * 0.2;
      this.zGatePositions[i3 + 2] = (Math.random() - 0.5) * 0.4;

      // 7. CNOT Entangled Bell State Pair
      const isQubit0 = i % 2 === 0;
      const qCenterX = isQubit0 ? -1.6 : 1.6;
      const qRadius = 0.9 + Math.sin(phase * 2) * 0.3;
      this.cnotPositions[i3] = qCenterX + qRadius * Math.cos(phase);
      this.cnotPositions[i3 + 1] = qRadius * Math.sin(phase);
      this.cnotPositions[i3 + 2] = Math.sin(phase * 3) * 0.5;

      // 8. Wavefunction Collapse
      const collapseR = Math.pow(Math.random(), 3.0) * 0.35;
      const cAngle = Math.random() * Math.PI * 2;
      this.collapsePositions[i3] = collapseR * Math.cos(cAngle);
      this.collapsePositions[i3 + 1] = collapseR * Math.sin(cAngle);
      this.collapsePositions[i3 + 2] = (Math.random() - 0.5) * 0.2;

      // 9. Exit Probability Vortex
      const vRadius = 0.2 + Math.pow(Math.random(), 0.5) * 2.8;
      const vAngle = phase * 3 + vRadius * 2.5;
      this.exitPositions[i3] = vRadius * Math.cos(vAngle);
      this.exitPositions[i3 + 1] = vRadius * Math.sin(vAngle);
      this.exitPositions[i3 + 2] = Math.sin(vAngle * 2) * 0.4;

      // Color selection based on quantum state
      const colorMix = Math.random();
      let pColor = cyan;
      if (colorMix > 0.7) pColor = emerald;
      else if (colorMix > 0.4) pColor = magenta;
      else if (colorMix > 0.35) pColor = amber;

      this.particleColors[i3] = pColor.r;
      this.particleColors[i3 + 1] = pColor.g;
      this.particleColors[i3 + 2] = pColor.b;
    }
  }

  private createParticleSystem() {
    this.particlesGeometry = new THREE.BufferGeometry();
    this.particlesGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(this.initialPositions), 3)
    );
    this.particlesGeometry.setAttribute(
      'aInitial',
      new THREE.BufferAttribute(this.initialPositions, 3)
    );
    this.particlesGeometry.setAttribute(
      'aMaze',
      new THREE.BufferAttribute(this.mazePositions, 3)
    );
    this.particlesGeometry.setAttribute(
      'aSuperposition',
      new THREE.BufferAttribute(this.superpositionPositions, 3)
    );
    this.particlesGeometry.setAttribute(
      'aHGate',
      new THREE.BufferAttribute(this.hGatePositions, 3)
    );
    this.particlesGeometry.setAttribute(
      'aXGate',
      new THREE.BufferAttribute(this.xGatePositions, 3)
    );
    this.particlesGeometry.setAttribute(
      'aZGate',
      new THREE.BufferAttribute(this.zGatePositions, 3)
    );
    this.particlesGeometry.setAttribute(
      'aCNOT',
      new THREE.BufferAttribute(this.cnotPositions, 3)
    );
    this.particlesGeometry.setAttribute(
      'aCollapse',
      new THREE.BufferAttribute(this.collapsePositions, 3)
    );
    this.particlesGeometry.setAttribute(
      'aExit',
      new THREE.BufferAttribute(this.exitPositions, 3)
    );
    this.particlesGeometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.particleColors, 3)
    );
    this.particlesGeometry.setAttribute(
      'aPhase',
      new THREE.BufferAttribute(this.particlePhases, 1)
    );

    // Custom Shaders for Multi-Morph Particle Interpolation
    const vertexShader = `
      uniform float uTime;
      uniform float uProgress;
      uniform vec2 uMouse;

      attribute vec3 aInitial;
      attribute vec3 aMaze;
      attribute vec3 aSuperposition;
      attribute vec3 aHGate;
      attribute vec3 aXGate;
      attribute vec3 aZGate;
      attribute vec3 aCNOT;
      attribute vec3 aCollapse;
      attribute vec3 aExit;
      attribute float aPhase;

      varying vec3 vColor;
      varying float vAlpha;

      vec3 getPositionForProgress(float p) {
        if (p <= 0.12) {
          float t = smoothstep(0.0, 0.12, p);
          return mix(aInitial, aMaze, t);
        } else if (p <= 0.24) {
          float t = smoothstep(0.12, 0.24, p);
          return mix(aMaze, aSuperposition, t);
        } else if (p <= 0.36) {
          float t = smoothstep(0.24, 0.36, p);
          return mix(aSuperposition, aHGate, t);
        } else if (p <= 0.48) {
          float t = smoothstep(0.36, 0.48, p);
          return mix(aHGate, aXGate, t);
        } else if (p <= 0.58) {
          float t = smoothstep(0.48, 0.58, p);
          return mix(aXGate, aZGate, t);
        } else if (p <= 0.68) {
          float t = smoothstep(0.58, 0.68, p);
          return mix(aZGate, aCNOT, t);
        } else if (p <= 0.78) {
          float t = smoothstep(0.68, 0.78, p);
          return mix(aCNOT, aCollapse, t);
        } else {
          float t = smoothstep(0.78, 1.0, p);
          return mix(aCollapse, aExit, t);
        }
      }

      void main() {
        vColor = color;
        vec3 pos = getPositionForProgress(uProgress);

        // Subtle harmonic wave agitation
        float wave = sin(uTime * 1.8 + aPhase * 4.0) * 0.08;
        pos.x += wave * cos(aPhase);
        pos.y += wave * sin(aPhase);
        pos.z += wave * 0.5;

        // Subtle cursor attraction / repulsion field
        vec2 mouseWorld = uMouse * 3.5;
        float distToMouse = length(pos.xy - mouseWorld);
        if (distToMouse < 2.0) {
          float force = (2.0 - distToMouse) * 0.25;
          pos.xy += normalize(pos.xy - mouseWorld) * force;
        }

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        // Size attenuation based on depth and scroll stage
        float sizeFactor = 38.0 / -mvPosition.z;
        if (uProgress > 0.78 && uProgress < 0.88) {
          sizeFactor *= 1.4;
        }
        gl_PointSize = clamp(sizeFactor * (0.8 + 0.4 * sin(uTime * 3.0 + aPhase)), 2.0, 18.0);

        vAlpha = clamp(0.3 + 0.7 * (1.0 / (1.0 + length(pos) * 0.2)), 0.2, 0.95);
      }
    `;

    const fragmentShader = `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        if (dist > 0.5) discard;

        float intensity = 1.0 - smoothstep(0.0, 0.5, dist);
        intensity = pow(intensity, 1.6);

        vec3 col = mix(vColor, vec3(1.0), smoothstep(0.2, 0.0, dist));
        gl_FragColor = vec4(col, intensity * vAlpha);
      }
    `;

    this.particlesMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0.0 },
        uProgress: { value: 0.0 },
        uMouse: { value: new THREE.Vector2(0, 0) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });

    this.particleSystem = new THREE.Points(this.particlesGeometry, this.particlesMaterial);
    this.scene.add(this.particleSystem);
  }

  private createAuxiliaryVisuals() {
    // 1. Ambient Orbital Quantum Rings (Hero state)
    const ringMat1 = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.25,
    });
    const ringMat2 = new THREE.LineBasicMaterial({
      color: 0xc77dff,
      transparent: true,
      opacity: 0.2,
    });

    const ringGeom1 = new THREE.BufferGeometry();
    const ringGeom2 = new THREE.BufferGeometry();
    const ringPoints1: number[] = [];
    const ringPoints2: number[] = [];

    const segments = 80;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      ringPoints1.push(Math.cos(theta) * 3.8, Math.sin(theta) * 3.8, 0);
      ringPoints2.push(Math.cos(theta) * 2.9, 0, Math.sin(theta) * 2.9);
    }

    ringGeom1.setAttribute('position', new THREE.Float32BufferAttribute(ringPoints1, 3));
    ringGeom2.setAttribute('position', new THREE.Float32BufferAttribute(ringPoints2, 3));

    const ring1 = new THREE.Line(ringGeom1, ringMat1);
    const ring2 = new THREE.Line(ringGeom2, ringMat2);

    this.ambientRings.add(ring1);
    this.ambientRings.add(ring2);
    this.scene.add(this.ambientRings);

    // 2. Laboratory Floor Grid (Subtle depth cue)
    this.gridPlane = new THREE.GridHelper(18, 24, 0x00f0ff, 0x0f172a);
    this.gridPlane.position.y = -3.2;
    (this.gridPlane.material as THREE.Material).transparent = true;
    (this.gridPlane.material as THREE.Material).opacity = 0.15;
    this.scene.add(this.gridPlane);

    // 3. Entanglement Bridge Beam (Between q0 and q1 in CNOT stage)
    const beamGeom = new THREE.BufferGeometry();
    const beamPoints = [new THREE.Vector3(-1.6, 0, 0), new THREE.Vector3(1.6, 0, 0)];
    beamGeom.setFromPoints(beamPoints);
    const beamMat = new THREE.LineDashedMaterial({
      color: 0xc77dff,
      dashSize: 0.15,
      gapSize: 0.08,
      linewidth: 2,
      transparent: true,
      opacity: 0.0,
    });
    this.entanglementBeam = new THREE.Line(beamGeom, beamMat);
    this.entanglementBeam.computeLineDistances();
    this.scene.add(this.entanglementBeam);

    // 4. Exit Portal Core Mesh
    const portalGeom = new THREE.RingGeometry(0.8, 0.95, 48);
    const portalMat = new THREE.MeshBasicMaterial({
      color: 0x00f59b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
    });
    this.exitPortalMesh = new THREE.Mesh(portalGeom, portalMat);
    this.exitPortalMesh.position.set(0, 0, 0);
    this.scene.add(this.exitPortalMesh);
  }

  public setScrollProgress(progress: number) {
    this.targetScrollProgress = Math.max(0.0, Math.min(1.0, progress));
  }

  private onMouseMove(e: MouseEvent) {
    this.targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  private onWindowResize() {
    if (!this.canvas) return;
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }

  private animate() {
    if (!this.isRunning) return;
    this.animationFrameId = requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();

    this.scrollProgress += (this.targetScrollProgress - this.scrollProgress) * 0.08;
    this.mouse.lerp(this.targetMouse, 0.06);

    if (this.particlesMaterial) {
      this.particlesMaterial.uniforms.uTime.value = elapsedTime;
      this.particlesMaterial.uniforms.uProgress.value = this.scrollProgress;
      this.particlesMaterial.uniforms.uMouse.value.copy(this.mouse);
    }

    const p = this.scrollProgress;
    const camZ = 9.0 - p * 3.2;
    const camY = Math.sin(p * Math.PI) * 0.8 + this.mouse.y * 0.25;
    const camX = this.mouse.x * 0.35;

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(0, 0, 0);

    const heroAlpha = Math.max(0.0, 1.0 - p * 6.0);
    this.ambientRings.rotation.x = elapsedTime * 0.2;
    this.ambientRings.rotation.y = elapsedTime * 0.3;
    this.ambientRings.children.forEach((child) => {
      ((child as THREE.Line).material as THREE.Material).opacity = heroAlpha * 0.3;
    });

    const cnotAlpha = Math.max(
      0.0,
      Math.min(1.0, (1.0 - Math.abs(p - 0.72) / 0.08))
    );
    (this.entanglementBeam.material as THREE.Material).opacity = cnotAlpha * 0.8;
    this.entanglementBeam.rotation.z = Math.sin(elapsedTime * 4.0) * 0.05;

    const exitAlpha = Math.max(0.0, (p - 0.85) / 0.15);
    (this.exitPortalMesh.material as THREE.Material).opacity = exitAlpha * 0.9;
    this.exitPortalMesh.rotation.z = -elapsedTime * 2.0;
    this.exitPortalMesh.scale.setScalar(1.0 + Math.sin(elapsedTime * 5.0) * 0.08);

    (this.gridPlane.material as THREE.Material).opacity = 0.08 + p * 0.1;

    this.renderer.render(this.scene, this.camera);
  }

  public dispose() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('mousemove', this.onMouseMove);

    this.particlesGeometry?.dispose();
    this.particlesMaterial?.dispose();
    this.renderer?.dispose();
  }
}
