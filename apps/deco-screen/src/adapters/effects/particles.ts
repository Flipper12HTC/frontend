import * as THREE from 'three';
import type { DecoEffectKind, DecoTrigger } from '../../domain/deco-event';
import type { EffectsRunner } from '../../application/renderer-orchestrator';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
}

// SpongeBob palette per event type
const EFFECT_COLORS: Record<DecoEffectKind, number[]> = {
  bumper:      [0xffd700, 0xffec6e, 0xffc400],        // SpongeBob yellow
  slingshot:   [0xff6b35, 0xff9a5c, 0xffb347],        // coral / orange
  drain:       [0x00bfff, 0x0080ff, 0x44aaff],        // deep ocean blue
  'game-over': [0xffd700, 0xff6b35, 0x00bfff, 0xff69b4, 0x44ff88], // rainbow
};

const SPAWN_COUNT: Record<DecoEffectKind, number> = {
  bumper:      22,
  slingshot:   15,
  drain:       30,
  'game-over': 18, // × 5 colours = 90 total
};

export function createParticleEffects(canvas: HTMLCanvasElement): EffectsRunner {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 18);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));

  const particles: Particle[] = [];
  const geometry = new THREE.SphereGeometry(0.14, 7, 7);

  // ── Ambient bubble layer ────────────────────────────────────────
  // Small bubbles that drift upward continuously behind the leaderboard

  interface AmbBubble { mesh: THREE.Mesh; vy: number; wobble: number; phase: number; ox: number }

  const AMB = 90;
  const ambGeo = new THREE.SphereGeometry(0.07, 5, 5);
  const ambMat = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.22 });
  const ambBubbles: AmbBubble[] = [];

  for (let i = 0; i < AMB; i++) {
    const m = new THREE.Mesh(ambGeo, ambMat);
    const ox = (Math.random() - 0.5) * 14;
    m.position.set(ox, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 4);
    scene.add(m);
    ambBubbles.push({ mesh: m, vy: 0.6 + Math.random() * 1.8, wobble: 0.4 + Math.random() * 0.9, phase: Math.random() * Math.PI * 2, ox });
  }

  // ── Spawn helpers ─────────────────────────────────────────────

  function spawnBatch(color: number, count: number, at: { x: number; z: number }): void {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.position.set(at.x, 0, at.z);
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 4.5;
      // Upward bias — particles float up like bubbles, less horizontal spread
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed * 0.5,
        (0.5 + Math.random() * 0.9) * speed,
        Math.sin(angle) * speed * 0.5,
      );
      scene.add(mesh);
      particles.push({ mesh, velocity, life: 1 });
    }
  }

  function spawn(trigger: DecoTrigger): void {
    const colors = EFFECT_COLORS[trigger.kind];
    if (trigger.kind === 'game-over') {
      // One batch per colour → rainbow explosion
      for (const color of colors) {
        spawnBatch(color, SPAWN_COUNT['game-over'], trigger.at);
      }
    } else {
      const color = colors[Math.floor(Math.random() * colors.length)] ?? colors[0] ?? 0xffffff;
      spawnBatch(color, SPAWN_COUNT[trigger.kind], trigger.at);
    }
  }

  // ── Tick ─────────────────────────────────────────────────────────

  let totalTime = 0;

  function tick(deltaMs: number): void {
    const dt = deltaMs / 1000;
    totalTime += dt;

    // Ambient bubbles
    for (const b of ambBubbles) {
      b.mesh.position.y += b.vy * dt;
      b.mesh.position.x = b.ox + Math.sin(totalTime * b.wobble + b.phase) * 0.35;
      if (b.mesh.position.y > 9) b.mesh.position.y = -9;
    }

    // Event particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (!p) continue;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.velocity.multiplyScalar(0.975);  // less drag → floatier
      p.velocity.y += dt * 0.8;          // buoyancy: subtle upward pull
      p.life -= dt * 0.6;                // slow fade → linger longer
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(p.life, 0);
      if (p.life <= 0) {
        scene.remove(p.mesh);
        particles.splice(i, 1);
      }
    }

    renderer.render(scene, camera);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { trigger: spawn, tick };
}
