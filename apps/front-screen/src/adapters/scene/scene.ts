import * as THREE from 'three';
import { GLTFLoader, OrbitControls, RoomEnvironment } from 'three/examples/jsm/Addons.js';
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
  renderer.shadowMap.type = THREE.PCFShadowMap;

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
  let debugBallCb: ((pos: { x: number; y: number; z: number }) => void) | null = null;
  let debugGroupRef: { visible: boolean } | null = null;
  let debugEnabled = false;
  let defaultCamY = 30;
  let defaultTargetY = 0;

  const gltfLoader = new GLTFLoader();
  gltfLoader.load('/models/bbbbbase.glb', (gltf) => {
    const root = gltf.scene;

    // Use same reference objects as backend physics (BBOX_MESHES) for scale and XZ centre.
    // getObjectByName matches any Object3D (not just Mesh), handling GLTF node naming.
    const PHYSICS_REF_NAMES = ['col_floor_playfield_blue', 'flipper_left', 'flipper_right'];
    const preScaleRef = new THREE.Box3();
    for (const n of PHYSICS_REF_NAMES) {
      const obj = root.getObjectByName(n);
      if (obj) preScaleRef.expandByObject(obj);
    }
    if (preScaleRef.isEmpty()) preScaleRef.setFromObject(root);

    const rawSize = preScaleRef.getSize(new THREE.Vector3());
    const sx = TABLE.width / rawSize.x;
    const sz = TABLE.depth / rawSize.z;
    const sy = (sx + sz) / 2;
    root.scale.set(sx, sy, sz);

    root.updateWorldMatrix(false, true);

    // Post-scale: recompute for XZ centering.
    const postScaleRef = new THREE.Box3();
    for (const n of PHYSICS_REF_NAMES) {
      const obj = root.getObjectByName(n);
      if (obj) postScaleRef.expandByObject(obj);
    }
    if (postScaleRef.isEmpty()) postScaleRef.setFromObject(root);
    const physicsCenter = postScaleRef.getCenter(new THREE.Vector3());

    // Y: align physics floor (Y=0) to world Y=0 using the minimum Y of physics
    // reference meshes. col_floor_merged.max.y is wrong here because that mesh
    // extends up the walls in the new GLB, pulling the whole model 4 units too low.
    root.position.set(-physicsCenter.x, -postScaleRef.min.y, -physicsCenter.z);

    const base = root.getObjectByName('col_floor_base');
    if (base) base.visible = false;

    scene.add(root);
    root.updateWorldMatrix(true, true);

    // Large flat surfaces stay smooth; everything else gets flat shading.
    const SMOOTH_MESHES = new Set(['col_floor_main', 'col_wall_frame_black']);

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
    // After the alignment fix above, world Y=0 = physics floor.
    const pfTopY = 0;
    const halfFov = (camera.fov * Math.PI) / 180 / 2;
    const camHeight = pfTopY + ((TABLE.depth / 2) / Math.tan(halfFov)) * 1.15;
    defaultCamY = camHeight;
    defaultTargetY = pfTopY;
    controls.target.set(0, pfTopY, 0);
    camera.position.set(0, camHeight, 0);
    camera.lookAt(0, pfTopY, 0);
    controls.update();

    // --- Physics debug overlay (hidden by default, toggle with D key) ---
    const debug = createPhysicsDebug(root);
    scene.add(debug.group);
    debugBallCb = debug.updateBall;
    debugGroupRef = debug.group;

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
    toggleDebug() {
      debugEnabled = !debugEnabled;
      if (debugGroupRef) debugGroupRef.visible = debugEnabled;
      controls.enableRotate = debugEnabled;
      if (!debugEnabled) {
        // Reset to default top-down view when leaving debug mode.
        controls.target.set(0, defaultTargetY, 0);
        camera.position.set(0, defaultCamY, 0);
        camera.up.set(0, 0, -1);
        controls.update();
      }
    },
    updateDebugBall(pos) {
      debugBallCb?.(pos);
    },
  };
}
