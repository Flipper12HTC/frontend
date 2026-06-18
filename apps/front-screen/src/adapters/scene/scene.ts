import * as THREE from 'three';
import {
  EffectComposer,
  EXRLoader,
  GLTFLoader,
  OrbitControls,
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

// ── Patrick starfish decorations (animated slow spin) ─────────────
function createStarfish(scene: THREE.Scene): (t: number) => void {
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

  const stars: THREE.Mesh[] = [];
  for (const sp of spots) {
    const star = new THREE.Mesh(geo, mat);
    star.rotation.x = -Math.PI / 2;
    star.rotation.z = Math.random() * Math.PI * 2;
    star.position.set(sp.x, 0.04, sp.z);
    star.scale.setScalar(sp.s);
    scene.add(star);
    stars.push(star);
  }

  return (_t: number) => {
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      if (s) s.rotation.z += 0.004 * (i % 2 === 0 ? 1 : -1);
    }
  };
}

// ── Coral formations along the table edges ─────────────────────────
function createCorals(scene: THREE.Scene): void {
  const palette = [0xff6b9d, 0xff8c42, 0xe83151, 0xff44bb, 0xff6600];

  const placements = [
    { x: -4.8, z: -5.5 }, { x: -4.9, z: -3.0 }, { x: -4.7, z:  0.0 },
    { x: -4.8, z:  3.0 }, { x: -4.9, z:  6.0 },
    { x:  4.8, z: -4.5 }, { x:  4.9, z: -1.5 }, { x:  4.7, z:  1.5 },
    { x:  4.8, z:  4.5 }, { x: -1.2, z: -8.0 }, { x:  1.2, z: -8.0 },
    { x:  0.0, z:  8.2 },
  ];

  for (const p of placements) {
    const color = palette[Math.floor(Math.random() * palette.length)]!;
    const mat = new THREE.MeshBasicMaterial({ color });
    const h = 0.9 + Math.random() * 1.1;

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, h, 6), mat);
    trunk.position.set(p.x, h / 2, p.z);
    scene.add(trunk);

    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), mat);
    tip.position.set(p.x, h + 0.06, p.z);
    scene.add(tip);

    const nb = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < nb; i++) {
      const bc = palette[Math.floor(Math.random() * palette.length)]!;
      const bMat = new THREE.MeshBasicMaterial({ color: bc });
      const bh = 0.35 + Math.random() * 0.35;
      const angle = (i / nb) * Math.PI * 2 + Math.random() * 0.4;
      const tx = Math.sin(angle) * 0.5;
      const tz = Math.cos(angle) * 0.5;
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.038, bh, 5), bMat);
      branch.position.set(p.x + Math.sin(angle) * 0.1, h * 0.55 + bh / 2, p.z + Math.cos(angle) * 0.1);
      branch.rotation.x = tz;
      branch.rotation.z = tx;
      scene.add(branch);
      const bTip = new THREE.Mesh(new THREE.SphereGeometry(0.055, 5, 3), bMat);
      bTip.position.set(
        p.x + Math.sin(angle) * (0.1 + Math.abs(tx) * bh * 0.5),
        h * 0.55 + bh + 0.04,
        p.z + Math.cos(angle) * (0.1 + Math.abs(tz) * bh * 0.5),
      );
      scene.add(bTip);
    }
  }
}

// ── SpongeBob character & building sprites ─────────────────────────
function createSBSprites(scene: THREE.Scene): (t: number) => void {
  const loader = new THREE.TextureLoader();

  const defs = [
    { url: '/pineapple-house.png', x: -6.8, y: 2.2, z:  1.5, scale: 4.5 },
    { url: '/squidward-house.png', x: -6.5, y: 1.8, z: -3.5, scale: 3.8 },
    { url: '/krusty-krab.png',     x:  0.5, y: 2.0, z: -9.8, scale: 4.8 },
    { url: '/spongebob.png',       x:  6.2, y: 1.4, z:  3.5, scale: 2.8 },
    { url: '/Patrick.png',         x:  6.0, y: 1.2, z: -4.0, scale: 2.4 },
  ];

  const entries: { sprite: THREE.Sprite; baseY: number; speed: number }[] = [];

  for (const d of defs) {
    const tex = loader.load(d.url);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, alphaTest: 0.05 });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(d.x, d.y, d.z);
    sprite.scale.setScalar(d.scale);
    scene.add(sprite);
    entries.push({ sprite, baseY: d.y, speed: 0.35 + Math.random() * 0.3 });
  }

  return (t: number) => {
    for (const e of entries) {
      e.sprite.position.y = e.baseY + Math.sin(t * e.speed) * 0.12;
    }
  };
}

// ── Rochers sur le sol ────────────────────────────────────────────
function createBoulders(scene: THREE.Scene): void {
  const diff = new THREE.TextureLoader().load('/boulder_01_2k/textures/boulder_01_diff_2k.jpg');

  const mat = new THREE.MeshStandardMaterial({ map: diff, roughness: 0.9, metalness: 0.0 });

  new EXRLoader().load('/boulder_01_2k/textures/boulder_01_nor_gl_2k.exr', (normalTex) => {
    mat.normalMap = normalTex;
    mat.normalScale.set(1.2, 1.2);
    mat.needsUpdate = true;
  });

  // Dispersés sur tout le sol (évite bumpers z:-3/-5 x:±1.5 et flippers z:5.5)
  const spots = [
    { x: -3.5, z: -6.2, s: 0.38 }, { x:  0.8, z: -6.8, s: 0.44 },
    { x:  2.8, z: -5.8, s: 0.30 }, { x: -2.2, z: -4.5, s: 0.26 },
    { x:  3.5, z: -3.8, s: 0.36 }, { x: -0.6, z: -2.0, s: 0.22 },
    { x:  2.2, z: -1.5, s: 0.29 }, { x: -3.0, z:  0.3, s: 0.34 },
    { x:  1.0, z:  0.8, s: 0.25 }, { x: -1.5, z:  2.0, s: 0.32 },
    { x:  3.3, z:  2.8, s: 0.28 }, { x: -2.8, z:  3.8, s: 0.40 },
    { x:  0.3, z:  4.2, s: 0.22 }, { x: -1.0, z:  6.5, s: 0.35 },
    { x:  2.5, z:  6.8, s: 0.30 }, { x: -3.5, z:  7.0, s: 0.26 },
  ];

  let seed = 7;
  const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  for (const p of spots) {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const pos = geo.attributes['position'] as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i,
        pos.getX(i) * (0.8 + rng() * 0.4),
        pos.getY(i) * (0.65 + rng() * 0.3),
        pos.getZ(i) * (0.8 + rng() * 0.4),
      );
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.setScalar(p.s);
    mesh.position.set(p.x, p.s * 0.45, p.z);
    mesh.rotation.set((rng() - 0.5) * 0.4, rng() * Math.PI * 2, (rng() - 0.5) * 0.2);
    scene.add(mesh);
  }
}

// ── Algues verticales sur le sol ──────────────────────────────────
function createSeaweed(scene: THREE.Scene): (t: number) => void {
  const loader = new THREE.TextureLoader();
  const texA = loader.load('/vibrant-green-seaweed-specimen-closeup-study/1407015f-bd45-4b59-8f5f-34168020a167.jpg');
  const texB = loader.load('/vibrant-green-seaweed-underwater/0631066b-1199-4fd4-93e5-0dc095c751b0.jpg');

  // Shader : discard les pixels quasi-blancs (fond transparent exporté en JPG)
  const makeMat = (tex: THREE.Texture) => new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, time: { value: 0 } },
    vertexShader: `
      uniform float time;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 pos = position;
        float sway = sin(time * 0.9 + pos.y * 2.5) * 0.07 * uv.y * uv.y;
        pos.x += sway;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      varying vec2 vUv;
      void main() {
        vec4 c = texture2D(map, vUv);
        float brightness = dot(c.rgb, vec3(0.299, 0.587, 0.114));
        if (brightness > 0.82) discard;
        gl_FragColor = c;
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const mats: THREE.ShaderMaterial[] = [];

  const spots = [
    { x: -2.5, z: -6.5, h: 1.4, tex: texA }, { x:  1.5, z: -6.0, h: 1.1, tex: texB },
    { x:  3.2, z: -4.8, h: 1.3, tex: texA }, { x: -0.3, z: -3.5, h: 1.0, tex: texB },
    { x: -3.2, z: -2.5, h: 1.5, tex: texB }, { x:  2.8, z: -1.8, h: 1.2, tex: texA },
    { x: -1.8, z: -0.5, h: 1.1, tex: texB }, { x:  0.5, z:  1.5, h: 1.3, tex: texA },
    { x: -3.4, z:  2.5, h: 1.4, tex: texB }, { x:  2.0, z:  3.5, h: 1.0, tex: texA },
    { x: -1.0, z:  4.8, h: 1.2, tex: texB }, { x:  3.2, z:  5.5, h: 1.1, tex: texA },
    { x: -2.5, z:  6.2, h: 1.5, tex: texB }, { x:  1.2, z:  7.0, h: 1.3, tex: texA },
  ];

  let seed = 13;
  const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  for (const p of spots) {
    const mat = makeMat(p.tex);
    mats.push(mat);
    const geo = new THREE.PlaneGeometry(p.h * 0.7, p.h, 1, 5);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(p.x, p.h / 2, p.z);
    mesh.rotation.y = rng() * Math.PI * 2;
    scene.add(mesh);
  }

  return (t: number) => { for (const m of mats) m.uniforms['time']!.value = t; };
}

export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x006ba3); // Bikini Bottom bright ocean blue
  scene.fog = new THREE.Fog(0x006ba3, 22, 55);

  const camera = new THREE.PerspectiveCamera(50, RENDER_WIDTH / RENDER_HEIGHT, 0.1, 1000);
  camera.up.set(0, 0, -1);
  camera.position.set(0, 22, 6);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(RENDER_WIDTH, RENDER_HEIGHT, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.80;

  // OrbitControls — clic+drag pour tourner, scroll pour zoomer, clic droit pour pan
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);

  // Post-processing: bloom gives the ball and bumpers a visible glow
  const composer = new EffectComposer(renderer);
  composer.setSize(RENDER_WIDTH, RENDER_HEIGHT);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(
    new UnrealBloomPass(
      new THREE.Vector2(RENDER_WIDTH, RENDER_HEIGHT),
      0.22, // strength — réduit pour éviter le blowout blanc
      0.4,  // radius
      0.55, // threshold — plus haut, seuls les éléments très lumineux brillent
    ),
  );
  composer.addPass(new OutputPass());

  // ── Lighting — Bikini Bottom : ciel bleu vif + soleil chaud ────
  scene.add(new THREE.AmbientLight(0x88ddff, 1.6));

  // Lumières rasantes basses — sculptent le relief du sable (angle très faible = ombres portées marquées)
  const grazingA = new THREE.DirectionalLight(0xfff0cc, 5.0);
  grazingA.position.set(12, 0.4, 0);
  scene.add(grazingA);

  const grazingB = new THREE.DirectionalLight(0xffe8aa, 3.5);
  grazingB.position.set(-10, 0.4, -2);
  scene.add(grazingB);

  const grazingC = new THREE.DirectionalLight(0xffeedd, 2.5);
  grazingC.position.set(0, 0.4, 14);
  scene.add(grazingC);

  const sunLight = new THREE.DirectionalLight(0xfff4aa, 0.8);
  sunLight.position.set(2, 12, -6);
  scene.add(sunLight);

  const mainLight = new THREE.PointLight(0xffffff, 70);
  mainLight.position.set(0, 15, 5);
  scene.add(mainLight);

  // Caustic light: simulates sunlight filtered through moving water
  const causticLight = new THREE.PointLight(0x00ccff, 40, 28);
  causticLight.position.set(2, 10, -2);
  scene.add(causticLight);



  // ── 3D models ─────────────────────────────────────────────────
  const gltfLoader = new GLTFLoader();

  // ── Texture sable — appliquée sur le sol du GLB via traverse ──
  const sandTexLoader = new THREE.TextureLoader();

  const sandArm = sandTexLoader.load('/sand_03_2k/textures/sand_03_arm_2k.jpg');
  sandArm.wrapS = sandArm.wrapT = THREE.RepeatWrapping;
  sandArm.repeat.set(6, 10);

  // PNG heightmap → bumpMap (encodé [0,1], compatible Three.js)
  const sandBump = sandTexLoader.load('/sand_03_2k/textures/sand_03_disp_2k.png');
  sandBump.wrapS = sandBump.wrapT = THREE.RepeatWrapping;
  sandBump.repeat.set(6, 10);

  // ── Matériaux table ───────────────────────────────────────────
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x7a4a2a,
    roughness: 0.8,
    metalness: 0.05,
  });

  const sandMat = new THREE.MeshStandardMaterial({
    color: 0x60a68d,
    roughnessMap: sandArm,
    aoMap: sandArm,
    aoMapIntensity: 2.2,
    bumpMap: sandBump,
    bumpScale: 1.2,
    roughness: 0.95,
    metalness: 0.0,
  });

  // Normal map EXR — chargée async, appliquée dès qu'elle est prête
  new EXRLoader().load('/sand_03_2k/textures/sand_03_nor_gl_2k.exr', (normalTex) => {
    normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;
    normalTex.repeat.set(6, 10);
    sandMat.normalMap = normalTex;
    sandMat.normalScale.set(2.0, 2.0);
    sandMat.needsUpdate = true;
  });

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

    base.updateMatrixWorld(true);

    base.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const b = new THREE.Box3().setFromObject(child);
      const s = b.getSize(new THREE.Vector3());
      if (s.y < s.x * 0.15 && s.y < s.z * 0.15) {
        // Sol plat — UVs normalisées 0→1, le repeat de texture gère le tuilage
        const posAttr = child.geometry.attributes['position'] as THREE.BufferAttribute;
        const count = posAttr.count;
        const uvArr = new Float32Array(count * 2);
        const wm = child.matrixWorld;
        const v = new THREE.Vector3();
        for (let i = 0; i < count; i++) {
          v.set(posAttr.getX(i) ?? 0, posAttr.getY(i) ?? 0, posAttr.getZ(i) ?? 0);
          v.applyMatrix4(wm);
          uvArr[i * 2]     = v.x / TABLE.width  + 0.5;
          uvArr[i * 2 + 1] = v.z / TABLE.depth  + 0.5;
        }
        const newUV = new THREE.BufferAttribute(uvArr, 2);
        child.geometry.setAttribute('uv',  newUV);
        child.geometry.setAttribute('uv2', newUV.clone());
        child.material = sandMat;
      } else {
        if (child.geometry.attributes['uv']) {
          child.geometry.setAttribute('uv2', (child.geometry.attributes['uv'] as THREE.BufferAttribute).clone());
        }
        child.material = wallMat;
      }
    });

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
  const tickStarfish = createStarfish(scene);
  createCorals(scene);
  const tickSprites = createSBSprites(scene);
  createBoulders(scene);
  const tickSeaweed = createSeaweed(scene);

  const startTime = performance.now();

  function render(): void {
    const t = (performance.now() - startTime) * 0.001;

    // Caustic drift — bleu ciel oscillant pour simuler la lumière à travers l'eau
    causticLight.color.setHSL(0.54 + Math.sin(t * 0.29) * 0.03, 0.9, 0.62);
    causticLight.position.x = Math.sin(t * 0.61) * 2.8;
    causticLight.position.z = Math.cos(t * 0.38) * 1.8 - 2;
    causticLight.intensity = 38 + Math.sin(t * 1.24) * 8;

    controls.update();
    tickLarge(t);
    tickSmall(t);
    jellyfish.update(t);
    tickKelp(t);
    tickStarfish(t);
    tickSprites(t);
    tickSeaweed(t);

    composer.render();
  }

  function resize(): void {
    // no-op: render resolution stays fixed, CSS handles screen-fit letterbox
  }

  return { scene, camera, renderer, render, resize, flashBumper: jellyfish.flashById };
}
