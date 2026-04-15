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


  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
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

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(TABLE.width, TABLE.floorThickness, TABLE.depth),
    new THREE.MeshStandardMaterial({ color: 0x06402b }),
  );
  scene.add(base);

  const textureLoader = new THREE.TextureLoader();
  const cuirTexture = textureLoader.load('/cuir.jpg');
  const wallMaterial = new THREE.MeshStandardMaterial({ map: cuirTexture });
  const { height: wallHeight, thickness: wallThickness } = TABLE.wall;
  const wallLongSize = TABLE.width + wallThickness;
  const halfW = TABLE.width / 2;
  const halfD = TABLE.depth / 2;

  const wallLeft = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, wallHeight, TABLE.depth),
    wallMaterial,
  );
  wallLeft.position.set(-halfW, wallHeight / 2, 0);
  scene.add(wallLeft);

  const wallRight = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, wallHeight, TABLE.depth),
    wallMaterial,
  );
  wallRight.position.set(halfW, wallHeight / 2, 0);
  scene.add(wallRight);

  const wallTop = new THREE.Mesh(
    new THREE.BoxGeometry(wallLongSize, wallHeight, wallThickness),
    wallMaterial,
  );
  wallTop.position.set(0, wallHeight / 2, -halfD);
  scene.add(wallTop);

  const wallBottom = new THREE.Mesh(
    new THREE.BoxGeometry(wallLongSize, wallHeight, wallThickness),
    wallMaterial,
  );
  wallBottom.position.set(0, wallHeight / 2, halfD);
  scene.add(wallBottom);

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

