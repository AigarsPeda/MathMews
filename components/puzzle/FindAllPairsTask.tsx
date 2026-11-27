import { EquationTile, PAIR_TILE } from './OperationEquation';
import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { Announce } from "@/components/puzzle/tiles/Announce";
import { FeedbackTile, FlyIn, landTick } from "@/components/puzzle/tiles/TileMotion";
import { Ink, PuzzleColors as GameColors, Quantity, Radius } from "@/constants/puzzle-theme";
import type { FindAllPairsPuzzle } from "@/types/puzzle";
import { getValidPairs } from "@/utils/puzzle-type";
import { moderateScale } from "@/utils/scale";
import { Fragment, type ComponentType, type ReactNode, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View, type GestureResponderEvent } from "react-native";

type Point = { x: number; y: number };

/** Collected pairs stay editable. A rejected pair can spend a life only once per selection. */
export function FindAllPairsTask({ AnswerRow = Fragment, puzzle, pairs, answered, onChange, canAttempt = true, missedPair, onIncorrectAttempt }: {
  AnswerRow?: ComponentType<{ children: ReactNode }>;
  puzzle: FindAllPairsPuzzle; pairs: [number, number][]; answered: boolean;
  onChange: (pairs: [number, number][]) => void;
  canAttempt?: boolean; missedPair?: readonly number[];
  onIncorrectAttempt?: () => boolean;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number[]>([]);
  const [notice, setNotice] = useState<"pairFound" | "pairDuplicate" | "pairWrong" | null>(null);
  const [rejected, setRejected] = useState<number[]>([]);
  const rejectedPair = useRef<string | null>(null);
  const touches = useRef(new Map<number, Point>());
  // Flight origins and well centres are state so render never reads mutable refs.
  const [flights, setFlights] = useState<Record<string, Point>>({});
  const wells = useRef<(View | null)[]>([]);
  const [wellCentres, setWellCentres] = useState<(Point | null)[]>([]);
  const { numbers, target } = puzzle.payload;
  const validPairs = getValidPairs(numbers, target);
  const total = validPairs.length;
  function choose(index: number, event?: GestureResponderEvent) {
    if (answered || !canAttempt) return;
    rejectedPair.current = null;
    setNotice(null);
    setRejected([]);
    if (event?.nativeEvent) touches.current.set(index, { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });
    landTick();
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
      setRejected([a, b]);
      setNotice("pairWrong"); return;
    }
    if (pairs.some(([left, right]) => left === a && right === b)) { setNotice("pairDuplicate"); return; }
    const from = [a, b].map(i => touches.current.get(i)).filter((p): p is Point => !!p);
    if (from.length === 2) setFlights(f => ({ ...f, [`${a}:${b}`]: { x: (from[0].x + from[1].x) / 2, y: (from[0].y + from[1].y) / 2 } }));
    onChange([...pairs, [a, b]]);
    setSelected([]);
    setNotice("pairFound");
  }
  const measureWell = (i: number) => wells.current[i]?.measureInWindow?.((x, y, width, height) => { setWellCentres(c => { const next = [...c]; next[i] = { x: x + width / 2, y: y + height / 2 }; return next; }); });
  const message = notice ? t(`learning.${notice}`, { target }) : "";
  const ready = canAttempt && selected.length === 2;
  return <View style={styles.wrap}>
    {/* VoiceOver hears each found, rejected or removed pair with the running count. */}
    <Announce trigger={`${pairs.length}|${message}`} message={[message, t("learning.pairsProgress", { count: pairs.length, total })].filter(Boolean).join(". ")} />
    <View style={{ alignItems: "center" }}><EquationTile value={target} face="target" /></View>
    <View style={styles.collection}>{pairs.map((pair, i) => {
      const key = `${pair[0]}:${pair[1]}`;
      const remove = () => {
        setNotice(null);
        onChange(pairs.filter(([left, right]) => left !== pair[0] || right !== pair[1]));
      };
      const button = <Pressable disabled={answered} onPress={remove} accessibilityRole="button"
        accessibilityLabel={t("learning.removePair", { a: numbers[pair[0]], b: numbers[pair[1]] })} style={styles.pair}>
        <Text style={styles.pairText}>{numbers[pair[0]]} + {numbers[pair[1]]}</Text>
      </Pressable>;
      return <View key={key} ref={view => { wells.current[i] = view; }} onLayout={() => measureWell(i)} collapsable={false} style={styles.well}>
        {wellCentres[i] && flights[key] ? <FlyIn from={flights[key]} to={wellCentres[i]}>{button}</FlyIn> : button}
      </View>;
    })}</View>
    <View nativeID={answered ? undefined : "play-entry-model"} testID={answered ? undefined : "play-entry-model"} style={styles.tiles}>{numbers.map((number, index) => {
      const collected = pairs.findIndex(([a, b]) => a === index || b === index);
      const isSelected = selected.includes(index);
      return <FeedbackTile key={index} selected={isSelected} result={rejected.includes(index) ? "wrong" : null}>
        <Pressable testID={`pair-choice-${index}`} onPress={event => choose(index, event)} disabled={answered || !canAttempt}
          accessibilityRole="button" accessibilityLabel={t("learning.numberTile", { number, position: index + 1 })} accessibilityState={{ selected: isSelected, disabled: answered || !canAttempt }}
          style={({ pressed }) => [styles.tile, !answered && collected >= 0 && styles.collected, isSelected && styles.selected, (missedPair?.includes(index) || rejected.includes(index)) && styles.rejected, pressed && styles.pressed]}>
          <Text maxFontSizeMultiplier={1} style={[styles.number, isSelected && styles.selectedNumber]}>{number}</Text>
        </Pressable>
      </FeedbackTile>;
    })}</View>
    {!answered && <AnswerRow><Pressable onPress={addPair} disabled={!ready} accessibilityRole="button" accessibilityState={{ disabled: !ready }}
      style={({ pressed }) => [styles.add, !ready && styles.disabled, pressed && ready && styles.addPressed]}>
      <Text style={styles.addText}>{t("learning.savePair")}</Text>
    </Pressable></AnswerRow>}
    {notice === "pairWrong" || notice === "pairDuplicate" ? <Text style={styles.feedback} accessibilityLiveRegion="polite">{message}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: moderateScale(10) },
  collection: { minHeight: 48, flexDirection: "row", flexWrap: "wrap", gap: moderateScale(10), justifyContent: "center" },
  well: { minWidth: moderateScale(96), minHeight: moderateScale(48), alignItems: "center", justifyContent: "center" },
  tiles: { flexDirection: "row", flexWrap: "wrap", columnGap: moderateScale(12), rowGap: 8, justifyContent: "space-evenly", paddingVertical: moderateScale(4) },
  tile: { height: PAIR_TILE, width: PAIR_TILE, paddingHorizontal: 12, borderRadius: Radius.tray, borderBottomWidth: 3, borderBottomColor: Quantity.teal.edge, backgroundColor: Quantity.teal.fill, alignItems: "center", justifyContent: "center" },
  pressed: { borderBottomWidth: 3 },
  collected: { borderBottomColor: Quantity.violet.edge, backgroundColor: Quantity.violet.fill, borderBottomWidth: 3 },
  selected: { borderBottomColor: Quantity.violet.edge, backgroundColor: Quantity.violet.fill, transform: [{ translateY: -2 }] },
  rejected: { borderBottomColor: Quantity.amber.edge, backgroundColor: Quantity.amber.fill },
  number: { fontSize: 26, fontWeight: "800", color: Ink.text, textAlign: "center", includeFontPadding: false, fontVariant: ["tabular-nums"] },
  selectedNumber: { color: Ink.text },
  add: { minHeight: moderateScale(50), borderRadius: Radius.control, borderBottomWidth: 3, borderBottomColor: Quantity.violet.edge, backgroundColor: Quantity.violet.soft, padding: moderateScale(10), alignItems: "center", justifyContent: "center" },
  addPressed: { borderBottomWidth: 3 },
  addText: { color: GameColors.primaryDark, fontSize: moderateScale(17), fontWeight: "800" },
  disabled: { opacity: 0.4 },
  feedback: { minHeight: moderateScale(22), color: Ink.text, fontSize: moderateScale(15), lineHeight: moderateScale(22), textAlign: "center" },
  pair: { minHeight: 44, minWidth: moderateScale(96), borderRadius: Radius.tray, borderBottomWidth: 3, borderBottomColor: Quantity.teal.edge, backgroundColor: Quantity.teal.soft,
    paddingHorizontal: moderateScale(12), alignItems: "center", justifyContent: "center" },
  pairText: { fontSize: 20, fontWeight: "800", color: Ink.text, fontVariant: ["tabular-nums"] },
});
