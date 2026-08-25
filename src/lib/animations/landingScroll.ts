/**
 * landingScroll.ts
 * GSAP ScrollTrigger Integration for the Quantum Maze Landing Experience.
 * Coordinates smooth scroll progress with the WebGL QuantumMasterScene and
 * controls cinematic DOM animations across all narrative chapters.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { QuantumMasterScene } from '../webgl/QuantumMasterScene';

gsap.registerPlugin(ScrollTrigger);

export function initLandingScroll(scene: QuantumMasterScene): () => void {
  // Global master scroll progress linked to WebGL scene
  const masterTrigger = ScrollTrigger.create({
    trigger: '#landingStoryContainer',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.4,
    onUpdate: (self) => {
      scene.setScrollProgress(self.progress);

      // Update scroll progress HUD indicator
      const progressMeter = document.getElementById('hudScrollProgress');
      if (progressMeter) {
        progressMeter.style.width = `${Math.round(self.progress * 100)}%`;
      }
      const progressVal = document.getElementById('hudScrollProgressVal');
      if (progressVal) {
        progressVal.textContent = `${(self.progress * 100).toFixed(1)}%`;
      }
    },
  });

  // 1. Hero Section Animations
  gsap.timeline({
    scrollTrigger: {
      trigger: '#sectionHero',
      start: 'top top',
      end: 'bottom top',
      scrub: true,
    },
  })
    .to('#heroMainContent', {
      opacity: 0,
      y: -60,
      scale: 0.96,
      ease: 'power1.out',
    });

  // 2. Maze Transformation Section
  const mazeTl = gsap.timeline({
    scrollTrigger: {
      trigger: '#sectionMazeStory',
      start: 'top 70%',
      end: 'bottom 30%',
      scrub: true,
    },
  });

  mazeTl
    .fromTo('#mazeTitle', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.3 })
    .fromTo('#mazeCard1', { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.3 })
    .to('#mazeCounter', { textContent: 'MOVE 002', duration: 0.2 })
    .fromTo('#mazeCard2', { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.3 })
    .to('#mazeCounter', { textContent: 'MOVE 003', duration: 0.2 })
    .fromTo('#mazeCard3', { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.3 });

  // 3. Superposition Section
  gsap.timeline({
    scrollTrigger: {
      trigger: '#sectionSuperposition',
      start: 'top 65%',
      end: 'center center',
      scrub: true,
    },
  })
    .fromTo('#superpositionTitle', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4 })
    .fromTo('#superpositionFormula', { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.4 })
    .fromTo('#probBar0', { width: '100%' }, { width: '50%', duration: 0.4 })
    .fromTo('#probBar1', { width: '0%' }, { width: '50%', duration: 0.4 });

  // 4. Quantum Gates Section (H, X, Z, CNOT)
  gsap.utils.toArray('.gate-showcase-panel').forEach((panel: any) => {
    gsap.fromTo(
      panel,
      { opacity: 0, y: 50 },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        scrollTrigger: {
          trigger: panel,
          start: 'top 75%',
          end: 'top 35%',
          scrub: true,
        },
      }
    );
  });

  // 5. Measurement Section
  gsap.timeline({
    scrollTrigger: {
      trigger: '#sectionMeasurement',
      start: 'top 60%',
      end: 'bottom 40%',
      scrub: true,
    },
  })
    .fromTo('#measPulseIndicator', { scale: 0.8, opacity: 0 }, { scale: 1.2, opacity: 1, duration: 0.4 })
    .to('#measResultBox', { borderColor: '#00f59b', boxShadow: '0 0 25px rgba(0,245,155,0.4)', duration: 0.3 })
    .fromTo('#measOutcomeVal', { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.3 });

  // 6. Game Loop Vertical Circuit Animation
  gsap.timeline({
    scrollTrigger: {
      trigger: '#sectionGameLoop',
      start: 'top 70%',
      end: 'bottom 40%',
      scrub: true,
    },
  })
    .fromTo('#circuitPathLine', { strokeDashoffset: 1000 }, { strokeDashoffset: 0, duration: 1.0 })
    .fromTo('.circuit-step-badge', { opacity: 0, x: -20 }, { opacity: 1, x: 0, stagger: 0.1, duration: 0.5 });

  // 7. Exit Probability & Final CTA
  gsap.timeline({
    scrollTrigger: {
      trigger: '#sectionFinalCTA',
      start: 'top 80%',
      end: 'center center',
      scrub: true,
    },
  })
    .fromTo('#finalExitProb', { innerText: '20%' }, { innerText: '96%', snap: { innerText: 1 }, duration: 0.8 })
    .fromTo('.final-cta-btn', { opacity: 0, y: 20 }, { opacity: 1, y: 0, stagger: 0.1, duration: 0.4 });

  // Cleanup return function
  return () => {
    masterTrigger.kill();
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  };
}
