import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { CookieDeal } from '@/components/puzzle/CookieSharingBoard';
import { EverydayDiagram } from "@/components/puzzle/EverydayDiagram";
import { VisualExplanationPlayer } from "@/components/puzzle/VisualExplanationPlayer";
import { AppBottomSheet } from "@/components/ui/AppBottomSheet";
import { PuzzleColors as GameColors } from "@/constants/puzzle-theme";
import { getVisualExplanation, NUMBER_LINE_EXAMPLES } from "@/constants/visual-explanations";
import type { Puzzle } from "@/types/puzzle";
import { getPuzzleType } from "@/utils/puzzle-type";
import { moderateScale } from "@/utils/scale";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type VisualHelpSheetProps = {
  cost: number;
  coins: number;
  visible: boolean;
  puzzle: Puzzle;
  unlocked: boolean;
  onClose: () => void;
  onPurchase: () => boolean;
};

export function VisualHelpSheet({
  visible,
  puzzle,
  onClose,
}: VisualHelpSheetProps) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [progress, setProgress] = useState(0);
  const [play, setPlay] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const isNumberLine = getPuzzleType(puzzle) === "number_line";
  const explanation = getVisualExplanation(puzzle);
  const cookieExample = puzzle.type === 'fair_share' && puzzle.payload.object === 'cookie'
    ? { items: puzzle.payload.items === 7 ? 8 : 7, plates: puzzle.payload.people === 2 ? 3 : 2 } : null;
  const example = puzzle.type === 'multiple_choice' ? puzzle.everyday?.example : undefined;
  if (isNumberLine) explanation.keyframes = NUMBER_LINE_EXAMPLES[direction];
  const key = `${visible}-${puzzle.id}`;
  const [previousKey, setPreviousKey] = useState(key);
  if (key !== previousKey) { setPreviousKey(key); setPlay(0); setProgress(0); setDirection("forward"); }
  return (
    <AppBottomSheet backgroundColor={GameColors.background} visible={visible} onClose={onClose} expanded>
      <ScrollView
        style={[styles.scroll, { maxHeight: height * 0.88 - insets.top - insets.bottom - moderateScale(48) }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={Platform.OS === "android"}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>
            {example || cookieExample ? t('everyday.workedExample') : t(explanation.titleKey)}
          </Text>
          <Text style={styles.subtitle}>
            {t("visualHelp.numberLine.subtitle")}
          </Text>

          {isNumberLine ? (
            <View style={styles.directions}>
              {(["forward", "back"] as const).map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: direction === value }}
                  onPress={() => { setDirection(value); setProgress(0); }}
                  style={[styles.directionButton, direction === value && styles.directionSelected]}
                >
                  <Text style={[styles.directionText, direction === value && styles.directionTextSelected]}>
                    {t(`visualHelp.numberLine.${value}.label`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {cookieExample ? <>
            <Text style={styles.exampleQuestion}>{t('cookieShare.goal', { cookies: t('cookieShare.cookies', { count: cookieExample.items }), plates: cookieExample.plates })}</Text>
            <CookieDeal items={cookieExample.items} plates={cookieExample.plates} />
          </> : example ? <>
            <Text style={styles.exampleQuestion}>{example.question}</Text>
            <EverydayDiagram key={play} model={example.model} onSolutionShown={play ? finishExample : undefined} />
            {example.model.kind === 'bars'
              ? <Text style={styles.exampleExplanation}>{t('everyday.barHelp.' + example.model.task)}</Text>
              : <Text style={styles.exampleExplanation}>{example.explanation}</Text>}
            {!play && <Pressable style={styles.replay} accessibilityRole="button" onPress={() => setPlay(1)}>
              <Text style={styles.replayText}>{t('everyday.showExample')}</Text>
            </Pressable>}
          </> : <VisualExplanationPlayer explanation={explanation} progress={progress} onProgressChange={setProgress} stepByStep={isNumberLine} />}

          <Pressable
            style={[styles.closeBtn, styles.closeBtnPrimary]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("visualHelp.numberLine.tryPuzzle")}
          >
            <Text
              style={[
                styles.closeBtnText,
                styles.closeBtnTextPrimary,
              ]}
            >
              {t("visualHelp.numberLine.tryPuzzle")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </AppBottomSheet>
  );
}

const finishExample = () => {};

const styles = StyleSheet.create({
  replay: { minHeight: 48, justifyContent: "center", paddingHorizontal: 16, backgroundColor: GameColors.progressTrack, borderBottomWidth: 3, borderRadius: 12, borderColor: GameColors.cardBorder },
  replayText: { fontSize: 16, fontWeight: "800", color: GameColors.text },
  exampleQuestion: { color: GameColors.text, fontSize: 20, lineHeight: 28, fontWeight: '700', textAlign: 'center' },
  exampleExplanation: { color: GameColors.text, fontSize: 17, lineHeight: 26, alignSelf: 'stretch' },
  scroll: {
    width: "100%",
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: moderateScale(8),
  },
  card: {
    alignItems: "center",
    gap: moderateScale(10),
    paddingTop: moderateScale(12),
    paddingHorizontal: moderateScale(20),
  },
  title: {
    fontWeight: "800",
    textAlign: "center",
    color: GameColors.text,
    fontSize: moderateScale(22),
  },
  subtitle: {
    fontWeight: "500",
    textAlign: "center",
    fontSize: moderateScale(14),
    color: GameColors.textMuted,
    lineHeight: moderateScale(20),
  },
  directions: {
    width: "100%",
    flexDirection: "row",
    gap: moderateScale(8),
  },
  directionButton: {
    flex: 1,
    minHeight: moderateScale(44),
    padding: moderateScale(10),
    borderRadius: moderateScale(12),
    backgroundColor: GameColors.progressTrack,
    borderBottomWidth: 3,
    borderColor: GameColors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  directionSelected: {
    borderColor: GameColors.primary,
    backgroundColor: GameColors.primary,
  },
  directionText: {
    fontSize: moderateScale(15),
    fontWeight: "700",
    color: GameColors.text,
  },
  directionTextSelected: {
    color: GameColors.card,
  },
  closeBtn: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: moderateScale(4),
    minHeight: moderateScale(48),
    borderRadius: moderateScale(14),
  },
  closeBtnPrimary: {
    backgroundColor: GameColors.primary,
  },
  closeBtnText: {
    fontWeight: "700",
    fontSize: moderateScale(16),
    color: GameColors.textMuted,
  },
  closeBtnTextPrimary: {
    color: GameColors.card,
    fontWeight: "800",
  },
});
