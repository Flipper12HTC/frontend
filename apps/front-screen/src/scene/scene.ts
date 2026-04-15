import * as THREE from 'three';

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  render: () => void;
  resize: () => void;
}

export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0f);

  const aspect = window.innerWidth / window.innerHeight;
  const frustum = 12;
  const camera = new THREE.OrthographicCamera(
    -frustum * aspect,
    frustum * aspect,
    frustum,
    -frustum,
    0.1,
    100,
  );
  camera.position.set(0, 10, 20);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);

  const dir = new THREE.DirectionalLight(0xa855f7, 1.5);
  dir.position.set(5, 10, 5);
  scene.add(dir);

  const tableGeo = new THREE.PlaneGeometry(16, 24);
  const tableMat = new THREE.MeshStandardMaterial({
    color: 0x12121a,
    roughness: 0.8,
  });
  const table = new THREE.Mesh(tableGeo, tableMat);
  table.rotation.x = -Math.PI / 2;
  scene.add(table);

  const borderGeo = new THREE.EdgesGeometry(tableGeo);
  const borderMat = new THREE.LineBasicMaterial({ color: 0xa855f7 });
  const border = new THREE.LineSegments(borderGeo, borderMat);
  border.rotation.x = -Math.PI / 2;
  scene.add(border);

  function render(): void {
    renderer.render(scene, camera);
  }

  function resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const a = w / h;
    camera.left = -frustum * a;
    camera.right = frustum * a;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  return { scene, camera, renderer, render, resize };
}