import type { StoreTab } from "@/components/store/StoreTabBar";
import type { CatDecorationId } from "@/constants/cat-decorations";
import {
  TABLE_DECORATION_STORE_IDS,
  APPLIANCE_DECORATION_STORE_IDS,
  ACCESSORY_DECORATION_STORE_IDS,
  BATHROOM_DECORATION_STORE_IDS,
  DOOR_DECORATION_STORE_IDS,
  LAMP_DECORATION_STORE_IDS,
  CURTAIN_DECORATION_STORE_IDS,
  KITCHEN_DECORATION_STORE_IDS,
  BEDROOM_DECORATION_STORE_IDS,
  HALLOWEEN_DECORATION_STORE_IDS,
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

export const DECORATION_STORE_CATEGORY_GROUPS = [
  { titleKey: "store.categoryRooms", tabs: ["living", "kitchen", "bedroom", "bathroom", "office"] },
  { titleKey: "store.categoryFurniture", tabs: ["sofas", "chairs", "tables", "desks", "furniture"] },
  { titleKey: "store.categoryDecorations", tabs: ["carpets", "lamps", "windows", "doors", "curtains", "posters", "plants", "accessories", "books"] },
  { titleKey: "store.categoryElectronics", tabs: ["computers", "tvs", "consoles", "appliances"] },
  { titleKey: "store.categoryCat", tabs: ["catItems"] },
  { titleKey: "store.categoryThemes", tabs: ["halloween", "japanese"] },
] as const satisfies readonly { titleKey: string; tabs: readonly StoreTab[] }[];

export const DECORATION_STORE_TABS = DECORATION_STORE_CATEGORY_GROUPS.flatMap<DecorationStoreTab>(group => group.tabs);
export type DecorationStoreTab = (typeof DECORATION_STORE_CATEGORY_GROUPS)[number]["tabs"][number];

export const DECORATION_IDS_BY_STORE_TAB: Record<
  DecorationStoreTab,
  readonly CatDecorationId[]
> = {
  tables: TABLE_DECORATION_STORE_IDS,
  appliances: APPLIANCE_DECORATION_STORE_IDS,
  accessories: ACCESSORY_DECORATION_STORE_IDS,
  catItems: CAT_SUPPLIES_DECORATION_STORE_IDS,
  furniture: FURNITURE_DECORATION_STORE_IDS,
  carpets: CARPET_DECORATION_STORE_IDS,
  chairs: CHAIR_DECORATION_STORE_IDS,
  desks: DESK_DECORATION_STORE_IDS,
  computers: COMPUTER_DECORATION_STORE_IDS,
  consoles: CONSOLE_DECORATION_STORE_IDS,
  windows: WINDOW_DECORATION_STORE_IDS,
  doors: DOOR_DECORATION_STORE_IDS,
  curtains: CURTAIN_DECORATION_STORE_IDS,
  lamps: LAMP_DECORATION_STORE_IDS,
  tvs: TV_DECORATION_STORE_IDS,
  sofas: SOFA_DECORATION_STORE_IDS,
  posters: POSTER_DECORATION_STORE_IDS,
  plants: PLANT_DECORATION_STORE_IDS,
  living: LIVING_ROOM_DECORATION_STORE_IDS,
  office: OFFICE_DECORATION_STORE_IDS,
  bathroom: BATHROOM_DECORATION_STORE_IDS,
  kitchen: KITCHEN_DECORATION_STORE_IDS,
  bedroom: BEDROOM_DECORATION_STORE_IDS,
  halloween: HALLOWEEN_DECORATION_STORE_IDS,
  books: BOOKS_DECORATION_STORE_IDS,
  japanese: JAPANESE_DECORATION_STORE_IDS,
};

export const DECORATION_STORE_SUBTITLE_KEY: Record<DecorationStoreTab, string> =
  {
    tables: "store.subtitleTables",
    appliances: "store.subtitleAppliances",
    accessories: "store.subtitleAccessories",
    catItems: "store.subtitleCatItems",
    furniture: "store.subtitleFurniture",
    carpets: "store.subtitleCarpets",
    chairs: "store.subtitleChairs",
    desks: "store.subtitleDesks",
    computers: "store.subtitleComputers",
    consoles: "store.subtitleConsoles",
    windows: "store.subtitleWindows",
    doors: "store.subtitleDoors",
    curtains: "store.subtitleCurtains",
    lamps: "store.subtitleLamps",
    tvs: "store.subtitleTvs",
    sofas: "store.subtitleSofas",
    posters: "store.subtitlePosters",
    plants: "store.subtitlePlants",
    living: "store.subtitleLiving",
    office: "store.subtitleOffice",
    bathroom: "store.subtitleBathroom",
    kitchen: "store.subtitleKitchen",
    bedroom: "store.subtitleBedroom",
    halloween: "store.subtitleHalloween",
    books: "store.subtitleBooks",
    japanese: "store.subtitleJapanese",
  };

export function isDecorationStoreTab(tab: StoreTab): tab is DecorationStoreTab {
  return tab in DECORATION_IDS_BY_STORE_TAB;
}
