import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import { TABLE } from '@flipper/contracts';

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  render: () => void;
  resize: () => void;
}

// Internal render resolution — canvas always renders at this size, CSS letterboxes to fit screen.
const RENDER_WIDTH = 1080;
const RENDER_HEIGHT = 1920;

export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0f);

  const camera = new THREE.PerspectiveCamera(50, RENDER_WIDTH / RENDER_HEIGHT, 0.1, 1000);
  camera.up.set(0, 0, -1);
  camera.position.set(0, 22, 6);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(RENDER_WIDTH, RENDER_HEIGHT, false);

  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  const pointLight = new THREE.PointLight(0xffffff, 200);
  pointLight.position.set(0, 15, 5);
  scene.add(pointLight);

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
      const normalize = b.radius / tplRadius;
      instance.scale.setScalar(normalize * b.scale);
      instance.position.set(b.x, 0.4, b.z);
      scene.add(instance);
    }
  });

  function render(): void {
    renderer.render(scene, camera);
  }

  function resize(): void {
    // no-op: render resolution stays fixed, CSS handles screen-fit letterbox
  }

  return { scene, camera, renderer, render, resize };
}
