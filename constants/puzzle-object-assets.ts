import type { PuzzleObject } from "@/types/puzzle-object";

// Rendered in Blender; editable scenes live in prototypes/puzzle-objects/.
const OBJECTS: Record<PuzzleObject, number> = {
  mouse: require("@/assets/3d/puzzle-objects/mouse.png"),
  ribbon: require("@/assets/3d/puzzle-objects/ribbon-blue.png"),
  star: require("@/assets/3d/puzzle-objects/star.png"),
  cookie: require("@/assets/3d/puzzle-objects/cookie.png"),
  parcel: require("@/assets/3d/puzzle-objects/parcel.png"),
  planting_tile: require("@/assets/3d/puzzle-objects/planting-tile.png"),
  carriage: require("@/assets/3d/puzzle-objects/carriage.png"),
  book: require("@/assets/icons/book.png"),
  shell: require("@/assets/icons/shell.png"),
  leaf: require("@/assets/icons/weather-leaves.png"),
  chair: require("@/assets/icons/chair.png"),
  guest: require("@/assets/icons/person.png"),
  plant: require("@/assets/icons/plant.png"),
  coin: require("@/assets/icons/coin.png"),
  ball: require("@/assets/icons/ball.png"),
  box: require("@/assets/icons/box.png"),
};
const RED_RIBBON = require("@/assets/3d/puzzle-objects/ribbon-red.png");
const RED_STAR = require("@/assets/3d/puzzle-objects/star-red.png");

export function getPuzzleObjectAsset(object: PuzzleObject, primary = false): number {
  if (primary && object === "ribbon") return RED_RIBBON;
  if (primary && object === "star") return RED_STAR;
  return OBJECTS[object];
}
