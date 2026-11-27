import { LineDot } from './number-line/LineMarks';
import { DiagramIcon } from "@/components/puzzle/kit/DiagramIcon";
import { ModelTray } from "@/components/puzzle/kit/PuzzleKit";
import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { FeedbackTile } from "@/components/puzzle/tiles/TileMotion";
import { OpenLineCheck, openLinePlan } from "@/components/puzzle/tiles/OpenLineCheck";
import { Ink, PuzzleColors as GameColors, Quantity } from "@/constants/puzzle-theme";
import type { TrueFalsePuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { Fragment, type ComponentType, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

type TrueFalseTaskProps = {
  AnswerRow?: ComponentType<{ children: ReactNode }>;
  hasHostedProof?: boolean;
  statementLabel?: string; arithmeticModel?: boolean; claimHeading?: boolean;
  playbackOwnsControls?: boolean;
  puzzle: TrueFalsePuzzle;
  selectedIndex: number | null;
  isCorrect: boolean;
  answered: boolean;
  incorrectAttempt?: boolean;
  onSelect: (index: number) => void;
};

const plain = (label: string) => label.replace(/\s*[✓✔✗✘]\s*$/u, "");

export function TrueFalseTask({
  AnswerRow = Fragment,
  hasHostedProof = false,
  statementLabel, arithmeticModel = false, claimHeading = false,
  playbackOwnsControls = false,
  puzzle,
  selectedIndex,
  isCorrect,
  answered,
  incorrectAttempt = false,
  onSelect,
}: TrueFalseTaskProps) {
  const { t } = useTranslation();
  const { width, fontScale } = useWindowDimensions();
  const correctIndex = puzzle.isTrue ? 0 : 1;
  const options = [
    // ✓ and ✗ are reserved for checked results, so the option labels are plain words.
    { label: plain(t("puzzleTypes.trueLabel")), index: 0 },
    { label: plain(t("puzzleTypes.falseLabel")), index: 1 },
  ];

  const showStatement = !hasHostedProof && (!puzzle.payload.hideStatement || (answered && isCorrect));

  const { statement } = puzzle.payload;
  // Allow one line for the claim itself, after screen and tray padding.
  const claimWidth = statement.length * moderateScale(28) * fontScale * 0.65;
  const line = arithmeticModel ? openLinePlan(statement) : null;
  const pinClaim = !arithmeticModel && AnswerRow !== Fragment && !/[\r\n]/.test(statement) && claimWidth <= width - moderateScale(72);
  const signedClaim = showStatement && (statementLabel || claimHeading) ? (
    <View style={styles.compactClaim} accessible={!claimHeading}
      accessibilityLabel={statementLabel ? `${t("puzzleTypes.minkaSays")} ${statementLabel}` : undefined}>
      <DiagramIcon name="cat" size={28} />
      <Text accessibilityRole={claimHeading ? 'header' : undefined} maxFontSizeMultiplier={claimHeading ? 1.45 : undefined}
        style={styles.compactClaimText}>{claimHeading ? `${t("puzzleTypes.minkaSays")} ${statement}` : statement}</Text>
    </View>
  ) : showStatement ? (
    <ModelTray style={styles.statementCard}>
      <View style={styles.signature}>
        <DiagramIcon name="cat" size={moderateScale(28)} />
        <Text style={styles.signatureLabel}>{t("puzzleTypes.minkaSays")}</Text>
      </View>
      <Text style={styles.statement}>{statement}</Text>
    </ModelTray>
  ) : null;

  if (hasHostedProof || playbackOwnsControls) return signedClaim;

  return (
    <View style={styles.wrap}>
      {arithmeticModel && signedClaim ? <View nativeID="play-entry-model" testID="play-entry-model" style={styles.claimModel}>
        <View accessible accessibilityLabel={statement} style={styles.mathClaim}>
          <DiagramIcon name="cat" size={28} /><Text maxFontSizeMultiplier={1.4} style={styles.mathText}>{statement}</Text>
        </View>
        {line && <View style={styles.track}><View style={[styles.start, line.hops[0] < 0 ? { right: 0 } : { left: 0 }]}><LineDot /></View></View>}
      </View> : !pinClaim && signedClaim}
      <AnswerRow>
        {pinClaim && signedClaim}
        <View style={styles.row}>
          {options.map(({ label, index }) => {
            const selected = selectedIndex === index;
            const isCorrectOption = answered && isCorrect && index === correctIndex;
            const isWrongPick = (answered || incorrectAttempt) && !isCorrect && selected;

            return (
              <FeedbackTile key={index} style={styles.optionShell} selected={selected && !answered} result={isCorrectOption ? "correct" : isWrongPick ? "wrong" : null}>
                <Pressable
                  style={({ pressed }) => [
                    styles.option,
                    selected && !answered && styles.optionSelected,
                    isCorrectOption && styles.optionCorrect,
                    isWrongPick && styles.optionWrong,
                    answered && !selected && !isCorrectOption && styles.optionMuted,
                    pressed && !answered && styles.optionPressed,
                  ]}
                  disabled={answered}
                  onPress={() => onSelect(index)}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: answered, selected }}
                >
                  <View style={styles.optionContent}>
                    <Text style={[styles.optionLabel, selected && !answered && styles.optionLabelSelected, isCorrectOption && styles.labelCorrect, isWrongPick && styles.labelWrong]}>{label}</Text>
                  </View>
                </Pressable>
              </FeedbackTile>
            );
          })}
        </View>
      </AnswerRow>
      {/* After Check, an arithmetic claim is worked on an open number line, hop by hop. */}
      {answered && isCorrect && showStatement ? <OpenLineCheck statement={puzzle.payload.statement} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  claimModel: { alignSelf: 'stretch', alignItems: 'center', gap: 28, paddingVertical: 12 },
  mathClaim: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 8, backgroundColor: Ink.tray },
  mathText: { flexShrink: 1, fontSize: 24, fontWeight: '800', color: Ink.text, textAlign: 'center' },
  track: { alignSelf: 'stretch', marginHorizontal: 14, height: 12, borderRadius: 6, backgroundColor: Quantity.teal.fill },
  start: { position: 'absolute', top: -8, width: 28, height: 31 },
  wrap: { gap: moderateScale(12) },
  // The claim is a given: flat, printed, never shaped like a button. Signature and claim share one line
  // (the claim wraps below when it is long), so the answer row stays well above the dock.
  compactClaim: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 4, borderRadius: 12, backgroundColor: Ink.tray },
  compactClaimText: { flexShrink: 1, textAlign: 'center', fontWeight: '800', fontSize: moderateScale(18), color: Ink.text },
  statementCard: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", columnGap: moderateScale(12), rowGap: moderateScale(4),
    paddingVertical: moderateScale(10) },
  signature: { flexDirection: "row", alignItems: "center", gap: moderateScale(6) },
  signatureLabel: { fontSize: moderateScale(15), fontWeight: "700", color: Ink.soft },
  statement: { flexGrow: 1, fontSize: moderateScale(28), lineHeight: moderateScale(36), fontWeight: "800", color: GameColors.text, textAlign: "center", fontVariant: ["tabular-nums"] },
  row: { flexDirection: "row", alignItems: "flex-start", gap: moderateScale(12) },
  optionShell: { flex: 1, flexShrink: 1 },
  option: {
    minHeight: moderateScale(56),
    borderRadius: moderateScale(16),
    borderBottomWidth: 3,
    borderColor: Ink.soft,
    backgroundColor: Ink.tray,
    alignItems: "center",
    justifyContent: "center",
    padding: moderateScale(12),
  },
  optionSelected: { borderColor: GameColors.primary, backgroundColor: GameColors.selectedSurface },
  optionCorrect: { borderColor: GameColors.success, backgroundColor: GameColors.successSurface },
  optionWrong: { borderColor: GameColors.incorrect, backgroundColor: GameColors.incorrectSurface },
  optionMuted: { opacity: 0.6 },
  optionContent: { flexDirection: "row", alignItems: "center", gap: moderateScale(8) },
  optionLabel: { fontSize: moderateScale(20), fontWeight: "800", color: GameColors.text },
  optionLabelSelected: { color: GameColors.primaryDark },
  optionPressed: { backgroundColor: GameColors.selectedSurface },
  labelCorrect: { color: GameColors.success },
  labelWrong: { color: GameColors.incorrect },
});
