import { getPuzzleObjectAsset } from "@/constants/puzzle-object-assets";
import type { PuzzleObject } from "@/types/puzzle-object";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

export function PuzzleObjectImage({ object, primary = false }: { object: PuzzleObject; primary?: boolean }) {
  return <Image source={getPuzzleObjectAsset(object, primary)} contentFit="contain" style={styles.image} accessible={false} />;
}

/** Equal cell sizes keep quantity comparisons fair and the objects easy to count. */
export function PuzzleObjectCollection({ object, count, capacity }: { object: PuzzleObject; count: number; capacity: number }) {
  const columns = 3;
  const rows = Math.max(2, Math.ceil(capacity / columns));
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[styles.collection, { aspectRatio: columns / (rows * 0.85) }]}>
    {Array.from({ length: rows }, (_, row) => <View key={row} style={styles.row}>
      {Array.from({ length: columns }, (_, column) => <View key={column} style={styles.cell}>
        {row * columns + column < count ? <PuzzleObjectImage object={object} /> : null}
      </View>)}
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  image: { width: "100%", height: "100%" },
  collection: { width: "100%" },
  row: { flex: 1, flexDirection: "row" },
  cell: { flex: 1, padding: 2 },
});
