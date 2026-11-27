import { CheckedPuzzleReveal } from '@/components/puzzle/CheckedPuzzleReveal';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { HelpFractionSort } from '@/components/puzzle/help/HelpFractionSort';
import { HelpCaptionContext } from '@/components/puzzle/kit/HelpCaptionContext';
import { HelpProofContext } from '@/components/puzzle/kit/HelpProofContext';
import { Ink } from '@/constants/puzzle-theme';
import type { MigratedHelpKey } from '@/constants/help-examples';
import type { Puzzle } from '@/types/puzzle';
import { effectivePuzzlePrompt, freezeCheckedAttempt } from '@/utils/checked-attempt';
import { puzzleQADraft } from '@/utils/puzzle-qa-draft';
import { moderateScale } from '@/utils/scale';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const noop = () => {};
/** The pre-warmed proof under the hidden sheet narrates nothing: its caption would show over an empty model. */
const ignoreCaption = () => {};
/** The native sheet needs about this long to measure and slide in; the proof starts after it so no beat is played unseen. */
const SHEET_SETTLE_MS = 800;
/** The sheet's own chrome around the model area: top padding, title, question, a two-line rule, the button, gaps and the bottom pad. */
const SHEET_CHROME = 196;
/** The equation and the playback row sit under the model inside the model area. */
const UNDER_MODEL = 112;

/**
 * One worked example per kind of maths. It plays the example's own correct-answer proof,
 * the same model, motion and equation as the puzzle's reveal, and starts as soon as it opens.
 */
export function HelpExample({ helpKey, example, sheetHeight }: { helpKey: MigratedHelpKey; example: Puzzle; sheetHeight?: number }) {
  const { t } = useTranslation();
  const snapshot = useMemo(() => {
    const fixture = puzzleQADraft(example, 'correct');
    if (!fixture) return null;
    // The correct-answer fixture arrives already dealt. Help teaches the deal itself, so every piece starts in the pile.
    const arrangement = { ...fixture.arrangement, distribution: fixture.arrangement.distribution.map(() => 0) };
    return freezeCheckedAttempt(example, effectivePuzzlePrompt(example, t), fixture.draft, fixture.answer, arrangement, fixture.correct);
  }, [example, t]);
  const [run, setRun] = useState(0);
  // The beat caption of a narrated proof takes the rule line's place while it plays.
  const [caption, setCaption] = useState<string | null>(null);
  // The model area runs from the question to the rule line. The sheet scrolls past its maximum height, so fill exactly that.
  const { height: screen } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheet = sheetHeight ?? screen * 0.88 - insets.top - insets.bottom - moderateScale(48);
  const [measured, setMeasured] = useState(0);
  const area = measured || Math.max(240, Math.floor(sheet - SHEET_CHROME));
  const proof = useMemo(() => ({ height: area - UNDER_MODEL }), [area]);
  useEffect(() => {
    const start = setTimeout(() => setRun(1), SHEET_SETTLE_MS);
    return () => clearTimeout(start);
  }, []);
  return <>
    <Text accessibilityRole="header" style={styles.title}>{t(`visualHelp.examples.${helpKey}.title`)}</Text>
    <Text style={styles.question}>{t(`visualHelp.examples.${helpKey}.question`)}</Text>
    <HelpProofContext.Provider value={proof}>
      <HelpCaptionContext.Provider value={run ? setCaption : ignoreCaption}>
      <View style={[styles.model, !run && styles.waiting]}
        onLayout={e => { const h = Math.floor(e.nativeEvent.layout.height); if (sheetHeight && h >= 200) setMeasured(h); }}>
        {helpKey === 'fraction_sort' && example.type === 'sort_buckets' && example.payload.rule === 'fractions'
          ? <HelpFractionSort key={run} payload={example.payload} height={proof.height} />
          : snapshot && <CheckedPuzzleReveal key={run} modelOnly snapshot={snapshot} mode="worked" onSolutionShown={noop} />}
      </View>
      </HelpCaptionContext.Provider>
    </HelpProofContext.Provider>
    <View style={styles.ruleSlot}>
      <Text style={[styles.rule, caption ? styles.hidden : null]}>{t(`visualHelp.examples.${helpKey}.rule`)}</Text>
      {caption ? <View pointerEvents="none" style={styles.caption}><Text style={styles.captionText}>{caption}</Text></View> : null}
    </View>
  </>;
}

const styles = StyleSheet.create({
  title: { fontWeight: '800', textAlign: 'center', color: Ink.text, fontSize: moderateScale(24), lineHeight: moderateScale(30) },
  question: { fontWeight: '700', textAlign: 'center', color: Ink.text, fontSize: 20, lineHeight: 28 },
  // The model takes whatever the sheet leaves between the question and the rule, whatever the rule's line count.
  model: { alignSelf: 'stretch', justifyContent: 'center', flexGrow: 1, flexBasis: 0 },
  waiting: { opacity: 0 },
  rule: { fontWeight: '700', textAlign: 'center', color: Ink.soft, fontSize: 18, lineHeight: 26 },
  ruleSlot: { alignSelf: 'stretch' },
  hidden: { opacity: 0 },
  caption: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center' },
  captionText: { fontWeight: '700', textAlign: 'center', color: Ink.text, fontSize: 22, lineHeight: 28 },
});
