type ImageEntry = {
  source: number;
  displaySize: number;
};

/** Living room pack — shown in the dedicated store tab. */
export const LIVING_ROOM_DECORATION_CATALOG = {
  livingAirCon: { source: require("@/assets/3d/decoration/livingAirCon.png"), displaySize: 44 },
  livingBook: { source: require("@/assets/3d/decoration/livingBook.png"), displaySize: 24 },
  livingSmallTable: { source: require("@/assets/3d/decoration/livingSmallTable.png"), displaySize: 52 },
  livingSpeaker: { source: require("@/assets/3d/decoration/livingSpeaker.png"), displaySize: 40 },
  livingTable: { source: require("@/assets/3d/decoration/livingTable.png"), displaySize: 56 },
  livingShelvingA: { source: require("@/assets/3d/decoration/livingShelvingA.png"), displaySize: 56 },
  livingShelvingB: { source: require("@/assets/3d/decoration/livingShelvingB.png"), displaySize: 56 },
} as const satisfies Record<string, ImageEntry>;

export type LivingRoomDecorationId = keyof typeof LIVING_ROOM_DECORATION_CATALOG;

export const LIVING_ROOM_DECORATION_IDS = Object.keys(
  LIVING_ROOM_DECORATION_CATALOG,
) as LivingRoomDecorationId[];

const LIVING_ROOM_DECORATION_ID_SET = new Set<string>(LIVING_ROOM_DECORATION_IDS);

export function isLivingRoomDecorationId(
  decorationId: string,
): decorationId is LivingRoomDecorationId {
  return LIVING_ROOM_DECORATION_ID_SET.has(decorationId);
}
