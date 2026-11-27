import { Fragment, useRef, type ComponentType, type ReactNode } from "react";
import { numberTileFaces, PuzzleDragBoard, PuzzleDragTile, PuzzleDropArea } from './PuzzleDragBoard';
import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { FeedbackTile, Land } from "@/components/puzzle/tiles/TileMotion";
import { Ink, Motion, PuzzleColors as GameColors, Quantity, Radius } from "@/constants/puzzle-theme";
import type { PairSumPuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import Animated, { ReduceMotion, withTiming } from "react-native-reanimated";
import { EquationTile, PairEquation, PAIR_TILE } from "./OperationEquation";
import { Pressable, StyleSheet, View } from "react-native";

type PairSumTaskProps = {
  AnswerRow?: ComponentType<{ children: ReactNode }>;
  puzzle: PairSumPuzzle;
  selectedIndices: number[];
  answered: boolean;
  isCorrect: boolean;
  onPairChange: (indices: number[]) => void;
  onDragStateChange: (dragging: boolean) => void;
  onToggleIndex: (index: number) => void;
};

/** Pair two tiles by tapping or dragging. Checked feedback refers to those same two tiles. */
export function PairSumTask({
  AnswerRow = Fragment,
  puzzle,
  selectedIndices,
  answered,
  isCorrect,
  onToggleIndex, onPairChange, onDragStateChange,
}: PairSumTaskProps) {
  const { t } = useTranslation();
  const { numbers, target } = puzzle.payload;
  const sources = useRef<Record<number, View | null>>({});
  const destinations = useRef<(View | null)[]>([]);
  const starts = useRef<Record<number, { x: number; y: number }>>({});
  const measurePick = (index: number, slot: number, done: () => void) => {
    const source = sources.current[index], dest = destinations.current[slot];
    if (!source || !dest) return done();
    source.measureInWindow((sx, sy) => dest.measureInWindow((dx, dy) => {
      starts.current[index] = { x: sx - dx, y: sy - dy };
      done();
    }));
  };
  const picked = selectedIndices.map(i => numbers[i]);
  const wrong = answered && !isCorrect && picked.length === 2;

  return (
    <View style={styles.wrap}>
      {!answered && <View nativeID="play-entry-model" testID="play-entry-model" style={styles.sumRow}>
        <PairEquation target={target} slots={[0, 1].map(slot => {
          const index = selectedIndices[slot], start = starts.current[index];
          return <View key={slot} collapsable={false} ref={node => { destinations.current[slot] = node; }}>
            <EquationTile face="empty" />
            {index !== undefined && <Animated.View key={index} style={StyleSheet.absoluteFill}
              entering={() => {
                'worklet';
                const timing = { duration: 240, reduceMotion: ReduceMotion.System };
                return { initialValues: { transform: [{ translateX: start?.x ?? 0 }, { translateY: start?.y ?? 12 }] },
                  animations: { transform: [{ translateX: withTiming(0, timing) }, { translateY: withTiming(0, timing) }] } };
              }}>
              <EquationTile face="number" value={numbers[index]} />
            </Animated.View>}
          </View>;
        })} />
      </View>}
      {!answered ? <AnswerRow><PuzzleDragBoard floatingStyle={numberTileFaces.lifted} onDragStateChange={onDragStateChange}
        onDrop={(source, target) => {
          const a = Number(source), b = Number(target);
          if (a !== b) measurePick(a, 0, () => measurePick(b, 1, () => onPairChange([a, b])));
        }}>
        <View style={styles.grid}>{numbers.map((number, i) => <PuzzleDropArea fillOnly key={i} id={String(i)} label={String(number)}>
          <View collapsable={false} ref={node => { sources.current[i] = node; }}><PuzzleDragTile id={String(i)} label={String(number)} disabled={false} grip face={<Text maxFontSizeMultiplier={1} style={styles.tileText}>{number}</Text>} selected={selectedIndices.includes(i)}
            style={[styles.numberTile, selectedIndices.includes(i) ? numberTileFaces.lifted : numberTileFaces.resting]}
            accessibilityLabel={t('learning.numberTile', { number, position: i + 1 })} accessibilityHint={t('placement.pairCue')}
            onPress={() => selectedIndices.includes(i) ? onToggleIndex(i) : measurePick(i, selectedIndices.length === 1 ? 1 : 0, () => onToggleIndex(i))} actions={numbers.flatMap((value, j) => j === i ? [] :
              [{ id: String(j), label: t('placement.partner', { value, position: j + 1 }) }])} /></View>
        </PuzzleDropArea>)}</View>
      </PuzzleDragBoard></AnswerRow> : <View style={styles.grid}>
        {numbers.map((num, index) => {
          const selected = selectedIndices.includes(index);
          const isCorrectTile = answered && isCorrect && selected;
          const isWrongTile = answered && !isCorrect && selected;
          const order = selectedIndices.indexOf(index);
          return (
            <FeedbackTile key={index} result={selected ? isCorrect ? "correct" : "wrong" : null}
              mark={!isWrongTile} delay={isCorrectTile ? order * Motion.tap : 0}>
              <Pressable style={[styles.tile, isCorrectTile && styles.tileCorrect, isWrongTile && styles.tileWrong]}
                disabled accessibilityRole="button" accessibilityLabel={String(num)} accessibilityState={{ selected, disabled: true }}>
                <Text maxFontSizeMultiplier={1} style={styles.tileText}>{num}</Text>
              </Pressable>
              {order >= 0 ? <Land key={`b${order}`} style={styles.pickBadge}><Text style={styles.pickBadgeText}>{order + 1}</Text></Land> : null}
            </FeedbackTile>
          );
        })}
      </View>}

      {answered && <View style={styles.sumRow} accessibilityLiveRegion="polite">
        <PairEquation target={target} miss={wrong} slots={[0, 1].map(slot =>
          <EquationTile key={slot} value={picked[slot]} face={picked[slot] === undefined ? 'empty' : wrong && slot === 1 ? 'target' : 'number'} />)} />
      </View>}

      {wrong ? <Land><Text style={styles.actual}>{`${picked[0]} + ${picked[1]} = ${picked[0] + picked[1]}`}</Text></Land> : null}

    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: moderateScale(16), paddingTop: moderateScale(4) },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: moderateScale(12), justifyContent: "center", paddingVertical: moderateScale(6) },
  tile: {
    width: PAIR_TILE, height: PAIR_TILE, paddingVertical: 2, borderRadius: Radius.tray, borderBottomWidth: 3,
    borderBottomColor: Quantity.amber.edge, backgroundColor: Quantity.amber.fill, alignItems: "center", justifyContent: "center", paddingHorizontal: moderateScale(12),
  },
  tileCorrect: { borderColor: GameColors.success, backgroundColor: GameColors.successSurface },
  tileWrong: { borderColor: GameColors.incorrect, backgroundColor: GameColors.incorrectSurface },
  pickBadge: { position: "absolute", bottom: -moderateScale(6), left: -moderateScale(8), width: moderateScale(24), height: moderateScale(24), borderRadius: moderateScale(12),
    backgroundColor: Quantity.violet.fill, alignItems: "center", justifyContent: "center" },
  pickBadgeText: { fontSize: moderateScale(14), lineHeight: moderateScale(18), fontWeight: "800", color: GameColors.primaryDark },
  numberTile: { width: PAIR_TILE, minWidth: PAIR_TILE, height: PAIR_TILE, minHeight: PAIR_TILE, paddingHorizontal: 12, paddingVertical: 2 },
  tileText: { fontSize: 26, fontWeight: "800", color: Ink.text, textAlign: "center", includeFontPadding: false, fontVariant: ["tabular-nums"] },
  sumRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: moderateScale(10) },
  actual: { fontSize: moderateScale(18), fontWeight: "800", color: Ink.soft, textAlign: "center", fontVariant: ["tabular-nums"] },
  hint: { fontSize: moderateScale(15), lineHeight: moderateScale(21), fontWeight: "600", color: Ink.soft, textAlign: "center" },
});
