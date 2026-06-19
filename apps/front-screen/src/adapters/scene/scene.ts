import * as THREE from 'three';
import { GLTFLoader, OrbitControls, RoomEnvironment, EXRLoader } from 'three/examples/jsm/Addons.js';
import { TABLE } from '@flipper/contracts';
import { createPhysicsDebug } from './physics-debug';

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
function createCausticOverlay(scene: THREE.Scene): (t: number) => void {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);

  const geo = new THREE.PlaneGeometry(TABLE.width + 1, TABLE.depth + 1);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const plane = new THREE.Mesh(geo, mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.06;
  scene.add(plane);

  let frame = 0;
  return (t: number) => {
    if (frame++ % 3 !== 0) return;
    ctx.clearRect(0, 0, size, size);
    for (let i = 0; i < 24; i++) {
      const bx = size / 2 + Math.sin(t * 0.38 + i * 1.27) * size * 0.42;
      const by = size / 2 + Math.cos(t * 0.31 + i * 0.91) * size * 0.42;
      const br = size * 0.055 + Math.sin(t * 0.6 + i * 0.55) * size * 0.026;
      const a  = 0.36 + Math.sin(t * 0.5 + i * 1.1) * 0.2;
      const g  = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      g.addColorStop(0, `rgba(100,210,255,${a})`);
      g.addColorStop(0.5, `rgba(40,140,230,${a * 0.4})`);
      g.addColorStop(1, 'rgba(0,80,180,0)');
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


// ── Dôme ciel océan (gradient surface → abysses) ──────────────────────────
function createOceanSky(scene: THREE.Scene): void {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 512;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  // canvas top (v=0) → pôle nord de la sphère = direction "en haut" = surface
  g.addColorStop(0.00, '#0099cc'); // reflet de surface, rayons de soleil
  g.addColorStop(0.20, '#0077aa');
  g.addColorStop(0.50, '#004488'); // milieu de l'océan
  g.addColorStop(0.75, '#002255');
  g.addColorStop(1.00, '#000e1e'); // abysses noirs
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 512);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(85, 32, 16), mat));
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

  const defs = [
    // Bumpers principaux (cluster haut centre)
    { x: -0.84, z: -3.94, color: 0x0099ff, r: 0.40 },
    { x:  0.83, z: -4.18, color: 0xffdd00, r: 0.40 },
    // Bumper isolé (haut gauche)
    { x: -3.18, z: -6.35, color: 0xff6600, r: 0.40 },
    // Mini-bumpers centre
    // Scoring lanes (3 lanes alignées devant les flippers)
    { x: -1.1, z: 5.4, color: 0xff8800, r: 0.20 },
    { x:  -0.05, z: 4.85, color: 0xffff00, r: 0.20 },
    { x:  0.94, z: 5.4, color: 0x44ff44, r: 0.20 },
    // Fond de table (haut)
    // Accents latéraux
    { x:  2.5, z:  2.5, color: 0xffaa44, r: 0.14 },
  ];

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

// ── Dunes de sable procédurales ───────────────────────────────────────────
function createDunes(scene: THREE.Scene, floor: FloorSampler, baseMat: THREE.MeshStandardMaterial): void {
  const W = TABLE.width  - 0.9;
  const D = TABLE.depth  - 0.9;
  const SEG_X = 56;
  const SEG_Z = 96;

  const geo = new THREE.PlaneGeometry(W, D, SEG_X, SEG_Z);
  const pos = geo.attributes['position'] as THREE.BufferAttribute;

  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i) ?? 0;
    const ly = pos.getY(i) ?? 0;
    // Après rotation.x = floor.rotX, localY ≈ -worldZ et localZ pointe vers le haut
    const wx = lx;
    const wz = -ly;

    // Fondu au bord — pas de dunes contre les murs
    const fadeX = Math.max(0, Math.min(1, (W / 2 - Math.abs(wx)) / 0.9));
    const fadeZ = Math.max(0, Math.min(1, (D / 2 - Math.abs(wz)) / 1.4));
    const fade  = fadeX * fadeZ;

    // Superposition de sinusoïdes → relief de dunes naturelles
    const dune =
      0.13 * Math.sin(wx * 0.82 + 0.31) * Math.cos(wz * 0.53 + 0.74) +
      0.08 * Math.sin(wx * 1.65 + wz * 0.68 + 1.20) +
      0.06 * Math.cos(wx * 0.47 + wz * 1.18 + 0.55) +
      0.04 * Math.sin(wx * 2.40 + wz * 1.45 + 1.90) +
      0.03 * Math.cos(wx * 0.30 + wz * 0.35 + 3.10);

    // Seule la partie positive forme des dunes (pas de trous)
    pos.setZ(i, Math.max(0, dune) * fade);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const mat = baseMat.clone();
  // Renforce le relief de texture sur les dunes
  mat.bumpScale = 2.5;
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -1;
  mat.polygonOffsetUnits = -1;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = floor.rotX;
  mesh.position.set(0, floor.getY(0, 0) + 0.005, 0);
  scene.add(mesh);
}

// ─────────────────────────────────────────────────────────────────────────────
// createScene
// ─────────────────────────────────────────────────────────────────────────────
export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x003d6f); // fallback si la sphère est hors champ
  scene.fog = new THREE.FogExp2(0x003d6f, 0.004);

  const camera = new THREE.PerspectiveCamera(55, RENDER_WIDTH / RENDER_HEIGHT, 0.1, 1000);
  camera.position.set(0, 16, 20);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(RENDER_WIDTH, RENDER_HEIGHT, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.LinearToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = false;

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment()).texture;
  scene.environmentIntensity = 0.45;
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

  // Ambiance océan profond
  scene.add(new THREE.AmbientLight(0x5599cc, 2.0));

  // Lumière principale top-down
  const keyLight = new THREE.DirectionalLight(0xfff5dd, 1.8);
  keyLight.position.set(2, 20, 4);
  scene.add(keyLight);

  // Lumière rasante légère pour révéler le sable et les murs latéraux
  const sideLight = new THREE.DirectionalLight(0xffddaa, 1.4);
  sideLight.position.set(18, 2, 0);
  scene.add(sideLight);

  // ── Texture sable ─────────────────────────────────────────────────
  const sandTexLoader = new THREE.TextureLoader();

  const sandDiff = sandTexLoader.load('/sand_03_2k/textures/sand_03_diff_2k.jpg');
  sandDiff.wrapS = sandDiff.wrapT = THREE.RepeatWrapping;
  sandDiff.repeat.set(3, 5);
  sandDiff.colorSpace = THREE.SRGBColorSpace;

  const sandArm = sandTexLoader.load('/sand_03_2k/textures/sand_03_arm_2k.jpg');
  sandArm.wrapS = sandArm.wrapT = THREE.RepeatWrapping;
  sandArm.repeat.set(3, 5);

  const sandBump = sandTexLoader.load('/sand_03_2k/textures/sand_03_disp_2k.png');
  sandBump.wrapS = sandBump.wrapT = THREE.RepeatWrapping;
  sandBump.repeat.set(3, 5);

  // Sable sur la géométrie GLB.
  // DoubleSide = visible depuis le dessous aussi quand on fait pivoter la caméra.
  // bumpScale élevé + lumières rasantes très basses = relief prononcé vu de dessus.
  const sandMat = new THREE.MeshStandardMaterial({
    map: sandDiff,
    roughnessMap: sandArm,
    aoMap: sandArm,
    aoMapIntensity: 0.8,
    bumpMap: sandBump,
    bumpScale: 1.5,
    roughness: 0.96,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  new EXRLoader().load('/sand_03_2k/textures/sand_03_nor_gl_2k.exr', (normalTex) => {
    normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;
    normalTex.repeat.set(3, 5);
    sandMat.normalMap = normalTex;
    sandMat.normalScale.set(2.8, 2.8);
    sandMat.bumpMap = null;
    sandMat.needsUpdate = true;
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
    // MeshPhysicalMaterial : iridescence arc-en-ciel + légère transmission (effet
    // coquillage / bulle de savon sous-marin). Spectaculaire vu d'en haut car
    // les reflets irisés changent avec l'angle de caméra et les lumières rasantes.
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
      color: new THREE.Color(0xffcc00),
      roughness: 0.10,
      metalness: 0.80,
      emissive: new THREE.Color(0xff8800),
      emissiveIntensity: 0.20,
    });

    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (obj.name === 'col_floor_playfield_blue') return;

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
      tickInserts = createInsertLights(scene, floor);
      createDunes(scene, floor, sandMat);
    }
  });

  // ── Décorations non liées au sol ──────────────────────────────────
  const tickBubblesLarge   = createBubbleLayer(scene, 30,  0.30, 0.45);
  const tickBubblesSmall   = createBubbleLayer(scene, 70, 0.15, 0.30);
  let tickInserts: (t: number) => void = () => {};
  createOceanSky(scene);
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
    trail.tick(dt);
    applyShake(dt);
    renderer.render(scene, camera);
  }

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
  };
}
