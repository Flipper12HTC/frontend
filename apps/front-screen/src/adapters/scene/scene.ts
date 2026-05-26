import * as THREE from 'three';
import { GLTFLoader, OrbitControls, RoomEnvironment } from 'three/examples/jsm/Addons.js';
import { TABLE } from '@flipper/contracts';

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
}

const RENDER_WIDTH = 1080;
const RENDER_HEIGHT = 1920;

export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0f);

  const camera = new THREE.PerspectiveCamera(50, RENDER_WIDTH / RENDER_HEIGHT, 0.1, 1000);
  camera.up.set(0, 0, -1);
  camera.position.set(0, 30, 0);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(RENDER_WIDTH, RENDER_HEIGHT, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.75;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Environment map — soft studio reflections, kept dim so material colours aren't washed out.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment()).texture;
  scene.environmentIntensity = 0.4;
  pmrem.dispose();

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  // Rotation disabled — tilt causes perspective blur; this is a fixed display screen.
  controls.enableRotate = false;

  // Very low ambient — environment already handles indirect light.
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));

  // Key light — casts soft shadows
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(5, 15, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near = 0.1;
  keyLight.shadow.camera.far = 60;
  keyLight.shadow.camera.left = -6;
  keyLight.shadow.camera.right = 6;
  keyLight.shadow.camera.top = 10;
  keyLight.shadow.camera.bottom = -10;
  keyLight.shadow.bias = -0.001;
  scene.add(keyLight);

  // Fill light — warm, no shadows
  const fillLight = new THREE.DirectionalLight(0xffeedd, 0.5);
  fillLight.position.set(-5, 10, -5);
  scene.add(fillLight);

  let meshReadyCb: ((meshes: PinballMeshes) => void) | null = null;

  const gltfLoader = new GLTFLoader();
  gltfLoader.load('/models/pinball_map_v4.glb', (gltf) => {
    const root = gltf.scene;

    const rawBox = new THREE.Box3().setFromObject(root);
    const rawSize = rawBox.getSize(new THREE.Vector3());
    const sx = TABLE.width / rawSize.x;
    const sz = TABLE.depth / rawSize.z;
    const sy = (sx + sz) / 2;
    root.scale.set(sx, sy, sz);

    root.updateWorldMatrix(false, true);

    const pfRef = root.getObjectByName('floor_merged');
    const refBox = pfRef
      ? new THREE.Box3().setFromObject(pfRef)
      : new THREE.Box3().setFromObject(root);
    const refCenter = refBox.getCenter(new THREE.Vector3());

    root.position.set(-refCenter.x, -refBox.min.y, -refCenter.z);

    const base = root.getObjectByName('floor_base');
    if (base) base.visible = false;

    scene.add(root);
    root.updateWorldMatrix(true, true);

    // Large flat surfaces stay smooth; everything else gets flat shading.
    const SMOOTH_MESHES = new Set(['floor_merged', 'floor_playfield', 'wall_main', 'wall_frame_black']);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      const useFlatShading = !SMOOTH_MESHES.has(obj.name);
      // GLTF geometry is indexed (shared vertices). flatShading needs each face
      // to have its own vertices with its own normal — convert to non-indexed first.
      const geo = obj.geometry as THREE.BufferGeometry;
      if (useFlatShading && geo.index !== null) {
        obj.geometry = geo.toNonIndexed();
      }
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        const mat = m as THREE.MeshStandardMaterial;
        if (useFlatShading) {
          mat.flatShading = true;
          mat.needsUpdate = true;
        }
        for (const tex of [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap]) {
          if (tex) {
            tex.anisotropy = maxAnisotropy;
            tex.needsUpdate = true;
          }
        }
      }
    });

    // --- Camera ---
    const pfFinal = root.getObjectByName('floor_merged');
    const pfTopY = pfFinal
      ? new THREE.Box3().setFromObject(pfFinal).max.y
      : 0;

    const halfFov = (camera.fov * Math.PI) / 180 / 2;
    const camHeight = pfTopY + ((TABLE.depth / 2) / Math.tan(halfFov)) * 1.15;
    controls.target.set(0, pfTopY, 0);
    camera.position.set(0, camHeight, 0);
    camera.lookAt(0, pfTopY, 0);
    controls.update();

    // --- Flipper meshes for animation ---
    const flipperLeft = root.getObjectByName('flipper_left');
    const flipperRight = root.getObjectByName('flipper_right');
    if (flipperLeft && flipperRight && meshReadyCb) {
      meshReadyCb({ flipperLeft, flipperRight });
    }
  });

  function render(): void {
    controls.update();
    renderer.render(scene, camera);
  }

  function resize(): void {
    // Fixed render resolution — CSS letterboxes to fit the screen.
  }

  return {
    scene,
    camera,
    renderer,
    render,
    resize,
    onMeshesReady(cb) {
      meshReadyCb = cb;
    },
  };
}
