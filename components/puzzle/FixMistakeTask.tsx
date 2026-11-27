import { Fragment, type ComponentType, type ReactNode } from "react";
import { useChoiceLayout } from '@/components/puzzle/useChoiceLayout';
import { ModelTray } from '@/components/puzzle/kit/PuzzleKit';
import { Land, StrikeThrough } from '@/components/puzzle/tiles/TileMotion';
import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { ChoiceButton } from "@/components/puzzle/ChoiceButton";
import { Ink, Motion, PuzzleColors, Quantity } from "@/constants/puzzle-theme";
import type { FixMistakePuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { StyleSheet, useWindowDimensions, View } from "react-native";

type FixMistakeTaskProps = {
  AnswerRow?: ComponentType<{ children: ReactNode }>;
  puzzle: FixMistakePuzzle;
  checkedModel?: ReactNode;
  checkedResult?: "correct" | "wrong";
  selectedIndex: number | null;
  isCorrect: boolean;
  answered: boolean;
  incorrectAttempt?: boolean;
  onSelect: (index: number) => void;
};

const LINE = /^\s*(\d+)\s*([+−×÷-])\s*(\d+)\s*=\s*(-?\d+)\s*$/;

/** Columns (from the right) that receive a carried 1 when a and b are added. */
function carries(a: string, b: string) {
  const out = new Set<number>();
  let carry = 0;
  for (let k = 0; k < Math.max(a.length, b.length); k++) {
    const sum = Number(a[a.length - 1 - k] ?? 0) + Number(b[b.length - 1 - k] ?? 0) + carry;
    carry = sum >= 10 ? 1 : 0;
    if (carry) out.add(k + 1);
  }
  return out;
}

/**
 * Minka's attempt written as column working (for + and −), one digit per
 * column, so a child can find the slip digit by digit. After a correct repair
 * an amber face identifies the slip and the repaired total lands below.
 */
function Working({ line, fixed, correct }: { line: string; fixed: string | null; correct: string | undefined }) {
  const { fontScale } = useWindowDimensions();
  const digitWidth = Math.max(56, moderateScale(29) * Math.min(fontScale, 2));
  const m = LINE.exec(line);
  if (!m || !['+', '−', '-'].includes(m[2])) {
    return <View style={styles.inline}>
      <View><Text style={[styles.line, fixed !== null && styles.struck]}>{line}</Text>{fixed !== null ? <StrikeThrough /> : null}</View>
      {fixed !== null ? <Land delay={Motion.step}><Text style={[styles.line, styles.fixed]}>{fixed}</Text></Land> : null}
    </View>;
  }
  const [, a, op, b, result] = m;
  const width = Math.max(a.length, b.length, result.length, fixed?.length ?? 0);
  const cells = (s: string) => s.padStart(width, ' ').split('');
  const carried = fixed !== null && op === '+' ? carries(a, b) : new Set<number>();
  const changed = (k: number) => !!correct && cells(result)[k] !== cells(correct)[k];
  const row = (s: string, style?: object, mark?: (k: number) => object | false) =>
    cells(s).map((d, k) => <Text key={k} style={[styles.digit, { width: digitWidth }, d.trim() && styles.tile, style, mark?.(k)]}>{d === ' ' ? '' : d}</Text>);
  return <View style={styles.columns} accessible accessibilityLabel={line}>
    {carried.size ? <Land delay={Motion.step * 2} style={styles.inline}>
      <Text style={styles.op} />{cells(a).map((_, k) => <Text key={k} style={[styles.digit, { width: digitWidth }, styles.carry]}>{carried.has(width - 1 - k) ? '1' : ''}</Text>)}
    </Land> : null}
    <View style={styles.inline}><Text style={styles.op} />{row(a)}</View>
    <View style={styles.inline}><Text style={styles.op}>{op === '-' ? '−' : op}</Text>{row(b)}</View>
    <View style={styles.rule} />
    <View style={styles.inline}>
      <Text style={styles.op} />
      <View style={styles.inline}>{row(result, undefined, k => changed(k) && styles.resultTile)}</View>
    </View>
    {fixed !== null ? <Land delay={Motion.step} style={styles.inline}>
      <Text style={styles.op} />{row(fixed, styles.fixed)}
    </Land> : null}
  </View>;
}

export function FixMistakeTask({
  AnswerRow = Fragment,
  puzzle,
  checkedModel,
  checkedResult,
  selectedIndex,
  isCorrect,
  answered,
  incorrectAttempt = false,
  onSelect,
}: FixMistakeTaskProps) {
  const { wrongWork, choices } = puzzle.payload;
  const sums = choices.map(choice => LINE.exec(choice));
  const base = sums[0];
  const sameOperands = base && sums.every(sum => sum && sum[1] === base[1] && sum[2] === base[2] && sum[3] === base[3]);
  const labels = sameOperands ? sums.map(sum => sum![4]) : choices;
  const choiceLayout = useChoiceLayout(labels, true);
  const repaired = answered && isCorrect ? choices[puzzle.correctIndex]?.split('=').pop()?.trim() ?? null : null;

  const locked = answered || checkedModel != null || checkedResult !== undefined;
  const result = checkedResult ?? (locked || incorrectAttempt ? (isCorrect ? "correct" : "wrong") : null);
  const markedIndex = checkedResult === undefined && isCorrect ? puzzle.correctIndex : selectedIndex;

  return (
    <View style={styles.wrap}>
      {checkedModel ?? (
        <ModelTray style={styles.card}>
          <View style={styles.work}>
            {wrongWork.map(line => <Working key={line} line={line} fixed={repaired} correct={sums[puzzle.correctIndex]?.[4]} />)}
          </View>
        </ModelTray>
      )}

      <AnswerRow>
        <View onLayout={choiceLayout.onLayout} style={choiceLayout.container}>
          {choices.map((choice, index) => (
            <ChoiceButton
              key={`${puzzle.id}-${choice}`}
              label={labels[index]}
              accessibilityAnswer={labels[index]}
              style={choiceLayout.item}
              selected={selectedIndex === index}
              disabled={locked}
              result={index === markedIndex ? result : null}
              onPress={() => onSelect(index)}
            />
          ))}
        </View>
      </AnswerRow>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: moderateScale(12) },
  card: { alignItems: "center", gap: moderateScale(6), paddingVertical: moderateScale(12) },
  work: { gap: moderateScale(8), alignItems: "center" },
  columns: { alignItems: "flex-end", gap: 4 },
  tile: { minHeight: 56, lineHeight: 56, fontSize: 24, borderRadius: 10, overflow: "hidden", backgroundColor: Quantity.teal.fill },
  resultTile: { backgroundColor: Quantity.amber.light },
  digit: { textAlign: "center", fontSize: moderateScale(28), lineHeight: moderateScale(36), fontWeight: "800", color: Ink.text, fontVariant: ["tabular-nums"] },
  carry: { fontSize: moderateScale(16), lineHeight: moderateScale(18), color: PuzzleColors.success },
  op: { width: moderateScale(26), fontSize: moderateScale(28), lineHeight: moderateScale(36), fontWeight: "800", color: Ink.text, textAlign: "left" },
  rule: { alignSelf: "stretch", height: 6, backgroundColor: Quantity.teal.soft, borderRadius: 3, marginVertical: moderateScale(2) },
  inline: { flexDirection: "row", alignItems: "center", gap: 4 },
  line: { fontSize: moderateScale(24), fontWeight: "800", color: Ink.text, fontVariant: ["tabular-nums"], marginHorizontal: moderateScale(5) },
  struck: { color: Ink.soft },
  fixed: { color: PuzzleColors.success },
});
