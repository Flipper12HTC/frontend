import * as THREE from 'three';
import { TABLE } from '@flipper/contracts';
import type { BallPosition } from '../../domain/game-state';

export interface Ball {
  mesh: THREE.Mesh;
  setPosition: (position: BallPosition) => void;
  setVisible: (visible: boolean) => void;
}

export function createBall(scene: THREE.Scene): Ball {
  const geo = new THREE.SphereGeometry(TABLE.ball.radius * 1.0, 32, 32);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xb0b8c1,
    roughness: 0.15,
    metalness: 0.85,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(TABLE.ball.spawn.x, TABLE.ball.spawn.y, TABLE.ball.spawn.z);
  mesh.visible = false;

  const light = new THREE.PointLight(0xffffff, 1.5, 4);
  mesh.add(light);
  scene.add(mesh);

  return {
    mesh,
    setPosition(position: BallPosition): void {
      mesh.position.set(position.x, position.y, position.z);
    },
    setVisible(visible: boolean): void {
      mesh.visible = visible;
    },
  };
}
