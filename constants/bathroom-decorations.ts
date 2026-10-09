

type ImageEntry = { source: number; displaySize: number; };

type AnimatedEntry = { source: number; sheetWidth: number; sheetHeight: number; frameWidth: number; frameHeight: number; frameCount: number; fps?: number; displaySize: number };

/** Bathroom pack — shown in the dedicated store tab. */
export const BATHROOM_DECORATION_CATALOG = {
  bathroomBathOvalWhite: { source: require("@/assets/3d/decoration/bathroomBathOvalWhite.png"), displaySize: 64 },
  bathroomBathOvalSage: { source: require("@/assets/3d/decoration/bathroomBathOvalSage.png"), displaySize: 64 },
  bathroomBathOvalRose: { source: require("@/assets/3d/decoration/bathroomBathOvalRose.png"), displaySize: 64 },
  bathroomBathOvalCharcoal: { source: require("@/assets/3d/decoration/bathroomBathOvalCharcoal.png"), displaySize: 64 },
  bathroomBathClawfootCream: { source: require("@/assets/3d/decoration/bathroomBathClawfootCream.png"), displaySize: 64 },
  bathroomBathClawfootNavy: { source: require("@/assets/3d/decoration/bathroomBathClawfootNavy.png"), displaySize: 64 },
  bathroomJacuzziWhite: { source: require("@/assets/3d/decoration/bathroomJacuzziWhite.png"), displaySize: 76 },
  bathroomJacuzziSage: { source: require("@/assets/3d/decoration/bathroomJacuzziSage.png"), displaySize: 76 },
  bathroomDoubleVanity: { source: require("@/assets/3d/decoration/bathroomDoubleVanity.png"), displaySize: 80 },
  bathroomShowerCabin: { source: require("@/assets/3d/decoration/bathroomShowerCabin.png"), displaySize: 80 },
  bathroomLaundryHamper: { source: require("@/assets/3d/decoration/bathroomLaundryHamper.png"), displaySize: 40 },
  bathroomTowelStand: { source: require("@/assets/3d/decoration/bathroomTowelStand.png"), displaySize: 48 },
  bathroomBathCarpet: { source: require("@/assets/3d/decoration/bathroomBathCarpet.png"), displaySize: 48 },
  bathroomBathWindow: { source: require("@/assets/3d/decoration/bathroomBathWindow.png"), displaySize: 48 },
  bathroomDuck: { source: require("@/assets/3d/decoration/bathroomDuck.png"), displaySize: 16 },
  bathroomHanger: { source: require("@/assets/3d/decoration/bathroomHanger.png"), displaySize: 26 },
  bathroomHangingTowel: { source: require("@/assets/3d/decoration/bathroomHangingTowel.png"), displaySize: 48 },
  bathroomLongShelf: { source: require("@/assets/3d/decoration/bathroomLongShelf.png"), displaySize: 48 },
  bathroomMirror: { source: require("@/assets/3d/decoration/bathroomMirror.png"), displaySize: 48 },
  bathroomShowerBin: { source: require("@/assets/3d/decoration/bathroomShowerBin.png"), displaySize: 26 },
  bathroomShowerFloor: { source: require("@/assets/3d/decoration/bathroomShowerFloor.png"), displaySize: 48 },
  bathroomShowerTap: { source: require("@/assets/3d/decoration/bathroomShowerTap.png"), displaySize: 64 },
  bathroomShowerTray: { source: require("@/assets/3d/decoration/bathroomShowerTray.png"), displaySize: 48 },
  bathroomSmallShelf: { source: require("@/assets/3d/decoration/bathroomSmallShelf.png"), displaySize: 48 },
  bathroomSoapGreen: { source: require("@/assets/3d/decoration/bathroomSoapGreen.png"), displaySize: 26 },
  bathroomSoapRed: { source: require("@/assets/3d/decoration/bathroomSoapRed.png"), displaySize: 26 },
  bathroomSoapYellow: { source: require("@/assets/3d/decoration/bathroomSoapYellow.png"), displaySize: 26 },
  bathroomTapShower: { source: require("@/assets/3d/decoration/bathroomTapShower.png"), displaySize: 48 },
  bathroomTapWall: { source: require("@/assets/3d/decoration/bathroomTapWall.png"), displaySize: 26 },
  bathroomTissues: { source: require("@/assets/3d/decoration/bathroomTissues.png"), displaySize: 26 },
  bathroomToiletPaper: { source: require("@/assets/3d/decoration/bathroomToiletPaper.png"), displaySize: 26 },
  bathroomTowelBlue: { source: require("@/assets/3d/decoration/bathroomTowelBlue.png"), displaySize: 26 },
  bathroomTowelGreen: { source: require("@/assets/3d/decoration/bathroomTowelGreen.png"), displaySize: 26 },
  bathroomTowelRed: { source: require("@/assets/3d/decoration/bathroomTowelRed.png"), displaySize: 26 },
  bathroomWcFurniture: { source: require("@/assets/3d/decoration/bathroomWcFurniture.png"), displaySize: 64 },
  bathroomBathAni: { source: require("@/assets/3d/atlases/bathroomBathAni.png"), sheetWidth: 1536, sheetHeight: 192, frameWidth: 192, frameHeight: 192, frameCount: 8, fps: 12, displaySize: 64 },
  bathroomWcAni: { source: require("@/assets/3d/atlases/bathroomWcAni.png"), sheetWidth: 1536, sheetHeight: 192, frameWidth: 192, frameHeight: 192, frameCount: 8, fps: 12, displaySize: 48 },
  bathroomWcTapAni: { source: require("@/assets/3d/atlases/bathroomWcTapAni.png"), sheetWidth: 1536, sheetHeight: 192, frameWidth: 192, frameHeight: 192, frameCount: 8, fps: 12, displaySize: 64 },
} as const satisfies Record<string, ImageEntry | AnimatedEntry>;

export type BathroomDecorationId = keyof typeof BATHROOM_DECORATION_CATALOG;

export const BATHROOM_DECORATION_IDS = Object.keys(
  BATHROOM_DECORATION_CATALOG,
) as BathroomDecorationId[];

const BATHROOM_DECORATION_ID_SET = new Set<string>(BATHROOM_DECORATION_IDS);

export function isBathroomDecorationId(
  decorationId: string,
): decorationId is BathroomDecorationId {
  return BATHROOM_DECORATION_ID_SET.has(decorationId);
}
