import {
  OFFICE_CLOCK_FRAMES,
  OFFICE_COPY_MACHINE_DARK_FRAMES,
  OFFICE_COPY_MACHINE_WHITE_FRAMES,
  OFFICE_DOCUMENT_SHREDDER_FRAMES,
  OFFICE_MEDICAL_KIT_FRAMES,
  OFFICE_METALLIC_CLOSET_FRAMES,
  OFFICE_PRINTER_FRAMES,
  OFFICE_PROJECTOR_FRAMES,
  OFFICE_PROJECTOR_SCREEN_FRAMES,
  OFFICE_WATER_DISPENSER_FRAMES,
  OFFICE_WOOD_CLOSET_FRAMES,
} from "@/constants/office-animation-frames";

type ImageEntry = { source: number; displaySize: number; };

type AnimatedEntry = {
  frames: readonly number[];
  frameWidth: number;
  frameHeight: number;
  fps?: number;
  displaySize: number;
};

/** Office pack — shown in the dedicated store tab. */
export const OFFICE_DECORATION_CATALOG = {
  officeAc: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/ac.png"),
    displaySize: 48,
  },
  officeBlueprint: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/blueprint.png"),
    displaySize: 48,
  },
  officeBoardEmpty: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/board-empty.png"),
    displaySize: 64,
  },
  officeBoardFull: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/board-full.png"),
    displaySize: 64,
  },
  officeCalculator: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/calculator.png"),
    displaySize: 26,
  },
  officeCartonBox: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/carton-box.png"),
    displaySize: 48,
  },
  officeCorkboardA: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/corkboard-1.png"),
    displaySize: 64,
  },
  officeCorkboardB: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/corkboard-2.png"),
    displaySize: 64,
  },
  officeDiploma: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/diploma.png"),
    displaySize: 48,
  },
  officeDrawingTable: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/drawing-table.png"),
    displaySize: 64,
  },
  officeFireExtinguisher: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/fire-extinguisher.png"),
    displaySize: 48,
  },
  officeGlassWall: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/glass-wall.png"),
    displaySize: 80,
  },
  officeHeadset: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/headset.png"),
    displaySize: 26,
  },
  officeKitchenTable: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/office-kitchen-table.png"),
    displaySize: 64,
  },
  officeLongRack: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/long-rack.png"),
    displaySize: 48,
  },
  officePaper1: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/paper-1.png"),
    displaySize: 26,
  },
  officePaper2: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/paper-2.png"),
    displaySize: 26,
  },
  officePaper3: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/paper-3.png"),
    displaySize: 26,
  },
  officePaper4: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/paper-4.png"),
    displaySize: 26,
  },
  officePaper5: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/paper-5.png"),
    displaySize: 26,
  },
  officePaper6: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/paper-6.png"),
    displaySize: 26,
  },
  officePartition: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/office-partition.png"),
    displaySize: 64,
  },
  officePencilHolder: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/pencil-holder.png"),
    displaySize: 26,
  },
  officePhotosA: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/photos-1.png"),
    displaySize: 26,
  },
  officePhotosB: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/photos-2.png"),
    displaySize: 48,
  },
  officePictureFrame: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/picture-frame.png"),
    displaySize: 26,
  },
  officeProjectorStand: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/projector-stand.png"),
    displaySize: 48,
  },
  officeRack: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/rack.png"),
    displaySize: 80,
  },
  officeRolledPapers: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/rolled-papers.png"),
    displaySize: 48,
  },
  officeRuler: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/ruler.png"),
    displaySize: 48,
  },
  officeRumbaRobot: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/rumba-robot.png"),
    displaySize: 48,
  },
  officeStickyNote1: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/sticky-note-1.png"),
    displaySize: 16,
  },
  officeStickyNote2: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/sticky-note-2.png"),
    displaySize: 26,
  },
  officeStickyNote3: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/sticky-note-3.png"),
    displaySize: 16,
  },
  officeStickyNote4: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/sticky-note-4.png"),
    displaySize: 16,
  },
  officeStickyNote5: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/sticky-note-5.png"),
    displaySize: 16,
  },
  officeStickyNote6: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/sticky-note-6.png"),
    displaySize: 16,
  },
  officeStickyNoteBlue: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/sticky-note-blue.png"),
    displaySize: 16,
  },
  officeStickyNoteGreen: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/sticky-note-green.png"),
    displaySize: 16,
  },
  officeStickyNotePink: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/sticky-note-pink.png"),
    displaySize: 16,
  },
  officeStickyNoteRed: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/sticky-note-red.png"),
    displaySize: 16,
  },
  officeTelephone: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/telephone.png"),
    displaySize: 26,
  },
  officeTrashEmpty: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/trash-empty.png"),
    displaySize: 26,
  },
  officeTrashFull: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/trash-full.png"),
    displaySize: 48,
  },
  officeTrashSquare: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/trash-square.png"),
    displaySize: 48,
  },
  officeTvOff: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/tv-off.png"),
    displaySize: 64,
  },
  officeWhiteBox: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/white-box.png"),
    displaySize: 48,
  },
  officeWhiteboardEraser: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Office/whiteboard-eraser.png"),
    displaySize: 26,
  },
  officeClockAni: {
    frames: OFFICE_CLOCK_FRAMES,
    frameWidth: 64,
    frameHeight: 64,
    fps: 6,
    displaySize: 48,
  },
  officeCopyMachineDarkAni: {
    frames: OFFICE_COPY_MACHINE_DARK_FRAMES,
    frameWidth: 128,
    frameHeight: 128,
    fps: 8,
    displaySize: 64,
  },
  officeCopyMachineWhiteAni: {
    frames: OFFICE_COPY_MACHINE_WHITE_FRAMES,
    frameWidth: 128,
    frameHeight: 128,
    fps: 8,
    displaySize: 64,
  },
  officeDocumentShredderAni: {
    frames: OFFICE_DOCUMENT_SHREDDER_FRAMES,
    frameWidth: 64,
    frameHeight: 64,
    fps: 6,
    displaySize: 48,
  },
  officeMedicalKitAni: {
    frames: OFFICE_MEDICAL_KIT_FRAMES,
    frameWidth: 64,
    frameHeight: 64,
    fps: 6,
    displaySize: 48,
  },
  officeMetallicClosetAni: {
    frames: OFFICE_METALLIC_CLOSET_FRAMES,
    frameWidth: 128,
    frameHeight: 128,
    fps: 8,
    displaySize: 64,
  },
  officePrinterAni: {
    frames: OFFICE_PRINTER_FRAMES,
    frameWidth: 64,
    frameHeight: 64,
    fps: 6,
    displaySize: 48,
  },
  officeProjectorAni: {
    frames: OFFICE_PROJECTOR_FRAMES,
    frameWidth: 128,
    frameHeight: 128,
    fps: 8,
    displaySize: 64,
  },
  officeProjectorScreenAni: {
    frames: OFFICE_PROJECTOR_SCREEN_FRAMES,
    frameWidth: 128,
    frameHeight: 128,
    fps: 8,
    displaySize: 64,
  },
  officeWaterDispenserAni: {
    frames: OFFICE_WATER_DISPENSER_FRAMES,
    frameWidth: 128,
    frameHeight: 128,
    fps: 8,
    displaySize: 64,
  },
  officeWoodClosetAni: {
    frames: OFFICE_WOOD_CLOSET_FRAMES,
    frameWidth: 128,
    frameHeight: 128,
    fps: 8,
    displaySize: 64,
  },
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