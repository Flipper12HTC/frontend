import * as THREE from 'three';
import { TABLE } from '@flipper/contracts';
import type { FlipperState } from '../../domain/game-state';

export interface Flipper {
  mesh: THREE.Mesh;
  setState: (state: FlipperState) => void;
}

export interface FlipperOptions {
  side: 'left' | 'right';
}

const THICKNESS = 0.4;
const BASE_HALF_HEIGHT = 0.35;
const TIP_HALF_HEIGHT = 0.18;
const ROTATION_SPEED = 18;

export function createFlipper(scene: THREE.Scene, options: FlipperOptions): Flipper {
  const { side } = options;
  const length = TABLE.flippers.length;
  const pivot = side === 'left' ? TABLE.flippers.left : TABLE.flippers.right;

  const shape = new THREE.Shape();
  shape.moveTo(0, -BASE_HALF_HEIGHT);
  shape.lineTo(length, -TIP_HALF_HEIGHT);
  shape.lineTo(length, TIP_HALF_HEIGHT);
  shape.lineTo(0, BASE_HALF_HEIGHT);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: THICKNESS,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -THICKNESS / 2);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.MeshStandardMaterial({
    color: side === 'left' ? 0xef4444 : 0x3b82f6,
    roughness: 0.4,
    metalness: 0.6,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pivot.x, pivot.y, pivot.z);

  const sign = side === 'left' ? -1 : 1;
  const restAngle = sign * TABLE.flippers.restAngle;
  const activeAngle = sign * TABLE.flippers.activeAngle;

  if (side === 'right') {
    mesh.scale.x = -1;
  }
  mesh.rotation.y = restAngle;

  scene.add(mesh);

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
    mesh.rotation.y = currentAngle;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return {
    mesh,
    setState(state: FlipperState): void {
      if (state.side !== side) return;
      targetAngle = state.active ? activeAngle : restAngle;
    },
  };
}
