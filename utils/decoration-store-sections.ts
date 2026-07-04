import type { StoreTab } from "@/components/store/StoreTabBar";
import type { CatDecorationId } from "@/constants/cat-decorations";
import {
  BATHROOM_DECORATION_STORE_IDS,
  BOOKS_DECORATION_STORE_IDS,
  CARPET_DECORATION_STORE_IDS,
  CAT_SUPPLIES_DECORATION_STORE_IDS,
  CHAIR_DECORATION_STORE_IDS,
  COMPUTER_DECORATION_STORE_IDS,
  CONSOLE_DECORATION_STORE_IDS,
  DESK_DECORATION_STORE_IDS,
  FURNITURE_DECORATION_STORE_IDS,
  JAPANESE_DECORATION_STORE_IDS,
  LIVING_ROOM_DECORATION_STORE_IDS,
  OFFICE_DECORATION_STORE_IDS,
  PLANT_DECORATION_STORE_IDS,
  POSTER_DECORATION_STORE_IDS,
  SOFA_DECORATION_STORE_IDS,
  TV_DECORATION_STORE_IDS,
  WINDOW_DECORATION_STORE_IDS,
} from "@/utils/decoration-store";

export const DECORATION_STORE_TABS = [
  "catItems",
  "furniture",
  "carpets",
  "chairs",
  "desks",
  "computers",
  "consoles",
  "windows",
  "tvs",
  "sofas",
  "posters",
  "plants",
  "living",
  "office",
  "bathroom",
  "books",
  "japanese",
] as const satisfies readonly StoreTab[];

export type DecorationStoreTab = (typeof DECORATION_STORE_TABS)[number];

export const DECORATION_IDS_BY_STORE_TAB: Record<
  DecorationStoreTab,
  readonly CatDecorationId[]
> = {
  catItems: CAT_SUPPLIES_DECORATION_STORE_IDS,
  furniture: FURNITURE_DECORATION_STORE_IDS,
  carpets: CARPET_DECORATION_STORE_IDS,
  chairs: CHAIR_DECORATION_STORE_IDS,
  desks: DESK_DECORATION_STORE_IDS,
  computers: COMPUTER_DECORATION_STORE_IDS,
  consoles: CONSOLE_DECORATION_STORE_IDS,
  windows: WINDOW_DECORATION_STORE_IDS,
  tvs: TV_DECORATION_STORE_IDS,
  sofas: SOFA_DECORATION_STORE_IDS,
  posters: POSTER_DECORATION_STORE_IDS,
  plants: PLANT_DECORATION_STORE_IDS,
  living: LIVING_ROOM_DECORATION_STORE_IDS,
  office: OFFICE_DECORATION_STORE_IDS,
  bathroom: BATHROOM_DECORATION_STORE_IDS,
  books: BOOKS_DECORATION_STORE_IDS,
  japanese: JAPANESE_DECORATION_STORE_IDS,
};

export const DECORATION_STORE_SUBTITLE_KEY: Record<DecorationStoreTab, string> =
  {
    catItems: "store.subtitleCatItems",
    furniture: "store.subtitleFurniture",
    carpets: "store.subtitleCarpets",
    chairs: "store.subtitleChairs",
    desks: "store.subtitleDesks",
    computers: "store.subtitleComputers",
    consoles: "store.subtitleConsoles",
    windows: "store.subtitleWindows",
    tvs: "store.subtitleTvs",
    sofas: "store.subtitleSofas",
    posters: "store.subtitlePosters",
    plants: "store.subtitlePlants",
    living: "store.subtitleLiving",
    office: "store.subtitleOffice",
    bathroom: "store.subtitleBathroom",
    books: "store.subtitleBooks",
    japanese: "store.subtitleJapanese",
  };

export function isDecorationStoreTab(tab: StoreTab): tab is DecorationStoreTab {
  return tab in DECORATION_IDS_BY_STORE_TAB;
}
