import { CompareTrays } from './counting/CompareTrays';
import { EntryBuild } from './kit/PracticeAffordances';
import { ProofWindow } from './counting/ProofWindow';
import { canSnapshotCanvas } from './counting/useModelPaint';
import { QuantityEquation } from './counting/QuantityEquation';
import { useProofAnnouncement } from './counting/useProofAnnouncement';
import { evaluateExpression } from '@/utils/puzzle-math';
import { useRevealBeats } from './kit/useRevealBeats';
import { RevealSurface } from './kit/RevealSurface';
import { useState, type ReactNode } from 'react';
import { Caption } from './kit/Focus';
import { LandingFrame } from './counting/CountingLane';
import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { UnitRun } from './kit/UnitRun';
import { Ink, ProofMotion, Shape, PuzzleColors as GameColors } from "@/constants/puzzle-theme";
import type { ComparePuzzle, MathOperator } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

type CompareTaskProps = {
  puzzle: ComparePuzzle;
  selectedIndex: number | null;
  isCorrect: boolean;
  answered: boolean;
  incorrectAttempt?: boolean;
  playbackOwnsControls?: boolean;
  checkedModel?: ReactNode;
  onSelect: (index: number) => void;
};

export function CompareTask({
  puzzle,
  selectedIndex,
  isCorrect,
  answered,
  incorrectAttempt = false,
  playbackOwnsControls = false,
  checkedModel,
  onSelect,
}: CompareTaskProps) {
  const object = puzzle.payload.object;
  const options = [
    { label: puzzle.payload.optionA, index: 0 as const },
    { label: puzzle.payload.optionB, index: 1 as const },
  ];

  if (playbackOwnsControls && checkedModel != null) return <>{checkedModel}</>;

  if (object) return <CompareTrays object={object} counts={options.map(option => Number(option.label))} selected={selectedIndex}
    onSelect={answered || playbackOwnsControls ? undefined : onSelect} />;
  const modelID = playbackOwnsControls ? 'play-proof-model' : undefined;
  return (
    <View nativeID={modelID} testID={modelID} style={styles.row}>
      {options.map(({ label, index }) => {
        if (playbackOwnsControls) {
          return <View key={index} style={[styles.proofTray, styles.optionShell]} accessible
            accessibilityLabel={label}>
            <Text style={styles.optionLabel}>{label}</Text>
          </View>;
        }
        const selected = selectedIndex === index;
        const isCorrectOption =
          answered && isCorrect && index === puzzle.correctIndex;
        const isWrongPick = (answered || incorrectAttempt) && !isCorrect && selected;

        return (
          <View key={index} style={styles.optionShell}>
            <Pressable
              style={({ pressed }) => [
                styles.option,
                selected && !answered && styles.optionSelected,
                isCorrectOption && styles.optionCorrect,
                isWrongPick && styles.optionWrong,
                answered && !selected && !isCorrectOption && styles.optionMuted,
                pressed && !answered && styles.pressed,
              ]}
              disabled={answered}
              onPress={() => onSelect(index)}
              accessibilityRole="button"
              accessibilityState={{ disabled: answered, selected }}
              accessibilityLabel={label}
            >
              {!answered ? <EntryBuild index={index}><Text style={styles.optionLabel}>{label}</Text></EntryBuild> : answered && <Text style={styles.optionLabel}>{label}</Text>}
              {(isCorrectOption || isWrongPick) && <Text accessible={false} style={[styles.mark, { color: isCorrectOption ? GameColors.success : GameColors.incorrect }]}>{isCorrectOption ? '✓' : '×'}</Text>}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

function comparisonValue(label: string) {
  if (/^\d+\/\d+$/.test(label)) {
    const [n, d] = label.split('/').map(Number);
    return n / d;
  }
  const parts = label.replaceAll('−', '-').split(/\s+/);
  return evaluateExpression(parts.filter((_, i) => i % 2 === 0).map(Number), parts.filter((_, i) => i % 2 === 1) as MathOperator[]);
}

export function CompareReveal({ puzzle, selectedIndex, mode = 'worked', onSolutionShown }: {
  puzzle: ComparePuzzle; selectedIndex?: number | null; mode?: 'attempt' | 'worked'; onSolutionShown?: () => void;
}) {
  const { t } = useTranslation();
  const { optionA, optionB, object } = puzzle.payload;
  const options = [optionA, optionB], [a, b] = options.map(comparisonValue);
  const pairs = object ? Math.min(Number(optionA), Number(optionB)) : 2;
  const attempt = mode === 'attempt';
  const count = attempt ? 1 : pairs + 1;
  const clock = useRevealBeats(count, { awaitInitialPaint: !!object && canSnapshotCanvas, reducedSteps: true, minTotal: 0, lead: 45,
    step: object ? Math.min(220, Math.floor(3500 / count)) : ProofMotion.group,
    hold: 0, onDone: onSolutionShown });
  const paired = Math.min(pairs, clock.landed);
  const submitted = t('play.answerLabel', { answer: options[selectedIndex ?? 0] });
  const result = a !== null && b !== null ? optionA + (a === b ? ' = ' : a > b ? ' > ' : ' < ') + optionB : puzzle.explanation;
  const running = (n: number) => object ? t('friendlyQ.pairs', { n, defaultValue: 'Pairs matched: {{n}}' }) : options.join('     ');
  useProofAnnouncement(clock, attempt ? submitted : clock.settled ? result : running(paired), true);
  return <RevealSurface beats={clock}><LandingFrame step={clock.landed} reduced={clock.reduced}>
    {object ? <CompareTrays counts={options.map(Number)} object={object} selected={selectedIndex ?? null} beats={clock} worked={!attempt} /> :
      <View nativeID="play-proof-model" testID="play-proof-model"><ProofWindow focus={selectedIndex === 1 ? .75 : .25}>
      {options.map((label, tray) => <View key={tray} style={[styles.proofTray, selectedIndex === tray && styles.optionSelected, !attempt && clock.settled && tray === puzzle.correctIndex && styles.optionCorrect]}>
        <Caption strong>{['A', 'B'][tray]} · {label}</Caption>
        {label.includes('/') && <FractionStrip label={label} />}
        {!attempt && !label.includes('/') && clock.landed > tray && <Caption>{label} = {[a,b][tray]}</Caption>}
      </View>)}
      </ProofWindow></View>}
    {!attempt && <QuantityEquation text={result} settled={clock.settled} />}
  </LandingFrame></RevealSurface>;
}

function FractionStrip({label}: {label: string}) {
  const [width, setWidth] = useState(0);
  const [filled, count] = label.split('/').map(Number);
  return <View style={{height: 36}} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
    {width > 0 && <UnitRun width={width} height={36} count={count} filled={filled} hue="violet" />}
  </View>;
}

const styles = StyleSheet.create({
  proofTray: { borderRadius: 18, backgroundColor: Ink.tray, padding: 8, gap: 4, marginBottom: 8 },
  pressed: { transform: [{ translateY: 2 }] },
  mark: { position: "absolute", top: 5, right: 8, fontSize: 18, fontWeight: "800" },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: moderateScale(12),
  },
  optionShell: {
    flex: 1,
    flexShrink: 1,
  },
  option: {
    gap: moderateScale(10),
    minHeight: moderateScale(120),
    borderRadius: moderateScale(18),
    borderBottomWidth: Shape.lip,
    borderColor: GameColors.cardBorder,
    backgroundColor: Ink.tray,
    alignItems: "center",
    justifyContent: "center",
    padding: moderateScale(14),
  },
  optionSelected: {
    borderColor: GameColors.secondary,
    backgroundColor: GameColors.selectedSurface,
  },
  optionCorrect: {
    borderColor: GameColors.success,
    backgroundColor: GameColors.successSurface,
  },
  optionWrong: {
    borderColor: GameColors.incorrect,
    backgroundColor: GameColors.incorrectSurface,
  },
  optionMuted: {
    opacity: 0.75,
  },
  optionLabel: {
    fontSize: moderateScale(18),
    fontWeight: "700",
    color: GameColors.text,
    textAlign: "center",
    lineHeight: moderateScale(26),
  },
});
