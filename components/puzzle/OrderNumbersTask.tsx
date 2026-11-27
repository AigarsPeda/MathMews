import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { Announce } from "@/components/puzzle/tiles/Announce";
import { FeedbackTile, Land, landTick } from "@/components/puzzle/tiles/TileMotion";
import { Ink, Motion, PuzzleColors as GameColors, Quantity, Shape, Stroke } from "@/constants/puzzle-theme";
import type { OrderNumbersPuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { patternDigitSize } from "@/components/puzzle/PatternNextTask";
import { numberTileFaces, PuzzleDragBoard, PuzzleDragTile, PuzzleDropArea, TileLabel } from "./PuzzleDragBoard";

type OrderNumbersTaskProps = {
  puzzle: OrderNumbersPuzzle;
  order: number[];
  answered: boolean;
  isCorrect: boolean;
  onMove: (from: number, to: number) => void;
  onSwap: (from: number, to: number) => void;
  onDragStateChange: (dragging: boolean) => void;
};

/** The entry row and the proof share one tile size (56–64 pt) and one even gap, filling the stage width and centred. */
/** The lane above and below the row: the hint at entry, empty in the proof, so the row sits at the same y in every state. */
export const HINT_LANE = moderateScale(44);
export function orderLayout(windowWidth: number, n: number) {
  const avail = windowWidth - 44;
  const tile = Math.max(56, Math.min(64, Math.floor((avail - (n - 1) * 8) / n)));
  const gap = n > 1 ? Math.max(8, Math.min(20, Math.floor((avail - n * tile) / (n - 1)))) : 0;
  return { tile, gap, width: n * tile + (n - 1) * gap };
}

/** Round line ends a little outside the numbers (10, 20 … or 100, 200 …). */
function lineRange(values: number[]) {
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = Math.max(1, hi - lo);
  const unit = span <= 12 ? 1 : span <= 25 ? 5 : 10 ** Math.floor(Math.log10(span)) * (span / 10 ** Math.floor(Math.log10(span)) < 3 ? .5 : 1);
  return { min: Math.floor(lo / unit) * unit - (lo % unit === 0 ? unit : 0), max: Math.ceil(hi / unit) * unit + (hi % unit === 0 ? unit : 0) };
}

/**
 * After Check: a number line under the rail, the numbers' real sizes. Each
 * number drops onto its point, smallest first, so "larger" is a distance,
 * not only a position in the row.
 */
function MagnitudeLine({ values, rowWidth }: { values: number[]; rowWidth: number }) {
  const [width, setWidth] = useState(0);
  const sorted = [...values].sort((a, b) => a - b);
  const { min, max } = lineRange(values);
  const inset = moderateScale(14);
  const x = (v: number) => inset + (v - min) / (max - min) * (width - inset * 2);
  return <View style={[styles.line, { width: rowWidth }]} onLayout={e => setWidth(e.nativeEvent.layout.width)} accessible={false} pointerEvents="none">
    <View style={styles.lineAxis} />
    {width > 0 ? <>
      {[min, max].map(v => <View key={`e${v}`} style={[styles.lineEnd, { left: x(v) - moderateScale(20) }]}>
        <View style={styles.lineTick} /><Text style={styles.lineEndText}>{v}</Text>
      </View>)}
      {sorted.map((v, i) => <Land key={v} delay={i * Motion.step / 2} style={[styles.linePoint, { left: x(v) - moderateScale(20), ...(i % 2 ? { top: moderateScale(3), flexDirection: "column-reverse" as const } : null) }]}>
        <View style={styles.lineDot} />
        <Text style={styles.lineValue}>{v}</Text>
      </Land>)}
    </> : null}
  </View>;
}

/**
 * Each number can move to another position on the rail.
 * Dragging a number or tapping it and its destination inserts it at that position. After Check the row pops left to
 * right and "<" signs appear between the places; misplaced numbers shake;
 * the numbers then land on a number line by size.
 */
export function OrderNumbersTask({
  puzzle,
  order,
  answered,
  isCorrect,
  onMove,
  onDragStateChange,
}: OrderNumbersTaskProps) {
  const { t } = useTranslation();
  const { correctOrder } = puzzle.payload;
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const solved = answered && isCorrect;
  const { width: screen, fontScale } = useWindowDimensions();
  const { tile: col, gap, width: rowW } = orderLayout(screen, order.length);
  const columns = order.length;

  function tapSlot(index: number) {
    if (answered) return;
    if (selectedSlot === null) setSelectedSlot(index);
    else {
      if (selectedSlot !== index) { onMove(selectedSlot, index); landTick(); }
      setSelectedSlot(null);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.hintLane} />
      <View style={[styles.rail, { width: rowW }]}>
        <PuzzleDragBoard floatingStyle={numberTileFaces.lifted}
          onDragStateChange={onDragStateChange}
          onDrop={(source, target) => {
            if (!answered) {
              setSelectedSlot(null);
              onMove(order.indexOf(Number(source)), order.indexOf(Number(target)));
              landTick();
            }
          }}
        >
          <View style={[styles.row, { width: rowW, gap }]}>
            {order.map((value, index) => {
              const isCorrectSlot = solved && value === correctOrder[index];
              const isWrongSlot = answered && !isCorrect && value !== correctOrder[index];

              // Keep the number and its measured drop target together during reorders.
              return (
                <PuzzleDropArea
                  key={value}
                  id={String(value)}
                  motionId={String(value)}
                  insertion
                  label={t("puzzleTypes.orderPosition", { position: index + 1 })}
                >
                  <FeedbackTile result={isCorrectSlot ? "correct" : isWrongSlot ? "wrong" : null} delay={solved ? index * Motion.tap : 0}>
                    <PuzzleDragTile
                      id={String(value)}
                      motionId={String(value)}
                      label={String(value)}
                      disabled={answered}
                      face={<TileLabel label={String(value)} size={patternDigitSize(col, String(value).length, fontScale)} selected={!answered && selectedSlot === index} />}
                      selected={!answered && selectedSlot === index}
                      onPress={() => tapSlot(index)}
                      style={[
                        selectedSlot === index ? numberTileFaces.lifted : styles.tileResting, { width: col, minWidth: col, height: col, minHeight: col, borderRadius: Shape.tile(col) },
                        isWrongSlot && styles.tileWrong,
                      ]}
                      accessibilityLabel={t("puzzleTypes.orderTile", { value, position: index + 1 })}
                      accessibilityHint={t("placement.orderCue")}
                      actions={order.flatMap((targetValue, position) => position === index ? [] : [{
                        id: String(targetValue),
                        label: t("puzzleTypes.orderMoveTo", { position: position + 1 }),
                      }])}
                    />
                  </FeedbackTile>
                </PuzzleDropArea>
              );
            })}
          </View>
          {/* Solved: the order is written with "<" between neighbours. */}
          {solved && columns === order.length && gap >= 14 ? <View style={[styles.relations, { width: rowW }]} accessible={false} pointerEvents="none">
            {order.slice(1).map((_, i) => <Text key={i} style={[styles.less, { left: (i + 1) * (col + gap) - gap / 2 - moderateScale(9), top: col / 2 - moderateScale(14) }]}>{"<"}</Text>)}
          </View> : null}
        </PuzzleDragBoard>
        {answered && <MagnitudeLine values={order} rowWidth={rowW} />}
      </View>

      {/* VoiceOver hears each completed pick, swap or move: the picked number, or the new order. */}
      {!answered ? <Announce trigger={`${selectedSlot}|${order.join(",")}`}
        message={selectedSlot === null ? order.join(", ") : t("placement.orderPicked", { value: order[selectedSlot] })} /> : null}
      {/* The hint hangs in a lane below the row; an equal empty lane above keeps the row centred. */}
      <View style={styles.hintLane}>
        {!answered ? <Text style={styles.hint} maxFontSizeMultiplier={1.3} accessibilityLiveRegion="polite">
          {selectedSlot === null ? t("placement.orderCue") : t("placement.orderPicked", { value: order[selectedSlot] })}
        </Text> : null}
      </View>
    </View>
  );
}

const ROW_W = orderLayout(390, 4).width;
const styles = StyleSheet.create({
  // The row alone sets the model's size, so it is centred in the stage; the hint hangs below it.
  wrap: { alignSelf: "stretch" },
  rail: { alignSelf: "center" },
  // The number line shown after Check: same width as the rail's row; values alternate above/below so near numbers never collide.
  line: { width: ROW_W, height: moderateScale(58), justifyContent: "center" },
  lineAxis: { position: "absolute", left: moderateScale(14), right: moderateScale(14), top: moderateScale(28), height: Stroke.outline, borderRadius: 1, backgroundColor: Ink.text },
  lineEnd: { position: "absolute", top: moderateScale(23), width: moderateScale(40), alignItems: "center" },
  lineTick: { width: Stroke.outline, height: moderateScale(12), backgroundColor: Ink.text },
  lineEndText: { fontSize: moderateScale(14), lineHeight: moderateScale(18), fontWeight: "700", color: Ink.soft, fontVariant: ["tabular-nums"] },
  linePoint: { position: "absolute", top: moderateScale(22), width: moderateScale(40), alignItems: "center" },
  lineDot: { width: moderateScale(12), height: moderateScale(12), borderRadius: moderateScale(6), backgroundColor: Quantity.teal.fill, borderBottomWidth: 3, borderBottomColor: Quantity.teal.edge },
  lineValue: { fontSize: moderateScale(15), lineHeight: moderateScale(19), fontWeight: "800", color: Quantity.teal.edge, fontVariant: ["tabular-nums"] },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  // One tile colour in every state: teal. Amber only flags the one wrong tile after a miss.
  tileResting: { borderWidth: 0, borderBottomWidth: 3, borderBottomColor: Quantity.teal.edge, backgroundColor: Quantity.teal.fill },
  tileWrong: { backgroundColor: Quantity.amber.fill, borderBottomColor: Quantity.amber.edge },
  relations: { position: "absolute", left: 0, top: 0 },
  less: { position: "absolute", width: moderateScale(18), textAlign: "center", fontSize: moderateScale(20), lineHeight: moderateScale(26),
    fontWeight: "800", color: GameColors.success },
  hintLane: { height: HINT_LANE, justifyContent: "center" },
  hint: {
    fontSize: moderateScale(18),
    lineHeight: moderateScale(24),
    fontWeight: "600",
    color: Ink.soft,
    textAlign: "center",
  },
});
