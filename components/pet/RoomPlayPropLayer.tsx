import { Canvas, Group, Image, FilterMode, MipmapMode } from "@shopify/react-native-skia";
import type { RoomPlayPropFrame } from "@/pet-display/media/sprite/room-play-prop";
import { getRoomDepthZIndex } from "@/utils/room-depth";
import { StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useDerivedValue, type SharedValue } from "react-native-reanimated";

type Props = {
  frame: SharedValue<RoomPlayPropFrame>;
  x: SharedValue<number>;
  y: SharedValue<number>;
  scale: SharedValue<number>;
  facing: SharedValue<number>;
  size: number;
  width: number;
  height: number;
};

/** One synchronized toy canvas beside the cat, independently sorted among furniture. */
export function RoomPlayPropLayer({ frame, x, y, scale, facing, size, width, height }: Props) {
  const cell = Math.floor(size * .9);
  const image = useDerivedValue(() => frame.get().image);
  const imageX = useDerivedValue(() => -frame.get().col * cell);
  const imageY = useDerivedValue(() => -frame.get().row * cell);
  const depth = useAnimatedStyle(() => ({
    opacity: frame.get().image ? 1 : 0,
    zIndex: getRoomDepthZIndex(y.get() + (size / 2 - cell + cell * frame.get().groundY) * scale.get()),
  }));
  const position = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }, { scaleX: facing.get() }],
  }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, depth]}>
    <Animated.View style={[{ position: "absolute", left: width / 2 - size / 2, top: height / 2 - size / 2, width: size, height: size }, position]}>
      <Canvas style={{ position: "absolute", left: (size - cell) / 2, top: size - cell, width: cell, height: cell }}>
        <Group clip={{ x: 0, y: 0, width: cell, height: cell }}>
          <Image image={image} x={imageX} y={imageY} width={cell * 4} height={cell * 3} fit="fill"
            sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.None }} />
        </Group>
      </Canvas>
    </Animated.View>
  </Animated.View>;
}
