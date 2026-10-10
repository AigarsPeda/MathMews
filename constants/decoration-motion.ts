export function isAirConditionerDecorationId(id: string): boolean {
  return id === "livingAirCon" || id === "officeAc";
}

export function isWallSpotlightDecorationId(id: string): boolean {
  return /^wallSpot(Cylinder|Bell|Bar)(Black|White|Brass|Rose|Oak|Chrome)$/.test(id);
}

export const DEFAULT_SPOTLIGHT_ANGLE = -25;
export function normalizeSpotlightAngle(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(-180, Math.min(75, value)) : DEFAULT_SPOTLIGHT_ANGLE;
}

export function normalizeSpotlightSwivel(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(-85, Math.min(85, value)) : 0;
}

export const SPOTLIGHT_PIVOT: [number, number, number] = [0, .30, .40];

export const LAMP_LIGHT_ORIGINS: Record<string, [number, number, number]> = {
  wallSpotCylinderBlack: [0, .14, .40],
  wallSpotCylinderWhite: [0, .14, .40],
  wallSpotBellBrass: [0, .14, .40],
  wallSpotBellRose: [0, .14, .40],
  wallSpotBarOak: [0, .14, .40],
  wallSpotBarChrome: [0, .14, .40],
  lampFloorArc: [.72, 1.33, 0],
  lampFloorTripod: [0, 1.30, 0],
  lampFloorPaper: [0, .80, 0],
  lampTableMushroom: [0, .35, 0],
  lampTableCeramic: [0, .44, 0],
  lampTableBanker: [0, .54, .025],
  bedroomFloorLamp: [0, 1.36, 0],
  japaneseLamp: [0, .20, 0],
  lavaLampOff: [0, .70, 0],
  lavaLampAni: [0, .70, 0],
};

export function isLampDecorationId(id: string): boolean {
  return Object.hasOwn(LAMP_LIGHT_ORIGINS, id);
}

export function isPoweredDecorationId(id: string): boolean {
  return isAirConditionerDecorationId(id) || isLampDecorationId(id);
}

export function isCurtainDecorationId(id: string): boolean {
  return id === "curtainRoseTieback" || id === "curtainBlueDrape" || id === "curtainCreamLinen";
}

// Exported fabric depth and widest reach across the open/closed panel poses.
export const CURTAIN_FABRIC_BOUNDS = { minX: -.926, maxX: .926, minZ: -.013, maxZ: .078 };
