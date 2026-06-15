import * as THREE from 'three';
import { TABLE } from '@flipper/contracts';
import type { BallPosition } from '../../domain/game-state';

export interface Ball {
  mesh: THREE.Mesh;
  setPosition: (position: BallPosition) => void;
  setVisible: (visible: boolean) => void;
  animate: (time: number) => void;
}

const TRAIL_LEN = 10;

export function createBall(scene: THREE.Scene): Ball {
  // Soap-bubble material: transparent, iridescent, low roughness
  const geo = new THREE.SphereGeometry(TABLE.ball.radius, 64, 64);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.04,
    metalness: 0,
    transmission: 0.92,
    thickness: 0.3,
    ior: 1.33,
    iridescence: 1.0,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [100, 400] as [number, number],
    transparent: true,
    opacity: 0.78,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(TABLE.ball.spawn.x, TABLE.ball.spawn.y, TABLE.ball.spawn.z);
  mesh.visible = false;

  // Soft inner glow — pale blue like a soap bubble catching light
  const glow = new THREE.PointLight(0xaaddff, 1.5, 4);
  mesh.add(glow);
  scene.add(mesh);

  // Comet trail — 10 fading spheres, shrinking toward the tail
  const trailHistory: Array<{ x: number; z: number }> = [];
  const trail: Array<{ mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }> = [];

  for (let i = 0; i < TRAIL_LEN; i++) {
    const scale = 1 - (i / TRAIL_LEN) * 0.7;
    const tGeo = new THREE.SphereGeometry(TABLE.ball.radius * scale, 8, 8);
    const tMat = new THREE.MeshBasicMaterial({
      color: 0x88ddff,
      transparent: true,
      opacity: 0,
    });
    const tMesh = new THREE.Mesh(tGeo, tMat);
    tMesh.visible = false;
    scene.add(tMesh);
    trail.push({ mesh: tMesh, mat: tMat });
  }

  return {
    mesh,
    setPosition(position: BallPosition): void {
      trailHistory.unshift({ x: position.x, z: position.z });
      if (trailHistory.length > TRAIL_LEN + 1) trailHistory.pop();
      mesh.position.set(position.x, TABLE.ball.spawn.y, position.z);
    },
    setVisible(visible: boolean): void {
      mesh.visible = visible;
      if (!visible) {
        trail.forEach((t) => {
          t.mesh.visible = false;
        });
        trailHistory.length = 0;
      }
    },
    animate(time: number): void {
      const t = time * 0.001;
      // Oscillate soap-film thickness → shimmering rainbow shimmer
      mat.iridescenceThicknessRange = [
        100 + Math.sin(t * 1.3) * 65,
        400 + Math.cos(t * 0.87) * 105,
      ] as [number, number];

      // Update comet trail
      trail.forEach(({ mesh: tm, mat: tMat }, i) => {
        const pos = trailHistory[i + 1];
        if (pos != null && mesh.visible) {
          tm.visible = true;
          tm.position.set(pos.x, TABLE.ball.spawn.y, pos.z);
          tMat.opacity = (1 - (i + 1) / (TRAIL_LEN + 1)) * 0.5;
        } else {
          tm.visible = false;
        }
      });
    },
  };
}
