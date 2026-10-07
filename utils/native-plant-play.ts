import type { Vec3 } from '@/utils/native-room-world';

export const LEAF_REGROW_DELAY = 6;
export const LEAF_REGROW_DURATION = 20;
export type PlantLeafState = { age: number; position: Vec3; velocity: Vec3; angle: number; scale: number };

export function attachedPlantLeaf(): PlantLeafState {
  'worklet';
  return { age: -1, position: [0, 0, 0], velocity: [0, 0, 0], angle: 0, scale: 1 };
}

export function detachPlantLeaf(position: Vec3, paw: Vec3, index: number): PlantLeafState {
  'worklet';
  const dx = position[0] - paw[0], dz = position[2] - paw[2];
  const length = Math.max(.01, Math.hypot(dx, dz));
  return { age: 0, position: [...position], velocity: [dx / length * .24, .35, dz / length * .24],
    angle: index % 2 ? -.15 : .15, scale: 1 };
}

/** Detached leaves flutter down, disappear from the floor, then unfurl on the stem. */
export function advancePlantLeaf(state: PlantLeafState, dt: number, floor: number): PlantLeafState {
  'worklet';
  if (state.age < 0) return state;
  const age = state.age + dt;
  if (age >= LEAF_REGROW_DELAY + LEAF_REGROW_DURATION) return attachedPlantLeaf();
  const position = [...state.position] as Vec3, velocity = [...state.velocity] as Vec3;
  if (age < 4) {
    const steps = Math.max(1, Math.ceil(dt * 120)), h = dt / steps;
    for (let i = 0; i < steps; i++) {
      velocity[1] -= 2.8 * h;
      for (let k = 0; k < 3; k++) position[k] += velocity[k] * h;
      // Room walls keep the fallen leaf reachable, including corner plants.
      for (const k of [0, 2]) if (Math.abs(position[k]) > 2.28) {
        position[k] = Math.sign(position[k]) * 2.28; velocity[k] *= -.2;
      }
      if (position[1] <= floor) {
        position[1] = floor; velocity[1] = 0;
        velocity[0] *= Math.exp(-8 * h); velocity[2] *= Math.exp(-8 * h);
      }
    }
  }
  const angle = position[1] > floor + .001 ? Math.sin(age * 8) * .45 : state.angle * Math.exp(-dt * 8);
  const growth = Math.max(0, Math.min(1, (age - LEAF_REGROW_DELAY) / LEAF_REGROW_DURATION));
  const scale = age < 3 ? 1 : age < 4 ? 4 - age : growth * growth * (3 - 2 * growth);
  return { age, position, velocity, angle, scale };
}
