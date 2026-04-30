import * as THREE from 'three';
import { TABLE } from '@flipper/contracts';

export interface FlippersContext {
  setLeftAngle: (angle: number) => void;
  setRightAngle: (angle: number) => void;
}

function buildFlipperShape(): THREE.Shape {
  const len = TABLE.flippers.length;
  const r1 = 0.28; // rayon côté pivot (épais)
  const r2 = 0.09; // rayon côté pointe (fin)

  const shape = new THREE.Shape();
  shape.moveTo(0, r1);
  shape.lineTo(len - r2, r2);
  shape.absarc(len - r2, 0, r2, Math.PI / 2, -Math.PI / 2, false);
  shape.lineTo(0, -r1);
  shape.absarc(0, 0, r1, -Math.PI / 2, Math.PI / 2, false);
  return shape;
}

export function createFlippers(tableGroup: THREE.Group): FlippersContext {
  const shape = buildFlipperShape();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.2,
    bevelEnabled: true,
    bevelSize: 0.025,
    bevelThickness: 0.025,
    bevelSegments: 4,
  });

  const material = new THREE.MeshStandardMaterial({
    color: 0x7ec8e8,
    metalness: 0.85,
    roughness: 0.08,
    emissive: new THREE.Color(0x0a2a40),
    emissiveIntensity: 0.35,
  });

  function makeFlipper(isLeft: boolean): THREE.Group {
    const pivot = new THREE.Group();

    const mesh = new THREE.Mesh(geo, material);
    // Profil dessiné dans le plan XY → couché à plat sur la table (plan XZ)
    mesh.rotation.x = -Math.PI / 2;
    // Pour le flipper droit : miroir sur X
    if (!isLeft) mesh.scale.x = -1;

    pivot.add(mesh);

    const pos = isLeft ? TABLE.flippers.left : TABLE.flippers.right;
    pivot.position.set(pos.x, TABLE.floorThickness / 2, pos.z);
    pivot.rotation.y = TABLE.flippers.restAngle * (isLeft ? 1 : -1);

    tableGroup.add(pivot);
    return pivot;
  }

  const leftPivot = makeFlipper(true);
  const rightPivot = makeFlipper(false);

  return {
    setLeftAngle(angle: number) {
      leftPivot.rotation.y = angle;
    },
    setRightAngle(angle: number) {
      rightPivot.rotation.y = angle;
    },
  };
}
