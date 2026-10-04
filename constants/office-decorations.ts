

type ImageEntry = { source: number; displaySize: number; };

type AnimatedEntry = { source: number; sheetWidth: number; sheetHeight: number; frameWidth: number; frameHeight: number; frameCount: number; fps?: number; displaySize: number };

/** Office pack — shown in the dedicated store tab. */
export const OFFICE_DECORATION_CATALOG = {
  officeAc: { source: require("@/assets/3d/decoration/officeAc.png"), displaySize: 48 },
  officeBlueprint: { source: require("@/assets/3d/decoration/officeBlueprint.png"), displaySize: 48 },
  officeBoardEmpty: { source: require("@/assets/3d/decoration/officeBoardEmpty.png"), displaySize: 64 },
  officeBoardFull: { source: require("@/assets/3d/decoration/officeBoardFull.png"), displaySize: 64 },
  officeCalculator: { source: require("@/assets/3d/decoration/officeCalculator.png"), displaySize: 26 },
  officeCartonBox: { source: require("@/assets/3d/decoration/officeCartonBox.png"), displaySize: 48 },
  officeCorkboardA: { source: require("@/assets/3d/decoration/officeCorkboardA.png"), displaySize: 64 },
  officeCorkboardB: { source: require("@/assets/3d/decoration/officeCorkboardB.png"), displaySize: 64 },
  officeDiploma: { source: require("@/assets/3d/decoration/officeDiploma.png"), displaySize: 48 },
  officeDrawingTable: { source: require("@/assets/3d/decoration/officeDrawingTable.png"), displaySize: 64 },
  officeFireExtinguisher: { source: require("@/assets/3d/decoration/officeFireExtinguisher.png"), displaySize: 48 },
  officeGlassWall: { source: require("@/assets/3d/decoration/officeGlassWall.png"), displaySize: 80 },
  officeHeadset: { source: require("@/assets/3d/decoration/officeHeadset.png"), displaySize: 26 },
  officeKitchenTable: { source: require("@/assets/3d/decoration/officeKitchenTable.png"), displaySize: 64 },
  officeLongRack: { source: require("@/assets/3d/decoration/officeLongRack.png"), displaySize: 48 },
  officePaper1: { source: require("@/assets/3d/decoration/officePaper1.png"), displaySize: 26 },
  officePaper2: { source: require("@/assets/3d/decoration/officePaper2.png"), displaySize: 26 },
  officePaper3: { source: require("@/assets/3d/decoration/officePaper3.png"), displaySize: 26 },
  officePaper4: { source: require("@/assets/3d/decoration/officePaper4.png"), displaySize: 26 },
  officePaper5: { source: require("@/assets/3d/decoration/officePaper5.png"), displaySize: 26 },
  officePaper6: { source: require("@/assets/3d/decoration/officePaper6.png"), displaySize: 26 },
  officePartition: { source: require("@/assets/3d/decoration/officePartition.png"), displaySize: 64 },
  officePencilHolder: { source: require("@/assets/3d/decoration/officePencilHolder.png"), displaySize: 26 },
  officePhotosA: { source: require("@/assets/3d/decoration/officePhotosA.png"), displaySize: 26 },
  officePhotosB: { source: require("@/assets/3d/decoration/officePhotosB.png"), displaySize: 48 },
  officePictureFrame: { source: require("@/assets/3d/decoration/officePictureFrame.png"), displaySize: 26 },
  officeProjectorStand: { source: require("@/assets/3d/decoration/officeProjectorStand.png"), displaySize: 48 },
  officeRack: { source: require("@/assets/3d/decoration/officeRack.png"), displaySize: 80 },
  officeRolledPapers: { source: require("@/assets/3d/decoration/officeRolledPapers.png"), displaySize: 48 },
  officeRuler: { source: require("@/assets/3d/decoration/officeRuler.png"), displaySize: 48 },
  officeRumbaRobot: { source: require("@/assets/3d/decoration/officeRumbaRobot.png"), displaySize: 48 },
  officeStickyNote1: { source: require("@/assets/3d/decoration/officeStickyNote1.png"), displaySize: 16 },
  officeStickyNote2: { source: require("@/assets/3d/decoration/officeStickyNote2.png"), displaySize: 26 },
  officeStickyNote3: { source: require("@/assets/3d/decoration/officeStickyNote3.png"), displaySize: 16 },
  officeStickyNote4: { source: require("@/assets/3d/decoration/officeStickyNote4.png"), displaySize: 16 },
  officeStickyNote5: { source: require("@/assets/3d/decoration/officeStickyNote5.png"), displaySize: 16 },
  officeStickyNote6: { source: require("@/assets/3d/decoration/officeStickyNote6.png"), displaySize: 16 },
  officeStickyNoteBlue: { source: require("@/assets/3d/decoration/officeStickyNoteBlue.png"), displaySize: 16 },
  officeStickyNoteGreen: { source: require("@/assets/3d/decoration/officeStickyNoteGreen.png"), displaySize: 16 },
  officeStickyNotePink: { source: require("@/assets/3d/decoration/officeStickyNotePink.png"), displaySize: 16 },
  officeStickyNoteRed: { source: require("@/assets/3d/decoration/officeStickyNoteRed.png"), displaySize: 16 },
  officeTelephone: { source: require("@/assets/3d/decoration/officeTelephone.png"), displaySize: 26 },
  officeTrashEmpty: { source: require("@/assets/3d/decoration/officeTrashEmpty.png"), displaySize: 26 },
  officeTrashFull: { source: require("@/assets/3d/decoration/officeTrashFull.png"), displaySize: 48 },
  officeTrashSquare: { source: require("@/assets/3d/decoration/officeTrashSquare.png"), displaySize: 48 },
  officeTvOff: { source: require("@/assets/3d/decoration/officeTvOff.png"), displaySize: 64 },
  officeWhiteBox: { source: require("@/assets/3d/decoration/officeWhiteBox.png"), displaySize: 48 },
  officeWhiteboardEraser: { source: require("@/assets/3d/decoration/officeWhiteboardEraser.png"), displaySize: 26 },
  officeClockAni: { source: require("@/assets/3d/atlases/officeClockAni.png"), sheetWidth: 1536, sheetHeight: 192, frameWidth: 192, frameHeight: 192, frameCount: 8, fps: 12, displaySize: 48 },
  officeCopyMachineDarkAni: { source: require("@/assets/3d/atlases/officeCopyMachineDarkAni.png"), sheetWidth: 1536, sheetHeight: 192, frameWidth: 192, frameHeight: 192, frameCount: 8, fps: 12, displaySize: 64 },
  officeCopyMachineWhiteAni: { source: require("@/assets/3d/atlases/officeCopyMachineWhiteAni.png"), sheetWidth: 1536, sheetHeight: 192, frameWidth: 192, frameHeight: 192, frameCount: 8, fps: 12, displaySize: 64 },
  officeDocumentShredderAni: { source: require("@/assets/3d/atlases/officeDocumentShredderAni.png"), sheetWidth: 1536, sheetHeight: 192, frameWidth: 192, frameHeight: 192, frameCount: 8, fps: 12, displaySize: 48 },
  officeMedicalKitAni: { source: require("@/assets/3d/atlases/officeMedicalKitAni.png"), sheetWidth: 1536, sheetHeight: 192, frameWidth: 192, frameHeight: 192, frameCount: 8, fps: 12, displaySize: 48 },
  officeMetallicClosetAni: { source: require("@/assets/3d/atlases/officeMetallicClosetAni.png"), sheetWidth: 1536, sheetHeight: 192, frameWidth: 192, frameHeight: 192, frameCount: 8, fps: 12, displaySize: 64 },
  officePrinterAni: { source: require("@/assets/3d/atlases/officePrinterAni.png"), sheetWidth: 1536, sheetHeight: 192, frameWidth: 192, frameHeight: 192, frameCount: 8, fps: 12, displaySize: 48 },
  officeProjectorAni: { source: require("@/assets/3d/atlases/officeProjectorAni.png"), sheetWidth: 1536, sheetHeight: 192, frameWidth: 192, frameHeight: 192, frameCount: 8, fps: 12, displaySize: 64 },
  officeProjectorScreenAni: { source: require("@/assets/3d/atlases/officeProjectorScreenAni.png"), sheetWidth: 1536, sheetHeight: 192, frameWidth: 192, frameHeight: 192, frameCount: 8, fps: 12, displaySize: 64 },
  officeWaterDispenserAni: { source: require("@/assets/3d/atlases/officeWaterDispenserAni.png"), sheetWidth: 1536, sheetHeight: 192, frameWidth: 192, frameHeight: 192, frameCount: 8, fps: 12, displaySize: 64 },
  officeWoodClosetAni: { source: require("@/assets/3d/atlases/officeWoodClosetAni.png"), sheetWidth: 1536, sheetHeight: 192, frameWidth: 192, frameHeight: 192, frameCount: 8, fps: 12, displaySize: 64 },
} as const satisfies Record<string, ImageEntry | AnimatedEntry>;

export type OfficeDecorationId = keyof typeof OFFICE_DECORATION_CATALOG;

export const OFFICE_DECORATION_IDS = Object.keys(
  OFFICE_DECORATION_CATALOG,
) as OfficeDecorationId[];

const OFFICE_DECORATION_ID_SET = new Set<string>(OFFICE_DECORATION_IDS);

export function isOfficeDecorationId(
  decorationId: string,
): decorationId is OfficeDecorationId {
  return OFFICE_DECORATION_ID_SET.has(decorationId);
}