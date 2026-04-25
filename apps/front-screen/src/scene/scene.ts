import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { TABLE } from '@flipper/contracts';

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  render: () => void;
  resize: () => void;
}

const SNOW_COUNT = 2500;

export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1a2e);
  scene.fog = new THREE.FogExp2(0x0d1a2e, 0.018);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 20, 20);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Lumière ambiante froide/bleue
  const ambient = new THREE.AmbientLight(0x8ab4d4, 0.6);
  scene.add(ambient);

  // Lumière principale blanche froide (simule un ciel nuageux)
  const dirLight = new THREE.DirectionalLight(0xd6e8ff, 2.0);
  dirLight.position.set(5, 12, 8);
  scene.add(dirLight);

  // Lumière de remplissage bleue pour les ombres
  const fillLight = new THREE.PointLight(0x3a6ea5, 60);
  fillLight.position.set(-8, 6, -5);
  scene.add(fillLight);

  const textureLoader = new THREE.TextureLoader();
  const exrLoader = new EXRLoader();

  // Textures neige
  const snowDiff = textureLoader.load('/snow_01_1k/textures/snow_01_diff_1k.jpg');
  const snowAO = textureLoader.load('/snow_01_1k/textures/snow_01_ao_1k.jpg');
  const snowDisp = textureLoader.load('/snow_01_1k/textures/snow_01_disp_1k.png');
  const snowArm = textureLoader.load('/snow_01_1k/textures/snow_01_arm_1k.jpg');

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

  // Le normal map EXR se charge de manière asynchrone
  exrLoader.load('/snow_01_1k/textures/snow_01_nor_gl_1k.exr', (normalTex) => {
    normalTex.wrapS = THREE.RepeatWrapping;
    normalTex.wrapT = THREE.RepeatWrapping;
    normalTex.repeat.set(4, 6);
    snowMaterial.normalMap = normalTex;
    snowMaterial.normalScale = new THREE.Vector2(1.2, 1.2);
    snowMaterial.needsUpdate = true;
  });

  const { height: wallHeight, thickness: wallThickness } = TABLE.wall;
  // Portrait : X = étroit (depth=9), Z = long (width=16)
  const W = TABLE.depth;  // 9  → axe X
  const L = TABLE.width;  // 16 → axe Z
  const halfW = W / 2;
  const halfL = L / 2;

  // Groupe incliné comme une vraie machine de flipper (~6.5°)
  const tableGroup = new THREE.Group();
  tableGroup.rotation.x = THREE.MathUtils.degToRad(6.5);
  scene.add(tableGroup);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(W, TABLE.floorThickness, L, 32, 1, 64),
    snowMaterial,
  );
  tableGroup.add(base);

  const barkDiff = textureLoader.load('/bark_willow_1k/textures/bark_willow_diff_1k.jpg');
  const barkAO = textureLoader.load('/bark_willow_1k/textures/bark_willow_ao_1k.jpg');
  const barkArm = textureLoader.load('/bark_willow_1k/textures/bark_willow_arm_1k.jpg');
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

  const wallLeft = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, wallHeight, L),
    wallMaterial,
  );
  wallLeft.position.set(-halfW, wallHeight / 2, 0);
  tableGroup.add(wallLeft);

  const wallRight = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, wallHeight, L),
    wallMaterial,
  );
  wallRight.position.set(halfW, wallHeight / 2, 0);
  tableGroup.add(wallRight);

  const wallTop = new THREE.Mesh(
    new THREE.BoxGeometry(W + wallThickness, wallHeight, wallThickness),
    wallMaterial,
  );
  wallTop.position.set(0, wallHeight / 2, -halfL);
  tableGroup.add(wallTop);

  const drainWidth = 1.8;
  const sideWidth = (W - drainWidth) / 2;

  const wallBottomLeft = new THREE.Mesh(
    new THREE.BoxGeometry(sideWidth, wallHeight, wallThickness),
    wallMaterial,
  );
  wallBottomLeft.position.set(-halfW + sideWidth / 2, wallHeight / 2, halfL);
  tableGroup.add(wallBottomLeft);

  const wallBottomRight = new THREE.Mesh(
    new THREE.BoxGeometry(sideWidth, wallHeight, wallThickness),
    wallMaterial,
  );
  wallBottomRight.position.set(halfW - sideWidth / 2, wallHeight / 2, halfL);
  tableGroup.add(wallBottomRight);

  // Zones de glace : disques réfléchissants sur la surface
  const iceMaterial = new THREE.MeshStandardMaterial({
    color: 0xc8e8ff,
    metalness: 0.15,
    roughness: 0.05,
    transparent: true,
    opacity: 0.75,
  });

  const iceZones: { x: number; z: number; r: number }[] = [
    { x: 0,    z: -3,  r: 2.2 }, // grande zone centrale haute
    { x: -1.5, z:  3,  r: 1.2 }, // petite zone gauche bas
    { x:  1.8, z:  1,  r: 0.9 }, // petite zone droite milieu
    { x:  0,   z: -6,  r: 1.0 }, // zone proche du mur haut
  ];

  for (const { x, z, r } of iceZones) {
    const disk = new THREE.Mesh(
      new THREE.CircleGeometry(r, 48),
      iceMaterial,
    );
    disk.rotation.x = -Math.PI / 2;
    disk.position.set(x, TABLE.floorThickness / 2 + 0.01, z);
    tableGroup.add(disk);
  }

  // --- Bumpers ---
  const bumperBodyMat = new THREE.MeshStandardMaterial({
    color: 0x9dd4f0,
    metalness: 0.4,
    roughness: 0.08,
  });
  const bumperDomeMat = new THREE.MeshStandardMaterial({
    color: 0xe8f6ff,
    metalness: 0.1,
    roughness: 0.02,
    transparent: true,
    opacity: 0.82,
  });
  const bumperRingMat = new THREE.MeshStandardMaterial({
    color: 0x00cfff,
    emissive: new THREE.Color(0x0088cc),
    emissiveIntensity: 2.5,
    metalness: 0.0,
    roughness: 0.3,
  });

  function addBumper(x: number, z: number): void {
    const group = new THREE.Group();

    // Corps cylindrique
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.52, 0.55, 32), bumperBodyMat);
    body.position.y = 0.275;
    group.add(body);

    // Dôme de verre sur le dessus
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.48, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), bumperDomeMat);
    dome.position.y = 0.55;
    group.add(dome);

    // Anneau lumineux au centre du corps
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 12, 40), bumperRingMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.35;
    group.add(ring);

    // Petite lumière ponctuelle pour le glow
    const glow = new THREE.PointLight(0x00aaff, 8, 3);
    glow.position.y = 0.5;
    group.add(glow);

    group.position.set(x, TABLE.floorThickness / 2, z);
    tableGroup.add(group);
  }

  // Triangle de bumpers dans la zone haute du terrain
  addBumper(0,    -4.5);
  addBumper(-1.4, -3.2);
  addBumper( 1.4, -3.2);

  const gridHelper = new THREE.GridHelper(40, 40, 0x1a3a5c, 0x1a3a5c);
  scene.add(gridHelper);

  // --- Particules de neige ---
  const snowPositions = new Float32Array(SNOW_COUNT * 3);
  const snowVelocities = new Float32Array(SNOW_COUNT * 3);

  for (let i = 0; i < SNOW_COUNT; i++) {
    snowPositions[i * 3] = (Math.random() - 0.5) * 35;
    snowPositions[i * 3 + 1] = Math.random() * 22;
    snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 35;
    snowVelocities[i * 3] = (Math.random() - 0.5) * 0.015;
    snowVelocities[i * 3 + 1] = -(0.025 + Math.random() * 0.04);
    snowVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
  }

  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));

  const snowParticleMat = new THREE.PointsMaterial({
    color: 0xddeeff,
    size: 0.1,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: true,
  });

  const snowParticles = new THREE.Points(snowGeo, snowParticleMat);
  scene.add(snowParticles);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  function render(): void {
    controls.update();

    // Animation neige : chute + vent latéral
    const posAttr = snowParticles.geometry.attributes.position as THREE.BufferAttribute;
    const pos = posAttr.array as Float32Array;
    const wind = 0.012;

    for (let i = 0; i < SNOW_COUNT; i++) {
      pos[i * 3] = pos[i * 3]! + snowVelocities[i * 3]! + wind;
      pos[i * 3 + 1] = pos[i * 3 + 1]! + snowVelocities[i * 3 + 1]!;
      pos[i * 3 + 2] = pos[i * 3 + 2]! + snowVelocities[i * 3 + 2]!;

      if (pos[i * 3 + 1]! < -3) {
        pos[i * 3] = (Math.random() - 0.5) * 35;
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

  return { scene, camera, renderer, render, resize };
}
