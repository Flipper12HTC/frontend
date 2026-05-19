import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import { TABLE } from '@flipper/contracts';
import type { FlipperState } from '../../domain/game-state';

export interface Flipper {
  mesh: THREE.Object3D;
  setState: (state: FlipperState) => void;
}

export interface FlipperOptions {
  side: 'left' | 'right';
}

const ROTATION_SPEED = 18;
const VISUAL_SCALE = 1.4;
const X_OFFSET = 0.4;
const loader = new GLTFLoader();

export function createFlipper(scene: THREE.Scene, options: FlipperOptions): Flipper {
  const { side } = options;
  const pivot = side === 'left' ? TABLE.flippers.left : TABLE.flippers.right;

  const sign = side === 'left' ? -1 : 1;
  const restAngle = sign * TABLE.flippers.restAngle;
  const activeAngle = sign * TABLE.flippers.activeAngle;

  const group = new THREE.Group();
  const xPos = pivot.x + (side === 'left' ? X_OFFSET : -X_OFFSET);
  group.position.set(xPos, pivot.y, pivot.z);
  group.scale.setScalar(VISUAL_SCALE);
  group.rotation.y = restAngle;
  scene.add(group);

  loader.load('/models/PaletteFlipper.glb', (gltf) => {
    const model = gltf.scene;
    if (side === 'right') model.rotation.y = Math.PI;
    group.add(model);
  });

  let targetAngle = restAngle;
  let currentAngle = restAngle;
  let lastTime = performance.now();

  function tick(): void {
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    const delta = targetAngle - currentAngle;
    const step = Math.sign(delta) * Math.min(Math.abs(delta), ROTATION_SPEED * dt);
    currentAngle += step;
    group.rotation.y = currentAngle;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return {
    mesh: group,
    setState(state: FlipperState): void {
      if (state.side !== side) return;
      targetAngle = state.active ? activeAngle : restAngle;
    },
  };
}
