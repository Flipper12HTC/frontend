import * as THREE from 'three';
import { TABLE } from '@flipper/contracts';

export interface Flipper {
  mesh: THREE.Group;
  setAngle: (angle: number) => void;
}

function buildFlipper(scene: THREE.Scene, side: 'left' | 'right'): Flipper {
  const isLeft = side === 'left';
  const pos = isLeft ? TABLE.flippers.left : TABLE.flippers.right;
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(
      isLeft ? 0.15 : 0.05,
      isLeft ? 0.05 : 0.15,
      1.5,
      8,
    ),
    new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.2, roughness: 0.2 }),
  );
  body.rotation.z = Math.PI / 2;
  body.position.x = isLeft ? 0.75 : -0.75;
  group.add(body);

  group.position.set(isLeft ? -1.8 : 1.8, pos.y, 6.5);
  group.rotation.y = TABLE.flippers.restAngle * (isLeft ? 1 : -1);
  scene.add(group);

  return {
    mesh: group,
    setAngle(angle: number): void {
      group.rotation.y = angle * (isLeft ? 1 : -1);
    },
  };
}

export interface Flippers {
  left: Flipper;
  right: Flipper;
}

export function createFlippers(scene: THREE.Scene): Flippers {
  return {
    left: buildFlipper(scene, 'left'),
    right: buildFlipper(scene, 'right'),
  };
}
