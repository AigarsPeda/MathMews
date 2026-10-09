export function isAirConditionerDecorationId(id: string): boolean {
  return id === "livingAirCon" || id === "officeAc";
}

export const LAMP_LIGHT_ORIGINS: Record<string, [number, number, number]> = {
  lampFloorArc: [.72, 1.33, 0],
  lampFloorTripod: [0, 1.30, 0],
  lampFloorPaper: [0, .80, 0],
  lampTableMushroom: [0, .35, 0],
  lampTableCeramic: [0, .44, 0],
  lampTableBanker: [0, .54, .025],
  bedroomFloorLamp: [0, 1.36, 0],
  japaneseLamp: [0, .20, 0],
  lavaLampOff: [0, .22, 0],
  lavaLampAni: [0, .22, 0],
};

export function isLampDecorationId(id: string): boolean {
  return Object.hasOwn(LAMP_LIGHT_ORIGINS, id);
}

export function isPoweredDecorationId(id: string): boolean {
  return isAirConditionerDecorationId(id) || isLampDecorationId(id);
}
