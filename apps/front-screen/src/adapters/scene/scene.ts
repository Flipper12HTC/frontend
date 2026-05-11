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

function addRoundedCorner(
  scene: THREE.Scene,
  material: THREE.Material,
  cx: number,
  cz: number,
  radius: number,
  height: number,
  thickness: number,
  corner: 'topLeft' | 'topRight',
): void {
  const segments = 3;
  const chord = 2 * radius * Math.sin(Math.PI / (4 * segments));
  const xSign = corner === 'topRight' ? 1 : -1;

  for (let i = 0; i < segments; i++) {
    const angle = -((i + 0.5) * Math.PI) / (2 * segments);
    const x = cx + xSign * radius * Math.cos(angle);
    const z = cz + radius * Math.sin(angle);
    const yaw = corner === 'topRight' ? -Math.PI / 2 - angle : Math.PI / 2 + angle;

    const seg = new THREE.Mesh(
      new THREE.BoxGeometry(chord, height, thickness),
      material,
    );
    seg.position.set(x, height / 2, z);
    seg.rotation.y = yaw;
    scene.add(seg);
  }
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
  const halfW = TABLE.width / 2;
  const halfD = TABLE.depth / 2;
  const r = TABLE.cornerRadius;

  // Side walls: shortened at the top to leave room for the rounded corners
  const sideLength = TABLE.depth - r;
  const sideCenterZ = r / 2;

  const wallLeft = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, wallHeight, sideLength),
    wallMaterial,
  );
  wallLeft.position.set(-halfW, wallHeight / 2, sideCenterZ);
  scene.add(wallLeft);

  const wallRight = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, wallHeight, sideLength),
    wallMaterial,
  );
  wallRight.position.set(halfW, wallHeight / 2, sideCenterZ);
  scene.add(wallRight);

  // Top wall: shortened on both ends to leave room for the rounded corners
  const topLength = TABLE.width - 2 * r;
  const wallTop = new THREE.Mesh(
    new THREE.BoxGeometry(topLength, wallHeight, wallThickness),
    wallMaterial,
  );
  wallTop.position.set(0, wallHeight / 2, -halfD);
  scene.add(wallTop);

  // Bottom wall: split into two segments with a central drain gap
  const drainGap = TABLE.drain.gap;
  const bottomSideLength = (TABLE.width - drainGap) / 2;
  const bottomSideX = (drainGap + bottomSideLength) / 2;

  const wallBottomLeft = new THREE.Mesh(
    new THREE.BoxGeometry(bottomSideLength, wallHeight, wallThickness),
    wallMaterial,
  );
  wallBottomLeft.position.set(-bottomSideX, wallHeight / 2, halfD);
  scene.add(wallBottomLeft);

  const wallBottomRight = new THREE.Mesh(
    new THREE.BoxGeometry(bottomSideLength, wallHeight, wallThickness),
    wallMaterial,
  );
  wallBottomRight.position.set(bottomSideX, wallHeight / 2, halfD);
  scene.add(wallBottomRight);

  addRoundedCorner(scene, wallMaterial, halfW - r, -halfD + r, r, wallHeight, wallThickness, 'topRight');
  addRoundedCorner(scene, wallMaterial, -halfW + r, -halfD + r, r, wallHeight, wallThickness, 'topLeft');

  // Launch lane separator (right side)
  const lane = TABLE.launchLane;
  const sepLength = lane.zMax - lane.zMin;
  const sepCenterZ2 = (lane.zMax + lane.zMin) / 2;
  const wallSeparator = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, wallHeight, sepLength),
    wallMaterial,
  );
  wallSeparator.position.set(lane.separatorX, wallHeight / 2, sepCenterZ2);
  scene.add(wallSeparator);

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
