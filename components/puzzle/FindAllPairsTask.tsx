import { GameColors } from "@/constants/game";
import type { FindAllPairsPuzzle } from "@/types/puzzle";
import { getValidPairs } from "@/utils/puzzle-type";
import { moderateScale } from "@/utils/scale";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

const pairColors = [
  { background: "#E8FAF8", ink: "#006D68" },
  { background: "#F3EEFF", ink: "#65409A" },
  { background: "#FFF0DB", ink: "#875100" },
  { background: "#EAF2FF", ink: "#285DA1" },
  { background: "#FCEBF2", ink: "#A03565" },
  { background: "#EDF5DF", ink: "#48651E" },
];
function pairColor(index: number) {
  // Additional authored pairs get their own hue instead of repeating a color.
  const hue = (index * 137.508) % 360;
  return pairColors[index] ?? { background: `hsl(${hue}, 65%, 94%)`, ink: `hsl(${hue}, 65%, 27%)` };
}

export function FindAllPairsTask({ puzzle, pairs, answered, onChange, canAttempt = true, onIncorrectAttempt }: {
  puzzle: FindAllPairsPuzzle; pairs: [number, number][]; answered: boolean;
  onChange: (pairs: [number, number][]) => void;
  canAttempt?: boolean;
  onIncorrectAttempt?: () => boolean;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const rejectedPair = useRef<string | null>(null);
  const { numbers, target } = puzzle.payload;
  const validPairs = getValidPairs(numbers, target);
  const total = validPairs.length;
  const colorIndex = (a: number, b: number) => validPairs.findIndex(([left, right]) => (left === a && right === b) || (left === b && right === a));
  const nextPair = validPairs.findIndex(([a, b]) => !pairs.some(([left, right]) => left === a && right === b));
  const selectionColor = pairColor(Math.max(0, nextPair));
  function choose(index: number) {
    if (answered || !canAttempt) return;
    rejectedPair.current = null;
    setMessage("");
    setSelected(current => current.includes(index) ? current.filter(i => i !== index) : current.length === 2 ? [index] : [...current, index]);
  }
  function addPair() {
    if (answered || !canAttempt || selected.length !== 2) return;
    const [a, b] = [...selected].sort((left, right) => left - right);
    if (numbers[a] + numbers[b] !== target) {
      const key = `${a}:${b}`;
      if (rejectedPair.current === key) return;
      rejectedPair.current = key;
      if (onIncorrectAttempt && !onIncorrectAttempt()) return;
      setMessage(t("learning.pairWrong", { target })); return;
    }
    if (pairs.some(([left, right]) => left === a && right === b)) { setMessage(t("learning.pairDuplicate")); return; }
    onChange([...pairs, [a, b]]);
    setSelected([]);
    setMessage(t("learning.pairFound"));
  }
  return <View style={styles.wrap}>
    <Text style={styles.goal}>{t("learning.collectPairs", { target })}</Text>
    <Text style={styles.progress} accessibilityLiveRegion="polite">{t("learning.pairsProgress", { count: pairs.length, total })}</Text>
    <View style={styles.tiles}>{numbers.map((number, index) => {
      const collected = pairs.find(([a, b]) => a === index || b === index);
      const color = selected.includes(index) ? selectionColor : collected ? pairColor(colorIndex(...collected)) : null;
      return <Pressable key={index} onPress={() => choose(index)} disabled={answered || !canAttempt}
      accessibilityRole="button" accessibilityLabel={t("learning.numberTile", { number, position: index + 1 })} accessibilityState={{ selected: selected.includes(index), disabled: answered || !canAttempt }}
      style={[styles.tile, color && { borderColor: color.ink, backgroundColor: color.background }, selected.includes(index) && styles.selected]}>
      <Text style={[styles.number, color && { color: color.ink }]}>{number}</Text>
    </Pressable>;
    })}</View>
    {!answered && <Pressable onPress={addPair} disabled={!canAttempt || selected.length !== 2} accessibilityRole="button" accessibilityState={{ disabled: !canAttempt || selected.length !== 2 }} style={[styles.add, (!canAttempt || selected.length !== 2) && styles.disabled]}>
      <Text style={styles.addText}>{t("learning.savePair")}</Text>
    </Pressable>}
    <Text style={styles.feedback} accessibilityLiveRegion="polite">{message || t("learning.pairInstructions")}</Text>
    <View style={styles.collection}>{pairs.map(([a, b]) => {
      const color = pairColor(colorIndex(a, b));
      return <Pressable key={`${a}:${b}`} disabled={answered} onPress={() => onChange(pairs.filter(([left,right]) => left !== a || right !== b))}
      accessibilityRole="button" accessibilityLabel={t("learning.removePair", { a: numbers[a], b: numbers[b] })} style={[styles.pair, { backgroundColor: color.background, borderColor: color.ink }]}>
      <Text style={[styles.pairText, { color: color.ink }]}>{numbers[a]} + {numbers[b]} = {target}</Text>
    </Pressable>;
    })}</View>

  </View>;
}
const styles = StyleSheet.create({
  wrap: { gap: moderateScale(14) }, goal: { fontSize: moderateScale(22), fontWeight: "800", color: GameColors.text, textAlign: "center" },
  progress: { fontSize: moderateScale(16), color: "#5D408C", fontWeight: "700", textAlign: "center" },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: moderateScale(12), justifyContent: "center" },
  tile: { minHeight: moderateScale(60), minWidth: moderateScale(64), padding: moderateScale(12), borderRadius: moderateScale(14), borderWidth: 2, borderColor: GameColors.cardBorder, backgroundColor: GameColors.card, alignItems: "center", justifyContent: "center" },
  selected: { borderWidth: 3 },
  number: { fontSize: moderateScale(24), fontWeight: "800", color: GameColors.text },
  add: { minHeight: moderateScale(48), backgroundColor: "#F3EEFF", borderRadius: moderateScale(14), padding: moderateScale(12), alignItems: "center", justifyContent: "center" },
  addText: { color: "#5D408C", fontSize: moderateScale(17), fontWeight: "800" },
  disabled: { opacity: 0.5 }, feedback: { minHeight: moderateScale(44), color: GameColors.text, fontSize: moderateScale(15), lineHeight: moderateScale(22), textAlign: "center" },
  collection: { gap: moderateScale(8) }, pair: { minHeight: moderateScale(48), borderRadius: moderateScale(12), borderWidth: 2, padding: moderateScale(12) },
  pairText: { fontSize: moderateScale(18), fontWeight: "700", color: GameColors.secondaryDark, textAlign: "center" },
});
