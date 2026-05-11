import * as THREE from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { TABLE } from '@flipper/contracts';

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  flashBumper: (x: number, z: number) => void;
  render: () => void;
  resize: () => void;
}

const SNOW_COUNT = 2500;
const FLASH_DECAY = 1 / 30; // 0 → 1 en ~0.5s à 60fps

interface BumperData {
  x: number;
  z: number;
  glow: THREE.PointLight;
  ringMat: THREE.MeshStandardMaterial;
  flash: number;
}


export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1a2e);
  scene.fog = new THREE.FogExp2(0x0d1a2e, 0.018);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 18, 12);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const ambient = new THREE.AmbientLight(0x8ab4d4, 0.6);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xd6e8ff, 2.0);
  dirLight.position.set(5, 12, 8);
  scene.add(dirLight);

  const fillLight = new THREE.PointLight(0x3a6ea5, 60);
  fillLight.position.set(-8, 6, -5);
  scene.add(fillLight);

  const textureLoader = new THREE.TextureLoader();
  const exrLoader = new EXRLoader();

  const halfW = TABLE.width / 2;
  const halfD = TABLE.depth / 2;
  const { height: wallHeight, thickness: wallThickness } = TABLE.wall;

  // --- Sol neige ---
  const snowDiff = textureLoader.load('/snow_01_1k/textures/snow_01_diff_1k.jpg');
  const snowAO   = textureLoader.load('/snow_01_1k/textures/snow_01_ao_1k.jpg');
  const snowDisp = textureLoader.load('/snow_01_1k/textures/snow_01_disp_1k.png');
  const snowArm  = textureLoader.load('/snow_01_1k/textures/snow_01_arm_1k.jpg');

  [snowDiff, snowAO, snowDisp, snowArm].forEach((t) => {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(4, 6);
  });

  const snowMaterial = new THREE.MeshStandardMaterial({
    map: snowDiff,
    aoMap: snowAO,
    aoMapIntensity: 1.2,
    displacementMap: snowDisp,
    displacementScale: 0.15,
    displacementBias: -0.05,
    roughnessMap: snowArm,
    roughness: 0.9,
    metalness: 0.0,
  });

  exrLoader.load('/snow_01_1k/textures/snow_01_nor_gl_1k.exr', (normalTex) => {
    normalTex.wrapS = THREE.RepeatWrapping;
    normalTex.wrapT = THREE.RepeatWrapping;
    normalTex.repeat.set(4, 6);
    snowMaterial.normalMap = normalTex;
    snowMaterial.normalScale = new THREE.Vector2(1.2, 1.2);
    snowMaterial.needsUpdate = true;
  });

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(TABLE.width, TABLE.floorThickness, TABLE.depth, 32, 1, 64),
    snowMaterial,
  );
  scene.add(base);

  // --- Murs écorce ---
  const barkDiff = textureLoader.load('/bark_willow_1k/textures/bark_willow_diff_1k.jpg');
  const barkAO   = textureLoader.load('/bark_willow_1k/textures/bark_willow_ao_1k.jpg');
  const barkArm  = textureLoader.load('/bark_willow_1k/textures/bark_willow_arm_1k.jpg');
  const barkDisp = textureLoader.load('/bark_willow_1k/textures/bark_willow_disp_1k.png');

  [barkDiff, barkAO, barkArm, barkDisp].forEach((t) => {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 1);
  });

  const wallMaterial = new THREE.MeshStandardMaterial({
    map: barkDiff,
    aoMap: barkAO,
    aoMapIntensity: 1.0,
    roughnessMap: barkArm,
    roughness: 1.0,
    metalnessMap: barkArm,
    metalness: 0.0,
    displacementMap: barkDisp,
    displacementScale: 0.04,
    displacementBias: -0.02,
  });

  exrLoader.load('/bark_willow_1k/textures/bark_willow_nor_gl_1k.exr', (normalTex) => {
    normalTex.wrapS = THREE.RepeatWrapping;
    normalTex.wrapT = THREE.RepeatWrapping;
    normalTex.repeat.set(2, 1);
    wallMaterial.normalMap = normalTex;
    wallMaterial.normalScale = new THREE.Vector2(1.5, 1.5);
    wallMaterial.needsUpdate = true;
  });

  const wallLongSize = TABLE.width + wallThickness;

  const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, TABLE.depth), wallMaterial);
  wallLeft.position.set(-halfW, wallHeight / 2, 0);
  scene.add(wallLeft);

  const wallRight = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, TABLE.depth), wallMaterial);
  wallRight.position.set(halfW, wallHeight / 2, 0);
  scene.add(wallRight);

  const wallTop = new THREE.Mesh(new THREE.BoxGeometry(wallLongSize, wallHeight, wallThickness), wallMaterial);
  wallTop.position.set(0, wallHeight / 2, -halfD);
  scene.add(wallTop);

  const wallBottom = new THREE.Mesh(new THREE.BoxGeometry(wallLongSize, wallHeight, wallThickness), wallMaterial);
  wallBottom.position.set(0, wallHeight / 2, halfD);
  scene.add(wallBottom);

  // --- Apron (forme V style vrai flipper) ---
  const apronZTop  = TABLE.flippers.left.z - 0.6;  // bord intérieur (côté flippers)
  const apronZBot  = halfD - wallThickness;          // bord extérieur (côté mur bas)
  const apronXMax  = halfW - wallThickness;          // 4.2
  const drainHalfW = 0.55;                           // demi-largeur du trou de drain
  const drainDepth = 0.9;                            // profondeur du V

  // Forme 2D dans le plan XY local ; après rotation.x = -π/2 :
  // local.x  → world.x  (gauche/droite)
  // local.y  → world.-z → on utilise -z comme coordonnée y
  // extrusion (local.z) → world.y (hauteur)
  const apronShape = new THREE.Shape();
  apronShape.moveTo(-apronXMax, -apronZBot);
  apronShape.lineTo( apronXMax, -apronZBot);
  apronShape.lineTo( apronXMax, -apronZTop);
  apronShape.lineTo( 1.5,       -apronZTop);
  apronShape.lineTo( drainHalfW, -(apronZTop + drainDepth));
  apronShape.lineTo(-drainHalfW, -(apronZTop + drainDepth));
  apronShape.lineTo(-1.5,       -apronZTop);
  apronShape.lineTo(-apronXMax, -apronZTop);
  apronShape.closePath();

  const apronGeo = new THREE.ExtrudeGeometry(apronShape, { depth: 0.18, bevelEnabled: false });

  const apronBodyMat = new THREE.MeshStandardMaterial({
    color: 0x0b1220,
    metalness: 0.75,
    roughness: 0.22,
  });

  const apronMesh = new THREE.Mesh(apronGeo, apronBodyMat);
  apronMesh.rotation.x = -Math.PI / 2;
  apronMesh.position.set(0, TABLE.floorThickness / 2, 0);
  scene.add(apronMesh);

  // Liseré ice-blue sur le bord intérieur (inner top edge)
  const apronTrimMat = new THREE.LineBasicMaterial({ color: 0x7dd3fc, linewidth: 2 });
  const apronTrimY   = TABLE.floorThickness / 2 + 0.19;
  const apronTrimPts = [
    new THREE.Vector3(-apronXMax,   apronTrimY, apronZTop),
    new THREE.Vector3(-1.5,         apronTrimY, apronZTop),
    new THREE.Vector3(-drainHalfW,  apronTrimY, apronZTop + drainDepth),
    new THREE.Vector3( drainHalfW,  apronTrimY, apronZTop + drainDepth),
    new THREE.Vector3( 1.5,         apronTrimY, apronZTop),
    new THREE.Vector3( apronXMax,   apronTrimY, apronZTop),
  ];
  const apronTrimGeo = new THREE.BufferGeometry().setFromPoints(apronTrimPts);
  scene.add(new THREE.Line(apronTrimGeo, apronTrimMat));

  // Lueur froide sur le drain
  const apronLight = new THREE.PointLight(0x7dd3fc, 10, 3.5);
  apronLight.position.set(0, TABLE.floorThickness / 2 + 0.5, apronZTop + drainDepth * 0.6);
  scene.add(apronLight);

  // --- Zones de glace ---
  const iceMaterial = new THREE.MeshStandardMaterial({
    color: 0xc8e8ff,
    metalness: 0.15,
    roughness: 0.05,
    transparent: true,
    opacity: 0.75,
  });

  const iceZones: { x: number; z: number; r: number }[] = [
    { x: 0,    z: -3,  r: 2.2 },
    { x: -1.5, z:  3,  r: 1.2 },
    { x:  1.8, z:  1,  r: 0.9 },
    { x:  0,   z: -6,  r: 1.0 },
  ];

  for (const { x, z, r } of iceZones) {
    const disk = new THREE.Mesh(new THREE.CircleGeometry(r, 48), iceMaterial);
    disk.rotation.x = -Math.PI / 2;
    disk.position.set(x, TABLE.floorThickness / 2 + 0.01, z);
    scene.add(disk);
  }

  // --- Bumpers (matériau ring cloné par bumper pour flash indépendant) ---
  const bumperBodyMat = new THREE.MeshStandardMaterial({ color: 0x9dd4f0, metalness: 0.4, roughness: 0.08 });
  const bumperDomeMat = new THREE.MeshStandardMaterial({ color: 0xe8f6ff, metalness: 0.1, roughness: 0.02, transparent: true, opacity: 0.82 });

  const bumperData: BumperData[] = [];

  function addBumper(x: number, z: number): void {
    const group = new THREE.Group();

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.52, 0.55, 32), bumperBodyMat);
    body.position.y = 0.275;
    group.add(body);

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      bumperDomeMat,
    );
    dome.position.y = 0.55;
    group.add(dome);

    // Matériau ring cloné pour que chaque bumper flash indépendamment
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x00cfff,
      emissive: new THREE.Color(0x0088cc),
      emissiveIntensity: 2.5,
      metalness: 0.0,
      roughness: 0.3,
    });

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 12, 40), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.35;
    group.add(ring);

    const glow = new THREE.PointLight(0x00aaff, 8, 3);
    glow.position.y = 0.5;
    group.add(glow);

    group.position.set(x, TABLE.floorThickness / 2, z);
    scene.add(group);

    bumperData.push({ x, z, glow, ringMat, flash: 0 });
  }

  addBumper(0,    -4.5);
  addBumper(-1.4, -3.2);
  addBumper( 1.4, -3.2);

  const gridHelper = new THREE.GridHelper(40, 40, 0x1a3a5c, 0x1a3a5c);
  scene.add(gridHelper);

  // --- Particules de neige ---
  const snowPositions  = new Float32Array(SNOW_COUNT * 3);
  const snowVelocities = new Float32Array(SNOW_COUNT * 3);

  for (let i = 0; i < SNOW_COUNT; i++) {
    snowPositions[i * 3]     = (Math.random() - 0.5) * 35;
    snowPositions[i * 3 + 1] = Math.random() * 22;
    snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 35;
    snowVelocities[i * 3]     = (Math.random() - 0.5) * 0.015;
    snowVelocities[i * 3 + 1] = -(0.025 + Math.random() * 0.04);
    snowVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
  }

  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));

  const snowParticles = new THREE.Points(snowGeo, new THREE.PointsMaterial({
    color: 0xddeeff,
    size: 0.1,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: true,
  }));
  scene.add(snowParticles);

  // --- Flash bumper ---
  function flashBumper(hitX: number, hitZ: number): void {
    let nearest: BumperData | null = null;
    let minDist = Infinity;
    for (const b of bumperData) {
      const d = Math.hypot(b.x - hitX, b.z - hitZ);
      if (d < minDist) { minDist = d; nearest = b; }
    }
    if (nearest !== null && minDist < 3) nearest.flash = 1;
  }

  function render(): void {
    // Flash bumpers
    for (const b of bumperData) {
      if (b.flash > 0) {
        b.flash = Math.max(0, b.flash - FLASH_DECAY);
        b.glow.intensity = 8 + 55 * b.flash;
        b.ringMat.emissiveIntensity = 2.5 + 10 * b.flash;
      }
    }

    // Neige
    const posAttr = snowParticles.geometry.attributes.position as THREE.BufferAttribute;
    const pos = posAttr.array as Float32Array;
    const wind = 0.012;

    for (let i = 0; i < SNOW_COUNT; i++) {
      pos[i * 3]     = pos[i * 3]!     + snowVelocities[i * 3]!     + wind;
      pos[i * 3 + 1] = pos[i * 3 + 1]! + snowVelocities[i * 3 + 1]!;
      pos[i * 3 + 2] = pos[i * 3 + 2]! + snowVelocities[i * 3 + 2]!;

      if (pos[i * 3 + 1]! < -3) {
        pos[i * 3]     = (Math.random() - 0.5) * 35;
        pos[i * 3 + 1] = 18 + Math.random() * 5;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 35;
      }
    }
    posAttr.needsUpdate = true;

    renderer.render(scene, camera);
  }

  function resize(): void {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  return { scene, camera, renderer, flashBumper, render, resize };
}
