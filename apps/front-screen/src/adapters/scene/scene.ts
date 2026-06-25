import * as THREE from 'three';
import { GLTFLoader, OrbitControls, RoomEnvironment } from 'three/examples/jsm/Addons.js';
import { TABLE } from '@flipper/contracts';
import { createPhysicsDebug } from './physics-debug';
import { createJellyfishBumpers, type JellyfishBumpers } from '../meshes/jellyfish-bumpers';

export interface PinballMeshes {
  flipperLeft: THREE.Object3D;
  flipperRight: THREE.Object3D;
}

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  render: () => void;
  resize: () => void;
  onMeshesReady: (cb: (meshes: PinballMeshes) => void) => void;
  toggleDebug: () => void;
  updateDebugBall: (pos: { x: number; y: number; z: number }) => void;
  addBallTrail: (pos: { x: number; y: number; z: number }) => void;
  triggerShake: () => void;
  jellyfishBumpers: JellyfishBumpers;
}

const RENDER_WIDTH = 1080;
const RENDER_HEIGHT = 1920;

// ── Bubble sprite ──────────────────────────────────────────────────────────
function makeBubbleSprite(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 6, 32, 32, 28);
  g.addColorStop(0,   'rgba(135,206,250,0)');
  g.addColorStop(0.6, 'rgba(135,206,250,0.07)');
  g.addColorStop(0.8, 'rgba(180,230,255,0.7)');
  g.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.arc(24, 24, 4, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(c);
}

function createBubbleLayer(
  scene: THREE.Scene,
  count: number,
  size: number,
  opacity: number,
): (t: number) => void {
  const px = new Float32Array(count);
  const py = new Float32Array(count);
  const pz = new Float32Array(count);
  const vy = new Float32Array(count);
  const wf = new Float32Array(count);
  const wa = new Float32Array(count);
  const wp = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    px[i] = (Math.random() - 0.5) * (TABLE.width + 3);
    py[i] = Math.random() * 26 - 3;
    pz[i] = (Math.random() - 0.5) * (TABLE.depth + 3);
    vy[i] = 0.3 + Math.random() * 0.9;
    wf[i] = 0.35 + Math.random() * 0.75;
    wa[i] = 0.07 + Math.random() * 0.22;
    wp[i] = Math.random() * Math.PI * 2;
  }

  const positions = new Float32Array(count * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    size,
    map: makeBubbleSprite(),
    transparent: true,
    opacity,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  scene.add(new THREE.Points(geo, mat));
  const attr = geo.attributes['position'] as THREE.BufferAttribute;
  const WRAP = 28;

  return (t: number) => {
    for (let i = 0; i < count; i++) {
      const x = (px[i] ?? 0) + Math.sin(t * (wf[i] ?? 0) + (wp[i] ?? 0)) * (wa[i] ?? 0);
      const y = (((py[i] ?? 0) + t * (vy[i] ?? 0)) % WRAP) - 3;
      const z = pz[i] ?? 0;
      attr.setXYZ(i, x, y, z);
    }
    attr.needsUpdate = true;
  };
}

// ── Caustiques sous-marines animées (overlay canvas sur le sol) ────────────
function createCausticOverlay(scene: THREE.Scene, floor: FloorSampler): (t: number) => void {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);

  const geo = new THREE.PlaneGeometry(TABLE.width + 0.5, TABLE.depth + 0.5);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const plane = new THREE.Mesh(geo, mat);
  plane.rotation.x = floor.rotX;
  plane.position.set(0, floor.getY(0, 0) + 0.025, 0);
  scene.add(plane);

  let frame = 0;
  return (t: number) => {
    if (frame++ % 2 !== 0) return;
    ctx.clearRect(0, 0, size, size);
    // Reflets caustiques chauds (lumière soleil filtrée par l'eau — Bikini Bottom)
    for (let i = 0; i < 38; i++) {
      const bx = size / 2 + Math.sin(t * 0.34 + i * 1.27) * size * 0.45;
      const by = size / 2 + Math.cos(t * 0.28 + i * 0.91) * size * 0.45;
      const br = size * 0.040 + Math.sin(t * 0.55 + i * 0.62) * size * 0.022;
      const a  = 0.30 + Math.sin(t * 0.45 + i * 1.1) * 0.18;
      const g  = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      // Teal-doré : mélange lumière soleil + reflet eau sous-marin
      g.addColorStop(0,   `rgba(180,240,210,${a})`);
      g.addColorStop(0.4, `rgba(100,210,180,${a * 0.5})`);
      g.addColorStop(1,   'rgba(40,160,140,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
    tex.needsUpdate = true;
  };
}

// ── Points lumineux mouvants (caustiques volumétriques) ───────────────────
function createCausticLights(scene: THREE.Scene): (t: number) => void {
  const defs = [
    { x: -1.5, z: -5.5 },
    { x:  2.2, z: -2.0 },
    { x: -2.0, z:  1.0 },
    { x:  1.5, z:  4.5 },
    { x:  0.0, z: -7.0 },
  ];

  const lights: {
    light: THREE.PointLight;
    ox: number; oz: number;
    spd: number; ph: number; amp: number;
  }[] = [];

  for (const d of defs) {
    const light = new THREE.PointLight(0x55ddff, 3.2, 7.5);
    light.position.set(d.x, 2.0, d.z);
    scene.add(light);
    lights.push({
      light, ox: d.x, oz: d.z,
      spd: 0.20 + Math.random() * 0.38,
      ph:  Math.random() * Math.PI * 2,
      amp: 1.4 + Math.random() * 1.6,
    });
  }

  return (t: number) => {
    for (const c of lights) {
      c.light.position.x = c.ox + Math.sin(t * c.spd + c.ph) * c.amp;
      c.light.position.z = c.oz + Math.cos(t * c.spd * 0.73 + c.ph) * c.amp;
      c.light.intensity  = 2.5 + Math.sin(t * c.spd * 2.1 + c.ph) * 1.2;
    }
  };
}


type FloorSampler = { getY: (x: number, z: number) => number; rotX: number };


// ── Plaque "BIKINI BOTTOM PINBALL" canvas ──────────────────────────────────
function createTitlePlaque(scene: THREE.Scene): void {
  const cw = 512, ch = 128;
  const can = document.createElement('canvas');
  can.width = cw; can.height = ch;
  const ctx = can.getContext('2d')!;

  // Fond bleu océan
  ctx.fillStyle = 'rgba(0,55,140,0.90)';
  ctx.beginPath();
  ctx.moveTo(18, 8); ctx.lineTo(cw - 18, 8);
  ctx.arcTo(cw - 8, 8, cw - 8, 18, 10);
  ctx.lineTo(cw - 8, ch - 18);
  ctx.arcTo(cw - 8, ch - 8, cw - 18, ch - 8, 10);
  ctx.lineTo(18, ch - 8);
  ctx.arcTo(8, ch - 8, 8, ch - 18, 10);
  ctx.lineTo(8, 18);
  ctx.arcTo(8, 8, 18, 8, 10);
  ctx.closePath();
  ctx.fill();

  // Bordure dorée
  ctx.strokeStyle = '#ffcc00';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Titre
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowBlur = 14;

  ctx.font = 'bold 48px "Arial Black", Impact, sans-serif';
  ctx.shadowColor = '#ff7700';
  ctx.fillStyle = '#ffe500';
  ctx.fillText('BIKINI BOTTOM', cw / 2, ch / 2 - 14);

  ctx.font = 'bold 24px "Arial Black", Impact, sans-serif';
  ctx.shadowColor = '#00aaff';
  ctx.fillStyle = '#aaeeff';
  ctx.fillText('P  I  N  B  A  L  L', cw / 2, ch / 2 + 26);

  const tex = new THREE.CanvasTexture(can);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(0, 2.2, -8.0);
  sprite.scale.set(6.5, 1.625, 1);
  scene.add(sprite);
}


// ── Fond sous-marin animé (rayons soleil + caustiques + abysses) ──────────
function createOceanSky(scene: THREE.Scene): (t: number) => void {
  const W = 512, H = 256;
  const can = document.createElement('canvas');
  can.width = W; can.height = H;
  const ctx = can.getContext('2d')!;
  const tex = new THREE.CanvasTexture(can);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(85, 32, 16), mat));

  let frame = 0;
  return (t: number) => {
    if (frame++ % 3 !== 0) return;

    // ── Gradient de base : surface lumineuse → abysses ─────────────────
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0.00, '#c8f0ff'); // surface — lumière blanche filtrée
    bg.addColorStop(0.12, '#5bbde0');
    bg.addColorStop(0.35, '#1a7ab8');
    bg.addColorStop(0.60, '#0a4a78');
    bg.addColorStop(0.80, '#052a50');
    bg.addColorStop(1.00, '#010e1e'); // abysses
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ── Rayons de soleil (god rays) depuis la surface ──────────────────
    const CX = W / 2, CY = -H * 0.08; // origine légèrement au-dessus du canvas
    const RAY_COUNT = 14;
    for (let i = 0; i < RAY_COUNT; i++) {
      const baseAngle = (i / RAY_COUNT) * Math.PI - Math.PI / 2;
      const wobble    = Math.sin(t * 0.22 + i * 0.9) * 0.06
                      + Math.sin(t * 0.11 + i * 1.7) * 0.03;
      const angle     = baseAngle + wobble;
      const len       = H * (0.65 + Math.sin(t * 0.18 + i * 0.55) * 0.15);
      const halfW     = (8 + (i % 5) * 7) * (0.7 + Math.sin(t * 0.3 + i) * 0.3);
      const alpha     = 0.04 + Math.sin(t * 0.4 + i * 1.1) * 0.025;

      const ex = CX + Math.cos(angle) * len;
      const ey = CY + Math.sin(angle) * len;
      const px = -Math.sin(angle) * halfW;
      const py =  Math.cos(angle) * halfW;

      const rg = ctx.createLinearGradient(CX, CY, ex, ey);
      rg.addColorStop(0,   `rgba(220, 248, 255, ${alpha * 2.2})`);
      rg.addColorStop(0.3, `rgba(160, 220, 255, ${alpha})`);
      rg.addColorStop(1,   'rgba(60, 160, 220, 0)');

      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.lineTo(ex + px, ey + py);
      ctx.lineTo(ex - px, ey - py);
      ctx.closePath();
      ctx.fillStyle = rg;
      ctx.fill();
    }

    // ── Caustiques à la surface (halo animé) ───────────────────────────
    for (let i = 0; i < 22; i++) {
      const cx = W * 0.5 + Math.sin(t * 0.28 + i * 1.3) * W * 0.38;
      const cy = Math.abs(Math.cos(t * 0.21 + i * 0.85)) * H * 0.18;
      const cr = 18 + Math.sin(t * 0.5 + i * 0.7) * 10;
      const ca = 0.10 + Math.sin(t * 0.4 + i * 1.05) * 0.06;
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
      cg.addColorStop(0,   `rgba(210, 248, 255, ${ca})`);
      cg.addColorStop(0.5, `rgba(120, 210, 245, ${ca * 0.4})`);
      cg.addColorStop(1,   'rgba(60, 160, 220, 0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Vignette latérale (plus sombre sur les côtés = profondeur) ─────
    const vl = ctx.createLinearGradient(0, 0, W * 0.3, 0);
    vl.addColorStop(0, 'rgba(1,10,28,0.55)');
    vl.addColorStop(1, 'rgba(1,10,28,0)');
    ctx.fillStyle = vl;
    ctx.fillRect(0, 0, W * 0.3, H);
    const vr = ctx.createLinearGradient(W, 0, W * 0.7, 0);
    vr.addColorStop(0, 'rgba(1,10,28,0.55)');
    vr.addColorStop(1, 'rgba(1,10,28,0)');
    ctx.fillStyle = vr;
    ctx.fillRect(W * 0.7, 0, W * 0.3, H);

    tex.needsUpdate = true;
  };
}

// ── Inserts lumineux dans le sol (style vrai flipper) ─────────────────────
function createInsertLights(scene: THREE.Scene, floor: FloorSampler): (t: number) => void {
  const inserts: {
    mat: THREE.MeshBasicMaterial;
    phase: number;
    freq: number;
    r: number;
    g: number;
    b: number;
  }[] = [];

  const defs: { x: number; z: number; color: number; r: number }[] = [];

  const c = new THREE.Color();
  for (const d of defs) {
    c.setHex(d.color);
    const mat = new THREE.MeshBasicMaterial({
      color: d.color,
      transparent: true,
      opacity: 0.92,
    });
    const circle = new THREE.Mesh(new THREE.CircleGeometry(d.r, 16), mat);
    circle.rotation.x = floor.rotX;
    circle.position.set(d.x, floor.getY(d.x, d.z), d.z);
    scene.add(circle);

    inserts.push({
      mat,
      phase: Math.random() * Math.PI * 2,
      freq: 0.5 + Math.random() * 0.9,
      r: c.r,
      g: c.g,
      b: c.b,
    });
  }

  return (t: number) => {
    for (const ins of inserts) {
      const pulse = 0.55 + Math.sin(t * ins.freq + ins.phase) * 0.45;
      ins.mat.color.setRGB(ins.r * pulse, ins.g * pulse, ins.b * pulse);
    }
  };
}

// ── Traînée de bulles derrière la balle ───────────────────────────────────
function createBallTrail(scene: THREE.Scene): {
  add: (pos: { x: number; y: number; z: number }) => void;
  tick: (dt: number) => void;
} {
  const POOL = 36;
  const DURATION = 0.6;
  const tex = makeBubbleSprite();

  const pool: {
    mat: THREE.SpriteMaterial;
    sprite: THREE.Sprite;
    life: number;
    vy: number;
  }[] = [];

  for (let i = 0; i < POOL; i++) {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(0);
    sprite.visible = false;
    scene.add(sprite);
    pool.push({ mat, sprite, life: -1, vy: 0 });
  }

  let frame = 0;

  return {
    add(pos: { x: number; y: number; z: number }): void {
      if (frame++ % 2 !== 0) return;
      const p = pool.find((pp) => pp.life <= 0);
      if (!p) return;
      p.sprite.position.set(
        pos.x + (Math.random() - 0.5) * 0.14,
        pos.y + 0.08,
        pos.z + (Math.random() - 0.5) * 0.14,
      );
      p.sprite.scale.setScalar(0.11 + Math.random() * 0.09);
      p.sprite.visible = true;
      p.mat.opacity = 0.8;
      p.life = DURATION;
      p.vy = 0.55 + Math.random() * 0.75;
    },
    tick(dt: number): void {
      for (const p of pool) {
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.sprite.visible = false;
          p.mat.opacity = 0;
        } else {
          p.mat.opacity = (p.life / DURATION) * 0.8;
          p.sprite.position.y += p.vy * dt;
        }
      }
    },
  };
}

// ── Flaques d'eau animées (fond marin Bikini Bottom) ─────────────────────
function createWaterPuddles(scene: THREE.Scene, floor: FloorSampler): (t: number) => void {
  // Positions le long des parois et zones naturelles du playfield
  const spots = [
    { x: 0.5, z: 1.4, rx: 0.75, rz: 0.50, seed: 1.3 },
    { x:  1.5, z: -3.0, rx: 0.60, rz: 0.44, seed: 2.7 },
    { x: -2.8, z:  3.8, rx: 0.62, rz: 0.46, seed: 0.8 },
    { x:  0.0, z: -0.5, rx: 0.68, rz: 0.50, seed: 4.1 },
    { x: -2.0, z: -3.5, rx: 0.48, rz: 0.38, seed: 3.5 },
  ];

  const SZ = 256;
  const ticks: ((t: number) => void)[] = [];

  for (const sp of spots) {
    // ── Forme irrégulière organique (polygone perturbé, pas un cercle parfait) ──
    const N    = 28;
    const vArr: number[] = [0, 0, 0];
    const uvArr: number[] = [0.5, 0.5];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const r = 1.0
        + 0.20 * Math.sin(a * 2.3 + sp.seed)
        + 0.13 * Math.sin(a * 4.7 + sp.seed * 1.8)
        + 0.07 * Math.cos(a * 7.1 + sp.seed * 0.6);
      const vx = Math.cos(a) * sp.rx * r;
      const vy = Math.sin(a) * sp.rz * r;
      vArr.push(vx, vy, 0);
      uvArr.push(vx / (sp.rx * 1.5) * 0.5 + 0.5, vy / (sp.rz * 1.5) * 0.5 + 0.5);
    }
    const idxArr: number[] = [];
    for (let i = 0; i < N; i++) idxArr.push(0, i + 1, (i + 1) % N + 1);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vArr,  3));
    geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvArr, 2));
    geo.setIndex(idxArr);
    geo.computeVertexNormals();

    // Canvas texture animée
    const can = document.createElement('canvas');
    can.width = can.height = SZ;
    const ctx = can.getContext('2d')!;
    const tex = new THREE.CanvasTexture(can);

    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      opacity: 0.82,
      metalness: 0.92,   // très réfléchissant — effet miroir d'eau
      roughness: 0.03,   // surface quasi-lisse
      depthWrite: false,
      envMapIntensity: 5.0,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = floor.rotX;
    mesh.position.set(sp.x, floor.getY(sp.x, sp.z) + 0.016, sp.z);
    scene.add(mesh);

    const ph = sp.seed * 1.57;

    ticks.push((t: number) => {
      ctx.clearRect(0, 0, SZ, SZ);
      const cx = SZ / 2, cy = SZ / 2, R = SZ / 2;

      // ── Fond eau sombre — visible au travers comme une vraie flaque ──────
      const bg = ctx.createRadialGradient(cx, cy, SZ * 0.04, cx, cy, R);
      bg.addColorStop(0,    'rgba(10, 55, 120, 0.95)');
      bg.addColorStop(0.45, 'rgba( 8, 45, 105, 0.85)');
      bg.addColorStop(0.80, 'rgba( 5, 32,  90, 0.48)');
      bg.addColorStop(1,    'rgba( 2, 20,  72, 0)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      // ── Caustiques sous-marines (lumière filtrée — pas des ronds cartoon) ──
      for (let i = 0; i < 6; i++) {
        const a1 = t * 0.17 + ph + i * 1.047;
        const a2 = t * 0.12 + ph + i * 0.873;
        const px = cx + Math.sin(a1) * R * 0.38;
        const py = cy + Math.cos(a2) * R * 0.32;
        const pr = R * (0.10 + 0.05 * Math.sin(t * 0.35 + i * 0.9));
        const pa = 0.28 + 0.14 * Math.sin(t * 0.28 + i * 0.65);
        const cg = ctx.createRadialGradient(px, py, 0, px, py, pr);
        cg.addColorStop(0,   `rgba(190, 238, 255, ${pa})`);
        cg.addColorStop(0.5, `rgba(110, 195, 240, ${pa * 0.45})`);
        cg.addColorStop(1,   'rgba(60, 155, 220, 0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Reflet spéculaire principal (lumière du soleil sous-marin) ────────
      const hx = cx - R * 0.22, hy = cy - R * 0.26;
      const hl = ctx.createRadialGradient(hx, hy, 0, hx, hy, R * 0.30);
      hl.addColorStop(0,   'rgba(255, 255, 255, 0.62)');
      hl.addColorStop(0.25,'rgba(240, 252, 255, 0.32)');
      hl.addColorStop(0.7, 'rgba(210, 242, 255, 0.10)');
      hl.addColorStop(1,   'rgba(190, 232, 255, 0)');
      ctx.fillStyle = hl;
      ctx.beginPath();
      ctx.arc(hx, hy, R * 0.30, 0, Math.PI * 2);
      ctx.fill();

      // ── Petit reflet secondaire (scintillement) ────────────────────────
      const sx = cx + R * 0.18 + Math.sin(t * 1.1 + ph) * R * 0.06;
      const sy = cy + R * 0.22 + Math.cos(t * 0.9 + ph) * R * 0.05;
      ctx.beginPath();
      ctx.arc(sx, sy, R * 0.06, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
      ctx.fill();

      tex.needsUpdate = true;
    });
  }

  let frame = 0;
  return (t: number) => {
    if (frame++ % 2 !== 0) return;
    for (const tick of ticks) tick(t);
  };
}

// ── Texture éponge procédurale (SpongeBob) ────────────────────────────────
function createSpongeMaterial(): THREE.MeshStandardMaterial {
  const SIZE = 512;
  const rng  = (seed: number) => { let s = seed; return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; }; };
  const rand = rng(42);

  // Génère N pores aléatoires (position, rayon, aplatissement, angle)
  const PORES = 140;
  const pores: { x: number; y: number; r: number; ry: number; a: number }[] = [];
  for (let i = 0; i < PORES; i++) {
    pores.push({
      x:  rand() * SIZE,
      y:  rand() * SIZE,
      r:  5  + rand() * 18,
      ry: 0.55 + rand() * 0.7,
      a:  rand() * Math.PI,
    });
  }

  // ── Canvas diffuse : jaune SpongeBob + pores sombres ────────────────────
  const dc  = document.createElement('canvas');
  dc.width  = dc.height = SIZE;
  const dctx = dc.getContext('2d')!;

  // Fond jaune avec légère variation sinusoïdale de chaleur
  const imgD = dctx.createImageData(SIZE, SIZE);
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const n = 0.5
        + 0.12 * Math.sin(px * 0.045 + py * 0.03 + 1.2)
        + 0.07 * Math.cos(px * 0.08  - py * 0.06 + 2.5);
      const idx = (py * SIZE + px) * 4;
      imgD.data[idx]     = Math.round(248 + n * 7);   // R
      imgD.data[idx + 1] = Math.round(208 + n * 15);  // G
      imgD.data[idx + 2] = Math.round(30  + n * 20);  // B
      imgD.data[idx + 3] = 255;
    }
  }
  dctx.putImageData(imgD, 0, 0);

  // Dessin des pores (cavités)
  for (const p of pores) {
    dctx.save();
    dctx.translate(p.x, p.y);
    dctx.rotate(p.a);
    dctx.scale(1, p.ry);
    dctx.translate(-p.x, -p.y);
    const g = dctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    g.addColorStop(0,    'rgba(38, 16, 2, 0.98)');
    g.addColorStop(0.45, 'rgba(70, 30, 5, 0.85)');
    g.addColorStop(0.75, 'rgba(130, 75, 10, 0.55)');
    g.addColorStop(0.90, 'rgba(200, 150, 30, 0.22)');
    g.addColorStop(1,    'rgba(255, 220, 50, 0)');
    dctx.fillStyle = g;
    dctx.beginPath();
    dctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    dctx.fill();
    dctx.restore();
  }
  const diffTex = new THREE.CanvasTexture(dc);
  diffTex.wrapS = diffTex.wrapT = THREE.RepeatWrapping;
  diffTex.colorSpace = THREE.SRGBColorSpace;

  // ── Canvas bump : noir dans les pores, blanc sur les rebords ────────────
  const bc  = document.createElement('canvas');
  bc.width  = bc.height = SIZE;
  const bctx = bc.getContext('2d')!;

  // Base grise neutre + légère rugosité de surface
  const imgB = bctx.createImageData(SIZE, SIZE);
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const n = 128 + 18 * Math.sin(px * 0.09 + py * 0.07)
                    + 10 * Math.cos(px * 0.18 - py * 0.13 + 1.4);
      const idx = (py * SIZE + px) * 4;
      imgB.data[idx] = imgB.data[idx + 1] = imgB.data[idx + 2] = Math.round(n);
      imgB.data[idx + 3] = 255;
    }
  }
  bctx.putImageData(imgB, 0, 0);

  // Pores : rebord blanc (surélevé) + centre noir (creux)
  for (const p of pores) {
    bctx.save();
    bctx.translate(p.x, p.y);
    bctx.rotate(p.a);
    bctx.scale(1, p.ry);
    bctx.translate(-p.x, -p.y);
    // Rebord surélevé
    const rim = bctx.createRadialGradient(p.x, p.y, p.r * 0.6, p.x, p.y, p.r * 1.3);
    rim.addColorStop(0,   'rgba(255,255,255,0)');
    rim.addColorStop(0.5, 'rgba(255,255,255,0.65)');
    rim.addColorStop(1,   'rgba(255,255,255,0)');
    bctx.fillStyle = rim;
    bctx.beginPath();
    bctx.arc(p.x, p.y, p.r * 1.3, 0, Math.PI * 2);
    bctx.fill();
    // Cavité (noir)
    const hole = bctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 0.85);
    hole.addColorStop(0,   'rgba(0,0,0,0.98)');
    hole.addColorStop(0.6, 'rgba(0,0,0,0.80)');
    hole.addColorStop(1,   'rgba(0,0,0,0)');
    bctx.fillStyle = hole;
    bctx.beginPath();
    bctx.arc(p.x, p.y, p.r * 0.85, 0, Math.PI * 2);
    bctx.fill();
    bctx.restore();
  }
  const bumpTex = new THREE.CanvasTexture(bc);
  bumpTex.wrapS = bumpTex.wrapT = THREE.RepeatWrapping;

  return new THREE.MeshStandardMaterial({
    map:      diffTex,
    bumpMap:  bumpTex,
    bumpScale: 4.0,
    color:    new THREE.Color(0xffe040),
    roughness: 0.78,
    metalness: 0.0,
    envMapIntensity: 0.9,
    side: THREE.DoubleSide,
  });
}

// ── Singleshots corail lumineux (formes triangulaires près des flippers) ──
function createCoralSingleshots(root: THREE.Object3D): (t: number) => void {
  const KEYWORDS      = ['singleshot', 'sling', 'guide', 'inlane', 'outlane', 'kicker'];
  const CORAL_NAMES   = new Set([
    'col_ref_plunger_003', 'col_ref_plunger_004', 'col_ref_plunger_006', 'col_ref_plunger_007', 'col_ref_plunger_009',
    'col_ref_flipper_014', 'col_ref_flipper_030',
  ]);
  const SPONGE_NAMES  = new Set<string>();

  const coralMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xff5522),
    roughness: 0.18,
    metalness: 0.30,
    emissive: new THREE.Color(0xff2200),
    emissiveIntensity: 0.5,
    envMapIntensity: 1.6,
  });

  const spongeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xffe135),
    roughness: 0.20,
    metalness: 0.25,
    emissive: new THREE.Color(0xffaa00),
    emissiveIntensity: 0.45,
    envMapIntensity: 1.6,
  });

root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const n = obj.name.toLowerCase();
    if (SPONGE_NAMES.has(obj.name)) {
      obj.material = spongeMat;
    } else if (CORAL_NAMES.has(obj.name) || KEYWORDS.some((k) => n.includes(k))) {
      obj.material = coralMat;
    }
  });

  return (t: number) => {
    const pulse = 0.28 + Math.sin(t * 1.6) * 0.22 + Math.sin(t * 2.9 + 1.2) * 0.08;
    coralMat.emissiveIntensity = pulse;
    spongeMat.emissiveIntensity = 0.30 + Math.sin(t * 1.4 + 0.8) * 0.20 + Math.sin(t * 2.5) * 0.07;
  };
}

// ── Animation rides de sable (courant sous-marin) ─────────────────────────
function createSandRipples(
  scene: THREE.Scene,
  floor: FloorSampler,
  sandNorm: THREE.Texture,
): (t: number) => void {
  const SZ  = 512;
  const can = document.createElement('canvas');
  can.width = can.height = SZ;
  const ctx = can.getContext('2d')!;
  const tex = new THREE.CanvasTexture(can);

  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(TABLE.width - 0.5, TABLE.depth - 0.5), mat);
  plane.rotation.x = floor.rotX;
  plane.position.set(0, floor.getY(0, 0) + 0.02, 0);
  scene.add(plane);

  let frame = 0;
  return (t: number) => {
    // Dérive de la normal map — courant sous-marin visible
    sandNorm.offset.x = Math.sin(t * 0.06) * 0.08;
    sandNorm.offset.y = (t * 0.012) % 1;

    if (frame++ % 2 !== 0) return;
    ctx.clearRect(0, 0, SZ, SZ);

    const BANDS = 28;
    for (let b = 0; b < BANDS; b++) {
      const phase  = ((b / BANDS) + t * 0.04) % 1;
      const yBase  = phase * SZ;
      const freq   = 2.0 + (b % 5) * 0.9;
      const amp    = 10  + (b % 6) * 4;
      const spd    = 0.12 + (b % 4) * 0.06;
      const alpha  = 0.16 + (b % 4) * 0.07;
      const width  = 1.0  + (b % 3) * 0.6;

      ctx.beginPath();
      for (let x = 0; x <= SZ; x += 2) {
        const y = yBase + Math.sin((x / SZ) * Math.PI * 2 * freq + t * spd + b * 1.3) * amp
                        + Math.sin((x / SZ) * Math.PI * 2 * freq * 0.53 + t * spd * 0.7) * amp * 0.45;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(130, 100, 55, ${alpha})`;
      ctx.lineWidth = width;
      ctx.stroke();
    }
    tex.needsUpdate = true;
  };
}

// ── Détail sable multi-couche (grain fin + variation couleur) ─────────────
function createSandDetail(scene: THREE.Scene, floor: FloorSampler, sandDiff: THREE.Texture): void {
  const W  = TABLE.width  - 0.6;
  const D  = TABLE.depth  - 0.6;
  const Y0 = floor.getY(0, 0);
  const RX = floor.rotX;

  // ── Couche 1 : grain fin (même texture, répétition ×4) ───────────────────
  const fineTex = sandDiff.clone();
  fineTex.wrapS = fineTex.wrapT = THREE.RepeatWrapping;
  fineTex.repeat.set(20, 33);
  fineTex.needsUpdate = true;

  const fineMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    new THREE.MeshBasicMaterial({
      map: fineTex,
      transparent: true,
      opacity: 0.40,
      blending: THREE.MultiplyBlending,
      premultipliedAlpha: true,
      depthWrite: false,
    }),
  );
  fineMesh.rotation.x = RX;
  fineMesh.position.set(0, Y0 + 0.008, 0);
  scene.add(fineMesh);

  // ── Couche 2 : variation naturelle par bruit sinusoïdal (pas de patches) ──
  const SZ = 256;
  const can = document.createElement('canvas');
  can.width = can.height = SZ;
  const ctx = can.getContext('2d')!;
  const img = ctx.createImageData(SZ, SZ);

  for (let py = 0; py < SZ; py++) {
    for (let px = 0; px < SZ; px++) {
      // Espace table (coordonnées normalisées → monde)
      const nx = (px / SZ) * 4.5;
      const nz = (py / SZ) * 7.0;

      // 4 octaves, résultat dans ~[0.05, 0.95]
      const n = 0.50
        + 0.22 * Math.sin(nx * 0.68 + nz * 0.42 + 1.10)
        + 0.14 * Math.sin(nx * 1.55 + nz * 1.08 + 2.45)
        + 0.08 * Math.cos(nx * 2.90 + nz * 0.75 + 0.65)
        + 0.05 * Math.sin(nx * 0.32 + nz * 2.10 + 3.20);

      const v = Math.max(0, Math.min(1, n));

      // Tons sable chaud doré : R fort, G moyen, B bas
      const idx = (py * SZ + px) * 4;
      img.data[idx]     = Math.round(242 + v * 13); // R: 242-255 blanc crème
      img.data[idx + 1] = Math.round(232 + v * 14); // G: 232-246 très clair
      img.data[idx + 2] = Math.round(200 + v * 20); // B: 200-220 légèrement chaud
      img.data[idx + 3] = 210;
    }
  }
  ctx.putImageData(img, 0, 0);

  const varMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(can),
      transparent: true,
      opacity: 0.42,
      blending: THREE.MultiplyBlending,
      premultipliedAlpha: true,
      depthWrite: false,
    }),
  );
  varMesh.rotation.x = RX;
  varMesh.position.set(0, Y0 + 0.012, 0);
  scene.add(varMesh);
}

// ─────────────────────────────────────────────────────────────────────────────
// createScene
// ─────────────────────────────────────────────────────────────────────────────
export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a7ab8);
  scene.fog = new THREE.FogExp2(0x1a6a9a, 0.005);

  const camera = new THREE.PerspectiveCamera(55, RENDER_WIDTH / RENDER_HEIGHT, 0.1, 1000);
  camera.position.set(0, 32, 36);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(RENDER_WIDTH, RENDER_HEIGHT, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment()).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enableRotate  = true;
  controls.enablePan     = true;
  controls.enableZoom    = true;
  controls.minDistance   = 4;
  controls.maxDistance   = 60;
  controls.maxPolarAngle = Math.PI * 0.46; // bloque avant de passer sous la table
  controls.target.set(0, 0, 0);
  controls.update();

  // ── Ambient Bikini Bottom : océan cyan vif en haut, sable doré en rebond
  scene.add(new THREE.HemisphereLight(0x00ccff, 0xffdd66, 2.8));
  // Ambient jaune Bob l'éponge — teinte toutes les surfaces du jaune caractéristique
  scene.add(new THREE.AmbientLight(0xffee22, 2.0));

  // ── Soleil principal : rayon tropical filtré par l'eau, jaune vif saturé
  const keyLight = new THREE.DirectionalLight(0xffdd00, 13.0);
  keyLight.position.set(6, 28, -8);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width  = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near   = 1;
  keyLight.shadow.camera.far    = 90;
  keyLight.shadow.camera.left   = -13;
  keyLight.shadow.camera.right  =  13;
  keyLight.shadow.camera.top    =  20;
  keyLight.shadow.camera.bottom = -20;
  keyLight.shadow.bias          = -0.0003;
  keyLight.shadow.normalBias    =  0.02;
  keyLight.shadow.radius        =  4;
  scene.add(keyLight);

  // ── Second soleil : corail chaud Patrick Star depuis l'autre côté
  const sunB = new THREE.DirectionalLight(0xff8833, 5.5);
  sunB.position.set(-8, 18, 6);
  scene.add(sunB);

  // ── Fill : bleu océan Bikini Bottom profond et vif
  const fillLight = new THREE.DirectionalLight(0x0099ff, 4.0);
  fillLight.position.set(-10, 8, 16);
  scene.add(fillLight);

  // ── Rim : cyan électrique pour faire ressortir les silhouettes
  const rimLight = new THREE.DirectionalLight(0x00ffee, 3.2);
  rimLight.position.set(-2, 14, -20);
  scene.add(rimLight);

  // ── Lumière rasante basse : révèle le grain du sable doré
  const graze = new THREE.DirectionalLight(0xffcc00, 4.5);
  graze.position.set(18, 0.5, 3);
  scene.add(graze);

  // ── Corail : lumière rose/corail basse pour ambiance récif
  const coralLight = new THREE.DirectionalLight(0xff4488, 2.5);
  coralLight.position.set(0, 2, 20);
  scene.add(coralLight);

  // ── Texture sable Ground054 ────────────────────────────────────────
  const sandTexLoader = new THREE.TextureLoader();
  const g054base = '/Ground054_2K-JPG/Ground054_2K-JPG_';

  const sandDiff = sandTexLoader.load(`${g054base}Color.jpg`);
  sandDiff.wrapS = sandDiff.wrapT = THREE.RepeatWrapping;
  sandDiff.repeat.set(5, 9);
  sandDiff.colorSpace = THREE.SRGBColorSpace;

  const sandRough = sandTexLoader.load(`${g054base}Roughness.jpg`);
  sandRough.wrapS = sandRough.wrapT = THREE.RepeatWrapping;
  sandRough.repeat.set(5, 9);

  const sandAO = sandTexLoader.load(`${g054base}AmbientOcclusion.jpg`);
  sandAO.wrapS = sandAO.wrapT = THREE.RepeatWrapping;
  sandAO.repeat.set(5, 9);

  const sandBump = sandTexLoader.load(`${g054base}Displacement.jpg`);
  sandBump.wrapS = sandBump.wrapT = THREE.RepeatWrapping;
  sandBump.repeat.set(5, 9);

  const sandNorm = sandTexLoader.load(`${g054base}NormalGL.jpg`);
  sandNorm.wrapS = sandNorm.wrapT = THREE.RepeatWrapping;
  sandNorm.repeat.set(5, 9);

  const sandMat = new THREE.MeshStandardMaterial({
    map:           sandDiff,
    normalMap:     sandNorm,
    normalScale:   new THREE.Vector2(12.0, 12.0),
    roughnessMap:  sandRough,
    aoMap:         sandAO,
    aoMapIntensity: 1.8,
    bumpMap:       sandBump,
    bumpScale:     10.0,
    roughness:     0.94,
    metalness:     0.0,
    side:          THREE.DoubleSide,
  });

  // ── Texture mur (rough block wall) ────────────────────────────────
  const wallTexLoader = new THREE.TextureLoader();

  const wallDiff = wallTexLoader.load('/rough_block_wall_2k/textures/rough_block_wall_diff_2k.jpg');
  wallDiff.wrapS = wallDiff.wrapT = THREE.RepeatWrapping;
  wallDiff.repeat.set(4, 2);
  wallDiff.colorSpace = THREE.SRGBColorSpace;

  const wallArm = wallTexLoader.load('/rough_block_wall_2k/textures/rough_block_wall_arm_2k.jpg');
  wallArm.wrapS = wallArm.wrapT = THREE.RepeatWrapping;
  wallArm.repeat.set(4, 2);

  const wallNorm = wallTexLoader.load('/rough_block_wall_2k/textures/rough_block_wall_nor_gl_2k.jpg');
  wallNorm.wrapS = wallNorm.wrapT = THREE.RepeatWrapping;
  wallNorm.repeat.set(4, 2);

  const wallMat = new THREE.MeshStandardMaterial({
    map: wallDiff,
    roughnessMap: wallArm,
    aoMap: wallArm,
    normalMap: wallNorm,
    aoMapIntensity: 1.5,
    roughness: 0.85,
    metalness: 0.02,
    color: new THREE.Color(0x1a4d7a), // bleu océan profond — clairement distinct du sable
  });

  // ── Texture herbe sous-marine (grass) ─────────────────────────────
  const grassTexLoader = new THREE.TextureLoader();
  const grassBase = '/Grass002_2K-JPG/Grass002_2K-JPG_';

  const grassDiff = grassTexLoader.load(`${grassBase}Color.jpg`);
  grassDiff.wrapS = grassDiff.wrapT = THREE.RepeatWrapping;
  grassDiff.colorSpace = THREE.SRGBColorSpace;

  const grassRough = grassTexLoader.load(`${grassBase}Roughness.jpg`);
  grassRough.wrapS = grassRough.wrapT = THREE.RepeatWrapping;

  const grassNorm = grassTexLoader.load(`${grassBase}NormalGL.jpg`);
  grassNorm.wrapS = grassNorm.wrapT = THREE.RepeatWrapping;

  const grassAO = grassTexLoader.load(`${grassBase}AmbientOcclusion.jpg`);
  grassAO.wrapS = grassAO.wrapT = THREE.RepeatWrapping;

  const grassBump = grassTexLoader.load(`${grassBase}Displacement.jpg`);
  grassBump.wrapS = grassBump.wrapT = THREE.RepeatWrapping;

  const grassMat = new THREE.MeshStandardMaterial({
    map: grassDiff,
    color: new THREE.Color(0x2d5a1e), // vert foncé
    roughnessMap: grassRough,
    normalMap: grassNorm,
    normalScale: new THREE.Vector2(6.0, 6.0),
    aoMap: grassAO,
    aoMapIntensity: 1.6,
    bumpMap: grassBump,
    bumpScale: 5.5,
    roughness: 0.88,
    metalness: 0.0,
  });

  const GRASS_NAMES  = new Set(['col_wall_center']);
  const CLOUDS_NAMES = new Set(['col_ref_floor_main', 'col_wall_left_fill', 'col_wall_main_outer']);

  const cloudsTex = new THREE.TextureLoader().load('/Floral Background _Aquarium _ Terrarium Background.jpg');
  cloudsTex.wrapS = cloudsTex.wrapT = THREE.RepeatWrapping;
  cloudsTex.colorSpace = THREE.SRGBColorSpace;

  const cloudsMat = new THREE.MeshStandardMaterial({
    map: cloudsTex,
    color: new THREE.Color(0x555555),
    roughness: 0.75,
    metalness: 0.0,
  });

  const logoTex = new THREE.TextureLoader().load('/bobfunny.png');
  logoTex.colorSpace = THREE.SRGBColorSpace;
  const logoMat = new THREE.MeshStandardMaterial({
    map:              logoTex,
    color:            new THREE.Color(0x666666),
    transparent:      true,
    alphaTest:        0.05,
    roughness:        0.60,
    metalness:        0.10,
    emissiveIntensity: 0.0,
    depthWrite:       false,
    side:             THREE.DoubleSide,
  });
  const spongeMat    = createSpongeMaterial();
  const SPONGE_MESH_NAMES = new Set(['col_ramp_main']);
  const CONCRETE_MESH_NAMES = new Set(['col_wall_frame_black', 'col_wall_panel', 'col_wall_shooter']);

  const concreteTex = new THREE.TextureLoader().load('/photo-concrete-texture-pattern.jpg');
  concreteTex.wrapS = concreteTex.wrapT = THREE.RepeatWrapping;
  concreteTex.colorSpace = THREE.SRGBColorSpace;

  const concreteMat = new THREE.MeshStandardMaterial({
    map: concreteTex,
    color: new THREE.Color(0x777777),
    roughness: 0.85,
    metalness: 0.0,
  });

  const concreteFrameMat = new THREE.MeshStandardMaterial({
    map: concreteTex,
    color: new THREE.Color(0x777777),
    roughness: 0.85,
    metalness: 0.0,
  });

  let meshReadyCb:  ((meshes: PinballMeshes) => void) | null = null;
  let debugBallCb:  ((pos: { x: number; y: number; z: number }) => void) | null = null;
  let debugGroupRef: { visible: boolean } | null = null;
  let debugEnabled  = false;

  const gltfLoader = new GLTFLoader();
  gltfLoader.load('/models/FlipperBase.glb', (gltf) => {
    const root = gltf.scene;

    const PHYSICS_REF_NAMES = ['col_floor_playfield_blue', 'flipper_left', 'flipper_right'];
    const preScaleRef = new THREE.Box3();
    for (const n of PHYSICS_REF_NAMES) {
      const obj = root.getObjectByName(n);
      if (obj) preScaleRef.expandByObject(obj);
    }
    if (preScaleRef.isEmpty()) preScaleRef.setFromObject(root);

    const rawSize = preScaleRef.getSize(new THREE.Vector3());
    const sx = TABLE.width  / rawSize.x;
    const sz = TABLE.depth  / rawSize.z;
    const sy = (sx + sz) / 2;
    root.scale.set(sx, sy, sz);
    root.updateWorldMatrix(false, true);

    const postScaleRef = new THREE.Box3();
    for (const n of PHYSICS_REF_NAMES) {
      const obj = root.getObjectByName(n);
      if (obj) postScaleRef.expandByObject(obj);
    }
    if (postScaleRef.isEmpty()) postScaleRef.setFromObject(root);
    const physicsCenter = postScaleRef.getCenter(new THREE.Vector3());

    root.position.set(-physicsCenter.x, -postScaleRef.min.y, -physicsCenter.z);

    const base = root.getObjectByName('col_floor_base');
    if (base) base.visible = false;

    scene.add(root);
    root.updateWorldMatrix(true, true);

    // Sol sablé — projection planaire en coordonnées monde pour des UVs cohérentes.
    const playfield = root.getObjectByName('col_floor_playfield_blue');
    if (playfield instanceof THREE.Mesh) {
      const posAttr = playfield.geometry.attributes['position'] as THREE.BufferAttribute;
      const count   = posAttr.count;
      const uvArr   = new Float32Array(count * 2);
      const wm      = playfield.matrixWorld;
      const v       = new THREE.Vector3();
      for (let i = 0; i < count; i++) {
        v.set(posAttr.getX(i) ?? 0, posAttr.getY(i) ?? 0, posAttr.getZ(i) ?? 0);
        v.applyMatrix4(wm);
        uvArr[i * 2]     = (v.x / TABLE.width  + 0.5) * 3;
        uvArr[i * 2 + 1] = (v.z / TABLE.depth  + 0.5) * 5;
      }
      const newUV = new THREE.BufferAttribute(uvArr, 2);
      playfield.geometry.setAttribute('uv',  newUV);
      playfield.geometry.setAttribute('uv2', newUV.clone());
      playfield.material = sandMat;
    }


    // ── Matériau nacré Bikini Bottom — toboggan, bumpers et obstacles ─────────
    const pearlMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x66ddff),
      roughness: 0.08,
      metalness: 0.55,
      emissive: new THREE.Color(0x0055cc),
      emissiveIntensity: 0.35,
      envMapIntensity: 1.8,
    });

    // ── Flippers jaune doré SpongeBob ─────────────────────────────────────────
    const flipperMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x0f0a01),
      roughness: 0.55,
      metalness: 0.10,
    });

    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (obj.name === 'col_floor_playfield_blue') return;

      if (SPONGE_MESH_NAMES.has(obj.name)) {
        obj.material = spongeMat;
        return;
      }

      if (obj.name === 'col_wall_frame_black') {
        obj.material = concreteFrameMat;
        return;
      }

      if (obj.name === 'col_ref_plunger_star') {
        obj.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(0xff66cc),
          emissive: new THREE.Color(0xff44bb),
          emissiveIntensity: 0.35,
          roughness: 0.3,
          metalness: 0.4,
        });
        return;
      }

      if (obj.name === 'col_floor_detail') {
        obj.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(0xcc4499),
          emissive: new THREE.Color(0x992277),
          emissiveIntensity: 0.25,
          roughness: 0.3,
          metalness: 0.4,
        });
        return;
      }

      if (CONCRETE_MESH_NAMES.has(obj.name)) {
        obj.material = concreteMat;
        return;
      }

      if (GRASS_NAMES.has(obj.name)) {
        obj.material = grassMat;
        return;
      }

      if (CLOUDS_NAMES.has(obj.name)) {
        obj.material = cloudsMat;
        return;
      }


      if (obj.name.toLowerCase().includes('wall') || obj.name.toLowerCase().includes('frame')) {
        obj.material = wallMat;
        return;
      }

      if (obj.name === 'flipper_left' || obj.name === 'flipper_right') {
        obj.material = flipperMat;
        return;
      }

      obj.material = pearlMat;
    });

    // Force le matériau sur tous les meshes enfants des flippers (ils peuvent être des Groups)
    for (const name of ['flipper_left', 'flipper_right']) {
      const fObj = root.getObjectByName(name);
      if (fObj) fObj.traverse((child) => {
        if (child instanceof THREE.Mesh) child.material = flipperMat;
      });
    }

    // ── Reprojection UV planaire (espace monde) pour grass + sponge ────────
    root.updateWorldMatrix(true, true);
    const GRASS_FREQ = 0.55; // 1 carreau ≈ 1.8 unités monde
    for (const meshName of [...GRASS_NAMES, ...SPONGE_MESH_NAMES]) {
      const gobj = root.getObjectByName(meshName);
      if (!(gobj instanceof THREE.Mesh)) continue;
      const posAttr = gobj.geometry.attributes['position'] as THREE.BufferAttribute;
      const cnt  = posAttr.count;
      const uvA  = new Float32Array(cnt * 2);
      const wm   = gobj.matrixWorld;
      const vv   = new THREE.Vector3();
      const bb   = new THREE.Box3().setFromObject(gobj);
      const sz   = bb.getSize(new THREE.Vector3());
      const isFloor = sz.y < sz.x * 0.4 && sz.y < sz.z * 0.4;
      for (let i = 0; i < cnt; i++) {
        vv.set(posAttr.getX(i) ?? 0, posAttr.getY(i) ?? 0, posAttr.getZ(i) ?? 0);
        vv.applyMatrix4(wm);
        if (isFloor) {
          uvA[i * 2]     = vv.x * GRASS_FREQ;
          uvA[i * 2 + 1] = vv.z * GRASS_FREQ;
        } else {
          const u = sz.x >= sz.z ? vv.x : vv.z;
          uvA[i * 2]     = u    * GRASS_FREQ;
          uvA[i * 2 + 1] = vv.y * GRASS_FREQ;
        }
      }
      const newUV = new THREE.BufferAttribute(uvA, 2);
      gobj.geometry.setAttribute('uv',  newUV);
      gobj.geometry.setAttribute('uv2', newUV.clone());
    }

    // ── Reprojection UV cloudssponge : image entière étirée sur le mesh ────
    for (const meshName of [...CLOUDS_NAMES]) {
      const gobj = root.getObjectByName(meshName);
      if (!(gobj instanceof THREE.Mesh)) continue;
      const posAttr = gobj.geometry.attributes['position'] as THREE.BufferAttribute;
      const cnt = posAttr.count;
      const uvA = new Float32Array(cnt * 2);
      const wm  = gobj.matrixWorld;
      const vv  = new THREE.Vector3();
      const bb  = new THREE.Box3().setFromObject(gobj);
      const sz  = bb.getSize(new THREE.Vector3());
      const isFloor = sz.y < sz.x * 0.4 && sz.y < sz.z * 0.4;
      for (let i = 0; i < cnt; i++) {
        vv.set(posAttr.getX(i) ?? 0, posAttr.getY(i) ?? 0, posAttr.getZ(i) ?? 0);
        vv.applyMatrix4(wm);
        const CLOUDS_SCALE = 3.0;
        if (isFloor) {
          uvA[i * 2]     = ((vv.x - bb.min.x) / sz.x) * CLOUDS_SCALE;
          uvA[i * 2 + 1] = ((vv.z - bb.min.z) / sz.z) * CLOUDS_SCALE;
        } else {
          const u = sz.x >= sz.z ? vv.x : vv.z;
          const uMin = sz.x >= sz.z ? bb.min.x : bb.min.z;
          const uSz  = sz.x >= sz.z ? sz.x : sz.z;
          uvA[i * 2]     = ((u    - uMin)    / uSz) * CLOUDS_SCALE;
          uvA[i * 2 + 1] = ((vv.y - bb.min.y) / sz.y) * CLOUDS_SCALE;
        }
      }
      const newUV = new THREE.BufferAttribute(uvA, 2);
      gobj.geometry.setAttribute('uv',  newUV);
      gobj.geometry.setAttribute('uv2', newUV.clone());
    }

    // ── Reprojection UV béton (col_wall_panel, col_wall_shooter) ─────
    const CONCRETE_FREQ = 0.14;
    for (const meshName of ['col_wall_panel', 'col_wall_shooter']) {
      const gobj = root.getObjectByName(meshName);
      if (!(gobj instanceof THREE.Mesh)) continue;
      const posAttr = gobj.geometry.attributes['position'] as THREE.BufferAttribute;
      const cnt = posAttr.count;
      const uvA = new Float32Array(cnt * 2);
      const wm  = gobj.matrixWorld;
      const vv  = new THREE.Vector3();
      const bb  = new THREE.Box3().setFromObject(gobj);
      const sz  = bb.getSize(new THREE.Vector3());
      const isFloor = sz.y < sz.x * 0.4 && sz.y < sz.z * 0.4;
      for (let i = 0; i < cnt; i++) {
        vv.set(posAttr.getX(i) ?? 0, posAttr.getY(i) ?? 0, posAttr.getZ(i) ?? 0);
        vv.applyMatrix4(wm);
        if (isFloor) {
          uvA[i * 2]     = vv.x * CONCRETE_FREQ;
          uvA[i * 2 + 1] = vv.z * CONCRETE_FREQ;
        } else {
          const u = sz.x >= sz.z ? vv.x : vv.z;
          uvA[i * 2]     = u    * CONCRETE_FREQ;
          uvA[i * 2 + 1] = vv.y * CONCRETE_FREQ;
        }
      }
      const newUV = new THREE.BufferAttribute(uvA, 2);
      gobj.geometry.setAttribute('uv',  newUV);
      gobj.geometry.setAttribute('uv2', newUV.clone());
    }

    // ── Reprojection UV béton (col_wall_frame_black) ─────────────────
    // Fréquence très basse = grandes tuiles, cohérentes sur une géométrie en cadre.
    {
      const FRAME_FREQ = 0.28;
      const gobj = root.getObjectByName('col_wall_frame_black');
      if (gobj instanceof THREE.Mesh) {
        const posAttr = gobj.geometry.attributes['position'] as THREE.BufferAttribute;
        const cnt = posAttr.count;
        const uvA = new Float32Array(cnt * 2);
        const wm  = gobj.matrixWorld;
        const vv  = new THREE.Vector3();
        for (let i = 0; i < cnt; i++) {
          vv.set(posAttr.getX(i) ?? 0, posAttr.getY(i) ?? 0, posAttr.getZ(i) ?? 0);
          vv.applyMatrix4(wm);
          uvA[i * 2]     = vv.x * FRAME_FREQ;
          uvA[i * 2 + 1] = vv.z * FRAME_FREQ;
        }
        const newUV = new THREE.BufferAttribute(uvA, 2);
        gobj.geometry.setAttribute('uv',  newUV);
        gobj.geometry.setAttribute('uv2', newUV.clone());
      }
    }

    // Log des noms de meshes (pour identifier les singleshots)
    const meshNames: string[] = [];
    root.traverse((o) => { if (o instanceof THREE.Mesh) meshNames.push(o.name); });
    console.log('[GLB meshes]', meshNames);

    // Singleshots corail (après la passe principale pour surcharger pearlMat)
    tickSingleshots = createCoralSingleshots(root);

    // Ombres sur tous les meshes du modèle
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow    = true;
        obj.receiveShadow = true;
      }
    });

    // Debug physique
    const debug = createPhysicsDebug(root);
    scene.add(debug.group);
    debugBallCb   = debug.updateBall;
    debugGroupRef = debug.group;

    // Flippers
    const flipperLeft  = root.getObjectByName('flipper_left');
    const flipperRight = root.getObjectByName('flipper_right');
    if (flipperLeft && flipperRight && meshReadyCb) {
      meshReadyCb({ flipperLeft, flipperRight });
    }

    // ── Décorations calées sur la surface inclinée du playfield ──────
    {
      const ray  = new THREE.Raycaster();
      const down = new THREE.Vector3(0, -1, 0);

      // Raye contre tout le root (playfield + drain + zone flipper)
      // Prend le 1er hit avec une normale qui pointe vers le haut (face du dessus)
      function rawHit(x: number, z: number): number | null {
        ray.set(new THREE.Vector3(x, 20, z), down);
        const hits = ray.intersectObject(root, true);
        const hit = hits.find(h => (h.face?.normal.y ?? 0) > 0.3) ?? hits[0];
        return hit ? hit.point.y + 0.015 : null;
      }

      // Mesure la pente sur l'axe Z au centre du playfield
      const yNear = rawHit(0,  6) ?? 0.40;
      const yFar  = rawHit(0, -6) ?? 1.70;
      const slope = (yFar - yNear) / (-12); // négatif : Y monte quand Z descend

      // Si le raycast rate, extrapole la pente mesurée
      function sampleFloorY(x: number, z: number): number {
        return rawHit(x, z) ?? (yNear + slope * (z - 6));
      }

      const floor: FloorSampler = {
        getY: sampleFloorY,
        rotX: -Math.PI / 2 + Math.atan(Math.abs(slope)),
      };
      jellyfishBumpers = createJellyfishBumpers(scene, ['b2', 'b3'], floor.getY);
      tickInserts   = createInsertLights(scene, floor);
      tickCaustics  = createCausticOverlay(scene, floor);
      tickPuddles   = createWaterPuddles(scene, floor);
      tickSand      = createSandRipples(scene, floor, sandNorm);
      createSandDetail(scene, floor, sandDiff);

      // ── Maison Squidward — coin haut-droite du flipper ──────────────
      {
        const SQ_X = 3.5, SQ_Z = -6.0;
        const sqLoader = new GLTFLoader();
        sqLoader.load('/models/sponge_bob_hero_pants_squidwards_house.glb', (gltf) => {
          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 1.6 / maxDim;
          model.scale.setScalar(scale);
          const floorY = floor.getY(SQ_X, SQ_Z);
          model.position.set(SQ_X, floorY - box.min.y * scale, SQ_Z);
          model.traverse((obj) => {
            if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
              obj.material = obj.material.clone();
              obj.material.color.multiplyScalar(0.55);
            }
          });
          scene.add(model);
        }, undefined, (err) => {
          console.error('[squidward-house] failed to load', err);
        });
      }

      // ── Maison SpongeBob + méduses b2/b3 au même Y ──────────────────
      {
        const SB_X = -3.18, SB_Z = -6.35;
        const sbLoader = new GLTFLoader();
        sbLoader.load('/models/sponge_bob_hero_pants_sponge_bobs_house.glb', (gltf) => {
          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 1.2 / maxDim;
          model.scale.setScalar(scale);
          const floorY = floor.getY(SB_X, SB_Z);
          const houseY = floorY - box.min.y * scale;
          model.position.set(SB_X, houseY, SB_Z);
          model.traverse((obj) => {
            if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
              obj.material = obj.material.clone();
              obj.material.color.multiplyScalar(0.25);
            }
          });
          scene.add(model);

        }, undefined, (err) => {
          console.error('[spongebob-house] failed to load', err);
        });
      }

      // ── Logo Flipper12 peint sur le sol dans col_wall_center ─────────
      {
        const wallCenter = root.getObjectByName('col_wall_center');
        if (wallCenter instanceof THREE.Mesh) {
          const bb  = new THREE.Box3().setFromObject(wallCenter);
          const ctr = bb.getCenter(new THREE.Vector3());
          const sz  = bb.getSize(new THREE.Vector3());
          const w   = Math.max(sz.x, sz.z) * 0.45;
          const h   = Math.min(sz.x, sz.z) * 0.45;

          const logoPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(w, h),
            logoMat,
          );
          logoPlane.rotation.x = floor.rotX;
          logoPlane.position.set(ctr.x, floor.getY(ctr.x, ctr.z) + 0.03, ctr.z);
          logoPlane.renderOrder = 1;
          scene.add(logoPlane);
        }
      }
    }
  });


  // ── Décorations non liées au sol ──────────────────────────────────
  const tickBubblesLarge   = createBubbleLayer(scene, 30,  0.30, 0.45);
  const tickBubblesSmall   = createBubbleLayer(scene, 70, 0.15, 0.30);
  let tickInserts:     (t: number) => void = () => {};
  let tickCaustics:    (t: number) => void = () => {};
  let tickPuddles:     (t: number) => void = () => {};
  let tickSingleshots: (t: number) => void = () => {};
  let tickSand:        (t: number) => void = () => {};
  let tickSky:         (t: number) => void = () => {};
  let jellyfishBumpers: JellyfishBumpers = { hit: () => {}, tick: () => {} };
  tickSky = createOceanSky(scene);
  const trail              = createBallTrail(scene);

  // ── Camera shake ──────────────────────────────────────────────────
  let shakeElapsed = 0;
  const shakeOffset = new THREE.Vector3();

  function applyShake(dt: number): void {
    if (shakeElapsed <= 0) {
      if (shakeOffset.lengthSq() > 0) {
        controls.target.sub(shakeOffset);
        shakeOffset.set(0, 0, 0);
      }
      return;
    }
    shakeElapsed = Math.max(0, shakeElapsed - dt);
    const factor = (shakeElapsed / 0.28) * 0.12;
    controls.target.sub(shakeOffset);
    shakeOffset.set(
      (Math.random() - 0.5) * factor,
      0,
      (Math.random() - 0.5) * factor,
    );
    controls.target.add(shakeOffset);
  }

  const startTime = performance.now();
  let lastRenderMs = performance.now();

  function render(): void {
    const now = performance.now();
    const dt  = Math.min(0.05, (now - lastRenderMs) / 1000);
    lastRenderMs = now;
    const t = (now - startTime) * 0.001;

    controls.update();
    tickBubblesLarge(t);
    tickBubblesSmall(t);
    tickInserts(t);
    tickCaustics(t);
    tickPuddles(t);
    tickSingleshots(t);
    tickSand(t);
    tickSky(t);
    trail.tick(dt);
    applyShake(dt);
    renderer.render(scene, camera);
  }

  // ── Clic pour identifier les meshes (debug temporaire) ────────────────────
  const pickRaycaster = new THREE.Raycaster();
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = RENDER_WIDTH  / rect.width;
    const scaleY = RENDER_HEIGHT / rect.height;
    const ndcX =  ((e.clientX - rect.left) * scaleX / RENDER_WIDTH)  * 2 - 1;
    const ndcY = -((e.clientY - rect.top)  * scaleY / RENDER_HEIGHT) * 2 + 1;
    pickRaycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const hits = pickRaycaster.intersectObjects(scene.children, true);
    const hit = hits.find((h) => h.object instanceof THREE.Mesh && h.object.name !== '');
    if (hit) {
      console.log(`[CLICK] mesh: "${hit.object.name}"`, hit.object);
    }
  });

  function resize(): void {
    // Résolution fixe — le CSS letterboxe pour s'adapter à l'écran.
  }

  return {
    scene,
    camera,
    renderer,
    render,
    resize,
    onMeshesReady(cb) { meshReadyCb = cb; },
    toggleDebug() {
      debugEnabled = !debugEnabled;
      if (debugGroupRef) debugGroupRef.visible = debugEnabled;
    },
    updateDebugBall(pos) { debugBallCb?.(pos); },
    addBallTrail(pos) { trail.add(pos); },
    triggerShake() { shakeElapsed = 0.28; },
    get jellyfishBumpers() { return jellyfishBumpers; },
  };
}
