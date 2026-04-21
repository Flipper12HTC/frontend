export const TABLE = {
  width: 16,
  depth: 9,
  floorThickness: 0.04,
  wall: {
    height: 1.3,
    thickness: 0.4,
  },

  flippers: {
    left: { x: -3, y: 0.4, z: 3.5 },
    right: { x: 3, y: 0.4, z: 3.5 },
    length: 3,
    restAngle: 0.3,
    activeAngle: -0.5,
  },

  ball: {
    radius: 0.4,
    spawn: { x: 0, y: 0.4, z: 0 },
  },
} as const;
