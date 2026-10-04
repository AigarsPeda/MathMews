import type { SkImage } from "@shopify/react-native-skia";

export type RoomPlayPropFrame = {
  image: SkImage | null;
  col: number;
  row: number;
  /** Projected ground contact in the full cat frame, independent of bounce height. */
  groundY: number;
};
export const EMPTY_PLAY_PROP: RoomPlayPropFrame = { image: null, col: 0, row: 0, groundY: .8 };
