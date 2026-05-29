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

  const ambient = new THREE.AmbientLight(0xaaccff, 0.4);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffffff, 3);
  keyLight.position.set(-6, 10, 4);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x88bbff, 1.5);
  fillLight.position.set(6, 8, -4);
  scene.add(fillLight);

  const texLoader = new THREE.TextureLoader();

  const snowTex = texLoader.load('/snow_01_2k/textures/snow_01_diff_2k.jpg');
  snowTex.wrapS = snowTex.wrapT = THREE.RepeatWrapping;
  const snowMat = new THREE.MeshStandardMaterial({ map: snowTex, roughness: 0.9, metalness: 0 });
  snowMat.onBeforeCompile = (shader) => {
    shader.vertexShader = `varying vec3 vWPos;\n` + shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(position, 1.0)).xyz;',
    );
    shader.fragmentShader = `varying vec3 vWPos;\n` + shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D(map, vWPos.xz * 0.12);
        diffuseColor *= sampledDiffuseColor;
      #endif`,
    );
  };


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

    base.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = snowMat;
      }
    });

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
