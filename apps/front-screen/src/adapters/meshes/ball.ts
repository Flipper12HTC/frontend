import * as THREE from 'three';
import { TABLE } from '@flipper/contracts';
import type { BallPosition } from '../../domain/game-state';

export interface Ball {
  mesh: THREE.Mesh;
  setPosition: (position: BallPosition) => void;
}

export function createBall(scene: THREE.Scene): Ball {
  const geo = new THREE.SphereGeometry(TABLE.ball.radius, 32, 32);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xc0c0c0,
    roughness: 0.2,
    metalness: 0.9,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(TABLE.ball.spawn.x, TABLE.ball.spawn.y, TABLE.ball.spawn.z);

  const light = new THREE.PointLight(0x06b6d4, 2, 6);
  mesh.add(light);
  scene.add(mesh);

  return {
    mesh,
    setPosition(position: BallPosition): void {
      mesh.position.set(position.x, TABLE.ball.spawn.y, position.z);
    },
  };
}
