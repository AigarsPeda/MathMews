import { ToySheetSprite } from "@/components/pet/ToySheetSprite";
import {
  CAT_LARGE_TOY_SHEET,
  getCatToySource,
  getLargeToyFrame,
  type CatToyId,
} from "@/constants/cat-toys";
import { Image, type ImageSourcePropType } from "react-native";

type ToySpriteImageProps = {
  toyId: CatToyId;
  size: number;
};

export function ToySpriteImage({ toyId, size }: ToySpriteImageProps) {
  const frame = getLargeToyFrame(toyId);
  if (frame) {
    return (
      <ToySheetSprite
        source={CAT_LARGE_TOY_SHEET}
        col={frame.col}
        row={frame.row}
        size={size}
      />
    );
  }

  const source = getCatToySource(toyId);
  if (!source) {
    return null;
  }

  return (
    <Image
      source={source as ImageSourcePropType}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}
