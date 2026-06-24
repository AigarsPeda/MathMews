import { Dimensions, PixelRatio } from "react-native";

const { width, height } = Dimensions.get("window");

const BASE_W = 390;
const BASE_H = 844;

export const scale = (size: number): number =>
  PixelRatio.roundToNearestPixel((width / BASE_W) * size);

export const verticalScale = (size: number): number =>
  PixelRatio.roundToNearestPixel((height / BASE_H) * size);

export const moderateScale = (size: number, factor = 0.5): number =>
  PixelRatio.roundToNearestPixel(size + (scale(size) - size) * factor);
