type ImageEntry = { source: number; displaySize: number; };

/** Books & stationery pack — dedicated store tab. */
export const BOOKS_DECORATION_CATALOG = {
  booksBookGreen: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Books/book-green.png"),
    displaySize: 26,
  },
  booksPile: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Books/books-pile.png"),
    displaySize: 48,
  },
  booksNotebooks: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Books/notebooks.png"),
    displaySize: 48,
  },
  booksRingBinderBlue: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Books/ring-binder-blue.png"),
    displaySize: 26,
  },
  booksRingBinderDark: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Books/ring-binder-dark.png"),
    displaySize: 26,
  },
  booksRingBinderGreen: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Books/ring-binder-green.png"),
    displaySize: 26,
  },
  booksRingBinderOrange: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Books/ring-binder-orange.png"),
    displaySize: 26,
  },
  booksRingBinderRed: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Books/ring-binder-red.png"),
    displaySize: 26,
  },
  booksRingBinderYellow: {
    source: require("@/assets/pets/Cat/CatItems/Decorations/Books/ring-binder-yellow.png"),
    displaySize: 26,
  },
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