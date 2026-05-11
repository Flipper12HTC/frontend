import * as THREE from 'three';
import { TABLE } from '@flipper/contracts';
import type { BallPosition } from '../../domain/game-state';

export interface Ball {
  mesh: THREE.Mesh;
  setPosition: (position: BallPosition) => void;
  setVisible: (visible: boolean) => void;
}

const TRAIL_LENGTH = 24;

export function createBall(scene: THREE.Scene): Ball {
  // Bille
  const geo = new THREE.SphereGeometry(TABLE.ball.radius, 32, 32);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xdcecff,
    roughness: 0.1,
    metalness: 0.85,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(TABLE.ball.spawn.x, TABLE.ball.spawn.y, TABLE.ball.spawn.z);
  mesh.visible = false;

  const ballGlow = new THREE.PointLight(0x7dd3fc, 4, 5);
  mesh.add(ballGlow);
  scene.add(mesh);

  // Traînée de glace
  const trailPos = new Float32Array(TRAIL_LENGTH * 3);
  const trailCol = new Float32Array(TRAIL_LENGTH * 3);

  for (let i = 0; i < TRAIL_LENGTH; i++) {
    trailPos[i * 3]     = TABLE.ball.spawn.x;
    trailPos[i * 3 + 1] = TABLE.ball.spawn.y;
    trailPos[i * 3 + 2] = TABLE.ball.spawn.z;
  }

  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('color',    new THREE.BufferAttribute(trailCol, 3));

  const trailMat = new THREE.PointsMaterial({
    size: 0.28,
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    sizeAttenuation: true,
  });

  scene.add(new THREE.Points(trailGeo, trailMat));

  return {
    mesh,
    setPosition(pos: BallPosition): void {
      const y = TABLE.ball.spawn.y;
      mesh.position.set(pos.x, y, pos.z);

      // Décale la traînée (insertion en tête)
      for (let i = TRAIL_LENGTH - 1; i > 0; i--) {
        trailPos[i * 3]     = trailPos[(i - 1) * 3]!;
        trailPos[i * 3 + 1] = trailPos[(i - 1) * 3 + 1]!;
        trailPos[i * 3 + 2] = trailPos[(i - 1) * 3 + 2]!;
      }
      trailPos[0] = pos.x;
      trailPos[1] = y + 0.05;
      trailPos[2] = pos.z;

      // Couleur ice-blue qui s'estompe vers la queue
      for (let i = 0; i < TRAIL_LENGTH; i++) {
        const t = Math.pow(1 - i / TRAIL_LENGTH, 1.6);
        trailCol[i * 3]     = t * 0.49;
        trailCol[i * 3 + 1] = t * 0.83;
        trailCol[i * 3 + 2] = t * 0.99;
      }

      (trailGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (trailGeo.attributes.color    as THREE.BufferAttribute).needsUpdate = true;
    },
    setVisible(visible: boolean): void {
      mesh.visible = visible;
    },
  };
}
