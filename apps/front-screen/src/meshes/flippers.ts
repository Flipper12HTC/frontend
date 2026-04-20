import * as THREE from 'three';
import { TABLE } from '@flipper/contracts';

export interface Flipper {
  mesh: THREE.Group;
  setAngle: (angle: number) => void;
}

function buildFlipper(scene: THREE.Scene, side: 'left' | 'right'): Flipper {
  const isLeft = side === 'left';
  const group = new THREE.Group();

  // Corps principal — effilé, sombre et métallique
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(
      isLeft ? 0.15 : 0.04,
      isLeft ? 0.04 : 0.15,
      1.8,
      16,
    ),
    new THREE.MeshStandardMaterial({
      color: 0x8b5e3c,
      metalness: 0,
      roughness: 0.85,
    }),
  );
  body.rotation.z = Math.PI / 2;
  body.position.x = isLeft ? 0.9 : -0.9;
  group.add(body);

  // Liseré néon sur le dessus
  const glowGeo = new THREE.CylinderGeometry(
    isLeft ? 0.155 : 0.045,
    isLeft ? 0.045 : 0.155,
    1.82,
    16,
    1,
    true,
  );
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xa855f7,
    emissive: 0xa855f7,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.4,
    side: THREE.BackSide,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.rotation.z = Math.PI / 2;
  glow.position.x = isLeft ? 0.9 : -0.9;
  group.add(glow);

  // Pivot sphérique
  const pivot = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 16),
    new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0xa855f7,
      emissiveIntensity: 0.6,
      metalness: 1,
      roughness: 0.1,
    }),
  );
  group.add(pivot);

  // Lumière portée
  const light = new THREE.PointLight(0xa855f7, 1.5, 2.5);
  group.add(light);

  group.position.set(isLeft ? -1.8 : 1.8, TABLE.flippers.left.y, 6.5);
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
