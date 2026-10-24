import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { IconText as Text } from '@/components/ui/IconText';
import { PuzzleObjectImage } from './PuzzleObjectImage';
import { PuzzleCatPortrait } from './PuzzleCatPortrait';
import { createGuidedLesson } from '@/constants/guided-learning';
import { GameColors } from '@/constants/game';
import type { LearningLesson } from '@/types/curriculum';
import type { AppLocale } from '@/types/locale';
import type { PetType } from '@/types/game';
import { moderateScale } from '@/utils/scale';

type Props = { lesson: LearningLesson; locale: AppLocale; variant: number; petType: PetType; catSkinId?: string; onFinish: () => void; onAnother: () => void; onBack: () => void };
/** Local teaching state only. Scored answer and wallet operations never enter this component. */
export function GuidedLearning({ lesson, locale, variant, petType, catSkinId, onFinish, onAnother, onBack }: Props) {
  const { t } = useTranslation();
  const [content] = useState(() => createGuidedLesson(lesson, variant));
  const [index, setIndex] = useState(0);
  const step = content.steps[index];
  const [selected, setSelected] = useState<number[]>([]);
  const [count, setCount] = useState(step.kind === 'counters' ? step.initial : 0);
  const [feedback, setFeedback] = useState<'hint' | 'correct' | null>(null);
  const finished = useRef(false);
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    if (feedback) scroll.current?.scrollToEnd({ animated: false });
    else scroll.current?.scrollTo({ y: 0, animated: false });
  }, [feedback, index]);
  const correct = feedback === 'correct', final = index === content.steps.length - 1;
  function check() {
    const ok = step.kind === 'choice' ? selected[0] === step.correct : step.kind === 'parts' ? selected.length === step.target : count === step.target;
    setFeedback(ok ? 'correct' : 'hint');
    if (ok && final && !finished.current) { finished.current = true; onFinish(); }
  }
  function next() {
    const nextStep = content.steps[index + 1];
    setIndex(index + 1); setSelected([]); setCount(nextStep.kind === 'counters' ? nextStep.initial : 0); setFeedback(null);
  }
  const enabled = step.kind !== 'choice' || selected.length > 0;
  return <View style={styles.screen}>
    <ScrollView ref={scroll} contentContainerStyle={styles.content} onContentSizeChange={() => {
      if (feedback) scroll.current?.scrollToEnd({ animated: false });
      else scroll.current?.scrollTo({ y: 0, animated: false });
    }}>
      <View style={styles.companion}>
        <PuzzleCatPortrait petType={petType} catSkinId={catSkinId} mood={correct ? 'correct' : 'idle'} size={82} />
        <View style={styles.copy}><Text accessibilityRole="header" style={styles.title}>{t('guided.title')}</Text><Text style={styles.body}>{t('guided.promise')}</Text></View>
      </View>
      <Text style={styles.lesson}>{lesson.title[locale]}</Text>
      <Text style={styles.caption}>{t('guided.step', { current: index + 1, total: content.steps.length })}</Text>
      <Text accessibilityRole="header" style={styles.question}>{step.prompt[locale]}</Text>
      {step.kind === 'choice' && step.diagram ? <View style={styles.diagram} accessible accessibilityLabel={t(step.diagram.length === 2 ? 'guided.unequalDiagram' : 'guided.equalDiagram')}>
        {step.diagram.map((width, i) => <View key={i} style={[styles.diagramPart, { flex: width }, i % 2 === 0 && styles.colored]} />)}
      </View> : null}
      {step.kind === 'counters' ? <View style={styles.board}>
        <View style={styles.grid}>{Array.from({ length: step.groupSize ? step.total : Math.max(10, Math.ceil(step.total / 5) * 5) }, (_, i) => <Pressable key={i} disabled={correct || i >= count}
          accessibilityRole="button" accessibilityLabel={t(i < count ? 'guided.removeRibbon' : 'guided.emptySpace', { number: i + 1 })}
          accessibilityState={{ disabled: correct || i >= count }} onPress={() => { setCount(n => n - 1); setFeedback(null); }} style={[styles.cell, step.groupSize ? { width: `${(100 - (step.groupSize - 1) * 2) / step.groupSize}%` } : null]}>
          {i < count ? <PuzzleObjectImage object="ribbon" /> : <Text style={styles.caption}>{i + 1}</Text>}
        </Pressable>)}</View>
        <Text style={styles.body} accessibilityLiveRegion="polite">{t('guided.packed', { count, remaining: step.total - count })}</Text>
        {count < step.total && !correct ? <Pressable disabled={correct} onPress={() => { setCount(n => Math.min(step.total, n + 1)); setFeedback(null); }} style={styles.add} accessibilityRole="button" accessibilityState={{ disabled: correct }}>
          <View style={styles.ribbon}><PuzzleObjectImage object="ribbon" /></View><Text style={styles.buttonText}>{t('guided.moveRibbon')}</Text>
        </Pressable> : null}
      </View> : null}
      {step.kind === 'parts' ? <View style={styles.parts}>
        {Array.from({ length: step.denominator }, (_, i) => <Pressable key={i} disabled={correct} accessibilityRole="button" accessibilityLabel={t('guided.part', { number: i + 1, total: step.denominator })} accessibilityState={{ selected: selected.includes(i), disabled: correct }}
          onPress={() => { setSelected(values => values.includes(i) ? values.filter(v => v !== i) : [...values, i]); setFeedback(null); }}
          style={[styles.part, selected.includes(i) && styles.colored]}><Text style={styles.body}>{i + 1}</Text></Pressable>)}
      </View> : null}
      {step.kind === 'choice' ? <View style={styles.choices}>{step.choices.map((choice, i) => <Pressable key={i} disabled={correct} onPress={() => { setSelected([i]); setFeedback(null); }} accessibilityRole="button" accessibilityState={{ selected: selected[0] === i, disabled: correct }}
        style={[styles.choice, selected[0] === i && styles.selected]}><Text style={styles.answer}>{choice[locale]}</Text></Pressable>)}</View> : null}
      {feedback ? <View style={styles.feedback} accessibilityLiveRegion="polite"><Text style={styles.feedbackTitle}>{t(correct ? 'guided.discovered' : 'guided.tryStep')}</Text><Text style={styles.body}>{correct ? step.explanation[locale] : step.hint[locale]}</Text></View> : null}
      {correct && final ? <Text style={styles.body}>{t('guided.finished')}</Text> : <Pressable onPress={() => setFeedback('hint')} disabled={correct} style={styles.help} accessibilityRole="button"><Text style={styles.helpText}>{t('guided.showMe')}</Text></Pressable>}
    </ScrollView>
    <View style={styles.dock}>
      <Pressable accessibilityRole="button" disabled={!correct && !enabled} accessibilityState={{ disabled: !correct && !enabled }} style={[styles.primary, !correct && !enabled && styles.disabled]} onPress={correct ? final ? onAnother : next : check}>
        <Text style={styles.primaryText}>{t(correct ? final ? 'guided.another' : 'guided.next' : 'guided.check')}</Text>
      </Pressable>
      <Pressable onPress={onBack} style={styles.help} accessibilityRole="button"><Text style={styles.helpText}>{t('guided.back')}</Text></Pressable>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { padding: moderateScale(20), gap: moderateScale(16) },
  companion: { flexDirection: 'row', alignItems: 'center', gap: 12 }, copy: { flex: 1, gap: 6 },
  title: { fontSize: moderateScale(24), fontWeight: '800', color: GameColors.text }, lesson: { fontSize: moderateScale(18), fontWeight: '700', color: GameColors.text },
  body: { fontSize: moderateScale(16), lineHeight: moderateScale(23), color: GameColors.text }, caption: { fontSize: moderateScale(14), color: GameColors.textMuted },
  question: { fontSize: moderateScale(21), lineHeight: moderateScale(29), fontWeight: '700', color: GameColors.text },
  board: { gap: 14 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: '2%' }, cell: { width: '18.4%', aspectRatio: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: GameColors.card, borderWidth: 1, borderColor: GameColors.cardBorder, borderRadius: 8, marginBottom: 6 },
  ribbon: { width: 38, height: 38 }, add: { flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 52, padding: 8, backgroundColor: '#E8FAF8', borderRadius: 12 }, buttonText: { flex: 1, color: GameColors.secondaryDark, fontSize: 17, fontWeight: '700' },
  parts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, part: { flexBasis: '45%', flexGrow: 1, minHeight: 72, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: GameColors.secondaryDark, backgroundColor: GameColors.card, borderRadius: 8 },
  diagram: { flexDirection: 'row', gap: 4, minHeight: 70 }, diagramPart: { backgroundColor: GameColors.cardBorder, borderWidth: 1, borderColor: GameColors.textMuted }, colored: { backgroundColor: GameColors.secondary },
  choices: { gap: 10 }, choice: { borderWidth: 2, borderColor: GameColors.cardBorder, borderRadius: 12, backgroundColor: GameColors.card, padding: 14, minHeight: 52 }, selected: { borderColor: GameColors.secondaryDark, backgroundColor: '#E8FAF8' }, answer: { fontSize: 18, lineHeight: 25, fontWeight: '700', color: GameColors.text },
  feedback: { gap: 6, paddingVertical: 8 }, feedbackTitle: { fontSize: 18, fontWeight: '800', color: GameColors.secondaryDark },
  dock: { paddingHorizontal: 20, paddingTop: 10, gap: 4 }, primary: { minHeight: 54, borderRadius: 16, padding: 14, backgroundColor: GameColors.primary, justifyContent: 'center', alignItems: 'center' }, primaryText: { color: GameColors.card, fontSize: 18, fontWeight: '800', textAlign: 'center' }, disabled: { opacity: 0.5 }, help: { minHeight: 48, alignItems: 'center', justifyContent: 'center', padding: 8 }, helpText: { color: GameColors.secondaryDark, fontSize: 16, fontWeight: '700', textAlign: 'center' },
});
