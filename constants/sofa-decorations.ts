type ImageEntry = {
  source: number;
  displaySize: number;
};

/** Sofa pack — shown in the dedicated store tab. */
export const SOFA_DECORATION_CATALOG = {
  sofaA: { source: require("@/assets/3d/decoration/sofaA.png"), displaySize: 88 },
  sofaB: { source: require("@/assets/3d/decoration/sofaB.png"), displaySize: 88 },
  sofaPillow: { source: require("@/assets/3d/decoration/sofaPillow.png"), displaySize: 28 },
} as const satisfies Record<string, ImageEntry>;

export type SofaDecorationId = keyof typeof SOFA_DECORATION_CATALOG;

export const SOFA_DECORATION_IDS = Object.keys(
  SOFA_DECORATION_CATALOG,
) as SofaDecorationId[];

const SOFA_DECORATION_ID_SET = new Set<string>(SOFA_DECORATION_IDS);

export function isSofaDecorationId(
  decorationId: string,
): decorationId is SofaDecorationId {
  return SOFA_DECORATION_ID_SET.has(decorationId);
}
