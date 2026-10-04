import { getCatRoomSource } from "@/constants/cat-rooms";
import { Image, StyleSheet, View } from "react-native";

type PetRoomBackgroundProps = {
  roomId?: string;
  cornerRadius?: number;
};

export function PetRoomBackground({
  roomId,
  cornerRadius = 0,
}: PetRoomBackgroundProps) {
  return (
    <View
      style={[
        styles.wrap,
        cornerRadius > 0 && {
          borderRadius: cornerRadius,
          overflow: "hidden",
        },
      ]}
      pointerEvents="none"
    >
      <Image
        source={getCatRoomSource(roomId)}
        style={styles.image}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#FFF5EB",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
