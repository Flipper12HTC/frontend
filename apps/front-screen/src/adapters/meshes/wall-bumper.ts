import * as THREE from 'three';

export interface WallBumperConfig {
  id: string;
  x: number;
  z: number;
  /** Length along the wall (Z axis for side walls, X axis for top/bottom). Default 2. */
  length?: number;
  /** Rotation around Y axis in radians. Default 0 (side wall). Use Math.PI/2 for top/bottom walls. */
  rotationY?: number;
  /** Hex color. Default 0xff6600. */
  color?: number;
}

export interface WallBumper {
  id: string;
  flash: () => void;
}

const THICKNESS = 0.18;
const HEIGHT = 0.45;
const BASE_EMISSIVE = 0.35;
const HIT_EMISSIVE = 3.5;
const FLASH_MS = 160;

export function createWallBumper(scene: THREE.Scene, config: WallBumperConfig): WallBumper {
  const length = config.length ?? 2;
  const color = config.color ?? 0xff6600;

  const geo = new THREE.BoxGeometry(THICKNESS, HEIGHT, length);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: BASE_EMISSIVE,
    roughness: 0.25,
    metalness: 0.6,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(config.x, 0.4, config.z);
  if (config.rotationY) mesh.rotation.y = config.rotationY;
  scene.add(mesh);

  let timer: ReturnType<typeof setTimeout> | null = null;

  function flash(): void {
    mat.emissiveIntensity = HIT_EMISSIVE;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      mat.emissiveIntensity = BASE_EMISSIVE;
      timer = null;
    }, FLASH_MS);
  }

  return { id: config.id, flash };
}
