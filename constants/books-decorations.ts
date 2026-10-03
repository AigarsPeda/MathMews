type ImageEntry = { source: number; displaySize: number; };

/** Books & stationery pack — dedicated store tab. */
export const BOOKS_DECORATION_CATALOG = {
  booksBookGreen: { source: require("@/assets/3d/decoration/booksBookGreen.png"), displaySize: 26 },
  booksPile: { source: require("@/assets/3d/decoration/booksPile.png"), displaySize: 48 },
  booksNotebooks: { source: require("@/assets/3d/decoration/booksNotebooks.png"), displaySize: 48 },
  booksRingBinderBlue: { source: require("@/assets/3d/decoration/booksRingBinderBlue.png"), displaySize: 26 },
  booksRingBinderDark: { source: require("@/assets/3d/decoration/booksRingBinderDark.png"), displaySize: 26 },
  booksRingBinderGreen: { source: require("@/assets/3d/decoration/booksRingBinderGreen.png"), displaySize: 26 },
  booksRingBinderOrange: { source: require("@/assets/3d/decoration/booksRingBinderOrange.png"), displaySize: 26 },
  booksRingBinderRed: { source: require("@/assets/3d/decoration/booksRingBinderRed.png"), displaySize: 26 },
  booksRingBinderYellow: { source: require("@/assets/3d/decoration/booksRingBinderYellow.png"), displaySize: 26 },
} as const satisfies Record<string, ImageEntry>;

export type BooksDecorationId = keyof typeof BOOKS_DECORATION_CATALOG;

export const BOOKS_DECORATION_IDS = Object.keys(
  BOOKS_DECORATION_CATALOG,
) as BooksDecorationId[];

const BOOKS_DECORATION_ID_SET = new Set<string>(BOOKS_DECORATION_IDS);

export function isBooksDecorationId(
  decorationId: string,
): decorationId is BooksDecorationId {
  return BOOKS_DECORATION_ID_SET.has(decorationId);
}