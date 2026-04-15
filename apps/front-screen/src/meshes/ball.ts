import * as THREE from 'three';

export interface Ball {
  mesh: THREE.Mesh;
  setPosition: (x: number, y: number, z: number) => void;
}

export function createBall(scene: THREE.Scene): Ball {
  const geo = new THREE.SphereGeometry(0.4, 32, 32);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xc0c0c0,
    roughness: 0.2,
    metalness: 0.9,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 0.4, 0);

  const light = new THREE.PointLight(0x06b6d4, 2, 6);
  mesh.add(light);

  scene.add(mesh);

  return {
    mesh,
    setPosition(x: number, y: number, z: number): void {
      mesh.position.set(x, 0.4, z === 0 ? y : z);
    },
  };
}
