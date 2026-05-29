import * as THREE from 'three';
import { TABLE } from '@flipper/contracts';
import type { FlipperState } from '../../domain/game-state';

export interface Flipper {
  object: THREE.Object3D;
  setState: (state: FlipperState) => void;
}

export interface FlipperOptions {
  side: 'left' | 'right';
}

const ROTATION_SPEED = 18;

export function createFlipper(
  scene: THREE.Scene,
  mesh: THREE.Object3D,
  options: FlipperOptions,
): Flipper {
  const { side } = options;
  const sign = side === 'left' ? -1 : 1;
  const restAngle = sign * TABLE.flippers.restAngle;
  const activeAngle = sign * TABLE.flippers.activeAngle;

  // Pivot X and Y from the actual mesh bbox (wall-attachment edge, floor elevation).
  // Pivot Z from TABLE constants — both meshes may have different bbox centres in Z,
  // TABLE values are the physics source of truth and keep both flippers at the same height.
  const box = new THREE.Box3().setFromObject(mesh);
  const center = box.getCenter(new THREE.Vector3());
  const pivotX = side === 'left' ? box.min.x : box.max.x;
  const pivotY = box.min.y;
  const pivotZ = center.z;

  const group = new THREE.Group();
  group.position.set(pivotX, pivotY, pivotZ);
  scene.add(group);
  group.attach(mesh);
  group.rotation.y = restAngle;

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
    object: group,
    setState(state: FlipperState): void {
      if (state.side !== side) return;
      targetAngle = state.active ? activeAngle : restAngle;
    },
  };
}
