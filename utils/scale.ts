import { Dimensions, PixelRatio } from "react-native";

const { width } = Dimensions.get("window");

const BASE_W = 390;

export const scale = (size: number): number =>
  PixelRatio.roundToNearestPixel((width / BASE_W) * size);

export const moderateScale = (size: number, factor = 0.5): number =>
  PixelRatio.roundToNearestPixel(size + (scale(size) - size) * factor);
