import * as THREE from 'three';
import { TABLE } from '@flipper/contracts';

interface JellyfishData {
  group: THREE.Group;
  bellMat: THREE.MeshStandardMaterial;
  tentacles: THREE.Mesh[];
  light: THREE.PointLight;
  baseY: number;
  flashLife: number;
}

export function createAllJellyfish(scene: THREE.Scene): {
  update: (t: number) => void;
  flashById: (id: string) => void;
} {
  const map = new Map<string, JellyfishData>();
  let prevT = -1;

  for (const bumper of TABLE.bumpers) {
    const group = new THREE.Group();
    const baseY = 1.6;
    group.position.set(bumper.x, baseY, bumper.z);

    // Bell — translucent hemisphere (top 60% of sphere)
    const bellGeo = new THREE.SphereGeometry(
      bumper.radius * 0.95,
      14, 8,
      0, Math.PI * 2,
      0, Math.PI * 0.58,
    );
    const bellMat = new THREE.MeshStandardMaterial({
      color: 0xff88cc,
      emissive: 0xff33aa,
      emissiveIntensity: 0.22,
      roughness: 0.12,
      metalness: 0,
      transparent: true,
      opacity: 0.62,
      side: THREE.DoubleSide,
    });
    group.add(new THREE.Mesh(bellGeo, bellMat));

    // Rim ring at the bottom edge of the bell
    const rimGeo = new THREE.TorusGeometry(bumper.radius * 0.92, 0.025, 6, 20);
    const rimMat = new THREE.MeshBasicMaterial({ color: 0xff99ee, transparent: true, opacity: 0.55 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    group.add(rim);

    // Tentacles — 8 thin cylinders hanging below the bell
    const tentacles: THREE.Mesh[] = [];
    const tentMat = new THREE.MeshBasicMaterial({ color: 0xffaaee, transparent: true, opacity: 0.45 });
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const r = bumper.radius * 0.58;
      const length = 0.9 + Math.random() * 0.5;
      const tentGeo = new THREE.CylinderGeometry(0.018, 0.006, length, 4);
      const tent = new THREE.Mesh(tentGeo, tentMat);
      tent.position.set(Math.cos(angle) * r, -(length / 2 + 0.08), Math.sin(angle) * r);
      group.add(tent);
      tentacles.push(tent);
    }

    // Pink glow from inside the bell
    const light = new THREE.PointLight(0xff55cc, 5, 3.5);
    group.add(light);

    scene.add(group);
    map.set(bumper.id, { group, bellMat, tentacles, light, baseY, flashLife: 0 });
  }

  return {
    update(t: number): void {
      const dt = prevT < 0 ? 0 : t - prevT;
      prevT = t;

      for (const [, jf] of map) {
        // Breathing: expand/contract the bell
        const pulse = Math.sin(t * 1.75);
        jf.group.scale.set(1 + pulse * 0.055, 0.88 + pulse * 0.06, 1 + pulse * 0.055);

        // Gentle vertical drift
        jf.group.position.y = jf.baseY + Math.sin(t * 0.82) * 0.16;

        // Tentacle sway — each tentacle gets its own phase
        jf.tentacles.forEach((tent, i) => {
          tent.rotation.z = Math.sin(t * 1.15 + i * 0.78) * 0.22;
          tent.rotation.x = Math.cos(t * 0.88 + i * 0.62) * 0.16;
        });

        // Flash decay
        if (jf.flashLife > 0) {
          jf.flashLife = Math.max(0, jf.flashLife - dt * 1.6);
          jf.bellMat.emissiveIntensity = 0.22 + jf.flashLife * 4.5;
          jf.bellMat.opacity = 0.62 + jf.flashLife * 0.35;
          jf.light.intensity = 5 + jf.flashLife * 35;
          // Flash colour shifts from pink → white-hot
          jf.bellMat.emissive.setRGB(
            1,
            0.2 + jf.flashLife * 0.8,
            0.67 + jf.flashLife * 0.33,
          );
        } else {
          jf.bellMat.emissiveIntensity = 0.22;
          jf.bellMat.opacity = 0.62;
          jf.light.intensity = 5;
          jf.bellMat.emissive.setHex(0xff33aa);
        }
      }
    },

    flashById(id: string): void {
      const jf = map.get(id);
      if (jf) jf.flashLife = 1;
    },
  };
}
