import * as THREE from 'three';
import {
  EffectComposer,
  GLTFLoader,
  OutputPass,
  RenderPass,
  UnrealBloomPass,
} from 'three/examples/jsm/Addons.js';
import { TABLE } from '@flipper/contracts';
import { createAllJellyfish } from '../meshes/jellyfish';

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  render: () => void;
  resize: () => void;
  flashBumper: (id: string) => void;
}

// Internal render resolution — canvas always renders at this size, CSS letterboxes to fit screen.
const RENDER_WIDTH = 1080;
const RENDER_HEIGHT = 1920;

/** Canvas-based circle texture that looks like a soap bubble seen from above */
function makeBubbleSprite(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 6, 32, 32, 28);
  g.addColorStop(0, 'rgba(135,206,250,0)');
  g.addColorStop(0.6, 'rgba(135,206,250,0.07)');
  g.addColorStop(0.8, 'rgba(180,230,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.fill();
  // Specular highlight
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.arc(24, 24, 4, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(c);
}

/**
 * Creates a GPU-efficient rising bubble field using THREE.Points.
 * Returns a tick function to call each frame with elapsed time.
 */
function createBubbleLayer(
  scene: THREE.Scene,
  count: number,
  size: number,
  opacity: number,
): (t: number) => void {
  const px = new Float32Array(count);
  const py = new Float32Array(count);
  const pz = new Float32Array(count);
  const vy = new Float32Array(count); // rise speed
  const wf = new Float32Array(count); // wobble frequency
  const wa = new Float32Array(count); // wobble amplitude
  const wp = new Float32Array(count); // wobble phase

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

// ── Waving kelp strands ───────────────────────────────────────────
function createKelpStrands(scene: THREE.Scene): (t: number) => void {
  const tickers: ((t: number) => void)[] = [];

  const kelpMat = new THREE.MeshBasicMaterial({
    color: 0x1a8a2a,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.78,
  });

  const placements = [
    { x: -3.6, z: -5.5, ry: 0.4 },
    { x: -3.9, z: -2.0, ry: -0.2 },
    { x: -3.7, z:  1.5, ry:  0.5 },
    { x: -3.8, z:  4.5, ry:  0.3 },
    { x:  3.6, z: -5.5, ry: -0.4 },
    { x:  3.9, z: -2.0, ry:  0.2 },
    { x:  3.5, z:  1.5, ry: -0.5 },
    { x: -1.2, z: -7.2, ry:  1.4 },
    { x:  1.2, z: -7.2, ry: -1.4 },
  ];

  for (const p of placements) {
    const h = 2.0 + Math.random() * 1.4;
    const geo = new THREE.PlaneGeometry(0.26, h, 1, 6);
    const posAttr = geo.attributes['position'] as THREE.BufferAttribute;
    const n = posAttr.count;
    const origX = new Float32Array(n);
    const normY = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      origX[i] = posAttr.getX(i) ?? 0;
      normY[i] = ((posAttr.getY(i) ?? 0) + h / 2) / h;
    }

    const mesh = new THREE.Mesh(geo, kelpMat);
    mesh.position.set(p.x, h / 2, p.z);
    mesh.rotation.y = p.ry;
    scene.add(mesh);

    const phase = Math.random() * Math.PI * 2;
    const speed = 0.45 + Math.random() * 0.5;

    tickers.push((t: number) => {
      for (let i = 0; i < n; i++) {
        const ny = normY[i] ?? 0;
        const sway = Math.sin(t * speed + phase + ny * 1.3) * 0.2 * ny * ny;
        posAttr.setX(i, (origX[i] ?? 0) + sway);
      }
      posAttr.needsUpdate = true;
    });
  }

  return (t: number) => { for (const tick of tickers) tick(t); };
}

// ── Patrick starfish decorations ──────────────────────────────────
function createStarfish(scene: THREE.Scene): void {
  const shape = new THREE.Shape();
  const outer = 0.38;
  const inner = 0.15;
  const arms = 5;
  for (let i = 0; i < arms * 2; i++) {
    const angle = (i / (arms * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const geo = new THREE.ShapeGeometry(shape);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff7722, side: THREE.DoubleSide });

  const spots = [
    { x: -3.7, z: -6.6, s: 1.0 },
    { x:  3.7, z: -6.6, s: 0.85 },
    { x: -3.6, z:  4.2, s: 0.9 },
    { x:  1.4, z:  7.0, s: 1.1 },
  ];

  for (const sp of spots) {
    const star = new THREE.Mesh(geo, mat);
    star.rotation.x = -Math.PI / 2;
    star.rotation.z = Math.random() * Math.PI * 2;
    star.position.set(sp.x, 0.04, sp.z);
    star.scale.setScalar(sp.s);
    scene.add(star);
  }
}

export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000d1a); // deep ocean
  scene.fog = new THREE.Fog(0x000d1a, 28, 65);

  const camera = new THREE.PerspectiveCamera(50, RENDER_WIDTH / RENDER_HEIGHT, 0.1, 1000);
  camera.up.set(0, 0, -1);
  camera.position.set(0, 22, 6);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(RENDER_WIDTH, RENDER_HEIGHT, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  // Post-processing: bloom gives the ball and bumpers a visible glow
  const composer = new EffectComposer(renderer);
  composer.setSize(RENDER_WIDTH, RENDER_HEIGHT);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(
    new UnrealBloomPass(
      new THREE.Vector2(RENDER_WIDTH, RENDER_HEIGHT),
      0.65, // strength
      0.45, // radius
      0.18, // threshold — low so iridescent ball and bumpers glow
    ),
  );
  composer.addPass(new OutputPass());

  // ── Lighting — underwater palette ──────────────────────────────
  scene.add(new THREE.AmbientLight(0x001a4d, 0.9));

  const mainLight = new THREE.PointLight(0x88ccff, 180);
  mainLight.position.set(0, 15, 5);
  scene.add(mainLight);

  // Caustic light: simulates sunlight filtered through moving water
  const causticLight = new THREE.PointLight(0x00aaff, 55, 28);
  causticLight.position.set(2, 10, -2);
  scene.add(causticLight);

  const fillLight = new THREE.PointLight(0x003366, 25, 18);
  fillLight.position.set(-3, 2, 4);
  scene.add(fillLight);

  // ── 3D models ─────────────────────────────────────────────────
  const gltfLoader = new GLTFLoader();

  gltfLoader.load('/models/BaseFlipper.glb', (gltf) => {
    const base = gltf.scene;
    const box = new THREE.Box3().setFromObject(base);
    const size = box.getSize(new THREE.Vector3());
    const sx = TABLE.width / size.x;
    const sz = TABLE.depth / size.z;
    const sy = (sx + sz) / 2;
    base.scale.set(sx, sy, sz);
    const box2 = new THREE.Box3().setFromObject(base);
    const center = box2.getCenter(new THREE.Vector3());
    base.position.x -= center.x;
    base.position.z -= center.z;
    base.position.y -= box2.min.y;
    scene.add(base);
  });

  gltfLoader.load('/models/Bumper.glb', (gltf) => {
    const template = gltf.scene;
    const tplBox = new THREE.Box3().setFromObject(template);
    const tplSize = tplBox.getSize(new THREE.Vector3());
    const tplRadius = Math.max(tplSize.x, tplSize.z) / 2;
    for (const b of TABLE.bumpers) {
      const instance = template.clone(true);
      instance.scale.setScalar((b.radius / tplRadius) * b.scale);
      instance.position.set(b.x, 0.4, b.z);
      scene.add(instance);
    }
  });

  // ── Bubble fields: large sparse + small dense ─────────────────
  const tickLarge = createBubbleLayer(scene, 45, 0.28, 0.42);
  const tickSmall = createBubbleLayer(scene, 110, 0.14, 0.28);

  // ── SpongeBob decorations ──────────────────────────────────────
  const jellyfish = createAllJellyfish(scene);
  const tickKelp = createKelpStrands(scene);
  createStarfish(scene);

  const startTime = performance.now();

  function render(): void {
    const t = (performance.now() - startTime) * 0.001;

    // Drift the caustic light — colour oscillates between blue and teal,
    // position wanders slowly to mimic light through moving water
    causticLight.color.setHSL(0.57 + Math.sin(t * 0.29) * 0.04, 0.92, 0.54);
    causticLight.position.x = Math.sin(t * 0.61) * 2.8;
    causticLight.position.z = Math.cos(t * 0.38) * 1.8 - 2;
    causticLight.intensity = 52 + Math.sin(t * 1.24) * 14;

    tickLarge(t);
    tickSmall(t);
    jellyfish.update(t);
    tickKelp(t);

    composer.render();
  }

  function resize(): void {
    // no-op: render resolution stays fixed, CSS handles screen-fit letterbox
  }

  return { scene, camera, renderer, render, resize, flashBumper: jellyfish.flashById };
}
