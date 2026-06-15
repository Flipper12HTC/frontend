import * as THREE from 'three';
import { TABLE } from '@flipper/contracts';
import type { BallPosition } from '../../domain/game-state';

export interface Ball {
  mesh: THREE.Mesh;
  setPosition: (position: BallPosition) => void;
  setVisible: (visible: boolean) => void;
  animate: (time: number) => void;
}

export function createBall(scene: THREE.Scene): Ball {
  const geo = new THREE.SphereGeometry(TABLE.ball.radius, 64, 64);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.05,
    metalness: 0,
    transmission: 0.92,
    thickness: 0.3,
    ior: 1.33,
    iridescence: 1.0,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [100, 400],
    transparent: true,
    opacity: 0.75,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(TABLE.ball.spawn.x, TABLE.ball.spawn.y, TABLE.ball.spawn.z);
  mesh.visible = false;

  // Soft inner glow — pale blue like a soap bubble catching light
  const light = new THREE.PointLight(0xaaddff, 1.5, 4);
  mesh.add(light);
  scene.add(mesh);

  return {
    mesh,
    setPosition(position: BallPosition): void {
      mesh.position.set(position.x, TABLE.ball.spawn.y, position.z);
    },
    setVisible(visible: boolean): void {
      mesh.visible = visible;
    },
    animate(time: number): void {
      // Oscillate soap film thickness to simulate iridescent shimmer
      const t = time * 0.001;
      mat.iridescenceThicknessRange = [
        100 + Math.sin(t * 1.3) * 60,
        400 + Math.cos(t * 0.9) * 100,
      ];
    },
  };
}
