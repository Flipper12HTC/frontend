import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { TABLE } from '@flipper/contracts';

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  render: () => void;
  resize: () => void;
}

export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0f);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 20, 20);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  const pointLight = new THREE.PointLight(0xffffff, 200);
  pointLight.position.set(0, 15, 5);
  scene.add(pointLight);

  const textureLoader = new THREE.TextureLoader();

  const grassColor = textureLoader.load('/grass2k/Grass001_2K-JPG_Color.jpg');
  const grassNormal = textureLoader.load('/grass2k/Grass001_2K-JPG_NormalGL.jpg');
  const grassDisplace = textureLoader.load('/grass2k/Grass001_2K-JPG_Displacement.jpg');

  [grassColor, grassNormal, grassDisplace].forEach((t) => {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(4, 6);
  });

  // TABLE.depth = 9 → largeur (X), TABLE.width = 16 → longueur (Z)
  const W = TABLE.depth;
  const L = TABLE.width;
  const halfW = W / 2;
  const halfL = L / 2;
  const { height: wallHeight, thickness: wallThickness } = TABLE.wall;

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(W, TABLE.floorThickness, L, 32, 1, 64),
    new THREE.MeshStandardMaterial({
      map: grassColor,
      normalMap: grassNormal,
      normalScale: new THREE.Vector2(1.5, 1.5),
      displacementMap: grassDisplace,
      displacementScale: 0.08,
      displacementBias: -0.04,
    }),
  );
  scene.add(base);

  const cuirTexture = textureLoader.load('/cuir.jpg');
  const wallMaterial = new THREE.MeshStandardMaterial({ map: cuirTexture });

  // Murs gauche et droit (le long de la longueur Z)
  const wallLeft = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, wallHeight, L),
    wallMaterial,
  );
  wallLeft.position.set(-halfW, wallHeight / 2, 0);
  scene.add(wallLeft);

  const wallRight = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, wallHeight, L),
    wallMaterial,
  );
  wallRight.position.set(halfW, wallHeight / 2, 0);
  scene.add(wallRight);

  // Mur haut
  const wallTop = new THREE.Mesh(
    new THREE.BoxGeometry(W + wallThickness, wallHeight, wallThickness),
    wallMaterial,
  );
  wallTop.position.set(0, wallHeight / 2, -halfL);
  scene.add(wallTop);

  // Mur bas avec trou au centre
  const drainWidth = 1.5;
  const sideWallWidth = (W - drainWidth) / 2;

  const wallBottomLeft = new THREE.Mesh(
    new THREE.BoxGeometry(sideWallWidth, wallHeight, wallThickness),
    wallMaterial,
  );
  wallBottomLeft.position.set(-halfW + sideWallWidth / 2, wallHeight / 2, halfL);
  scene.add(wallBottomLeft);

  const wallBottomRight = new THREE.Mesh(
    new THREE.BoxGeometry(sideWallWidth, wallHeight, wallThickness),
    wallMaterial,
  );
  wallBottomRight.position.set(halfW - sideWallWidth / 2, wallHeight / 2, halfL);
  scene.add(wallBottomRight);

  const gridHelper = new THREE.GridHelper(40, 40);
  scene.add(gridHelper);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  function render(): void {
    controls.update();
    renderer.render(scene, camera);
  }

  function resize(): void {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  return { scene, camera, renderer, render, resize };
}
