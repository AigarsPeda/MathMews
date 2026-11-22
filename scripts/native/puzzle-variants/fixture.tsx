import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PlaySession, type PuzzleLayoutMeasurement } from '@/app/play';
import { PuzzlePreviewGame } from '@/components/dev/PuzzlePreviewGame';
import { AppIcon } from '@/components/ui/AppIcon';
import { ExpoUIHost } from '@/components/ui/ExpoUIHost';
import { GameColors as C } from '@/constants/game';
import { useLocale } from '@/contexts/LocaleProvider';
import { getTopicPreviews } from './catalog';

export default function PuzzleVariantsFixture() {
  const { locale } = useLocale();
  const { t } = useTranslation();
  const topics = useMemo(() => getTopicPreviews(locale), [locale]);
  const [playing, setPlaying] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const [layout, setLayout] = useState<PuzzleLayoutMeasurement>();
  const current = playing === null ? undefined : topics[playing];
  const close = () => setPlaying(null);

  return <SafeAreaView style={styles.screen} edges={['bottom']}>
    <Text style={styles.heading}>{t('developer.topicList', { total: topics.length })}</Text>
    <FlatList data={topics} keyExtractor={item => item.topic.id} contentContainerStyle={styles.list}
      renderItem={({ item: { topic, puzzle }, index }) => {
        const title = topic.id === 'multiplication' ? t('topic.multiplication') : topic.title[locale];
        const overflow = layout?.puzzleId === puzzle.id ? Math.ceil(layout.contentHeight - layout.viewportHeight) : undefined;
        return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={() => setPlaying(index)} style={styles.item}>
          <AppIcon name={topic.icon} size={32} />
          <View style={styles.copy}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.question}>{puzzle.response?.prompt ?? puzzle.question}</Text>
            {overflow !== undefined && <Text style={styles.measurement}>
              {overflow <= 1 ? t('developer.taskFits') : t('developer.taskScroll', { distance: overflow })}
            </Text>}
          </View>
        </Pressable>;
      }} />
    {current && playing !== null && <Modal visible presentationStyle="fullScreen" onRequestClose={close}>
      <SafeAreaProvider><ExpoUIHost>
        <PuzzlePreviewGame key={`${current.puzzle.id}-${revision}`}>
          <PlaySession session={current.session} onLayoutMeasured={setLayout} preview={{
            onExit: close,
            onRepeat: () => setRevision(value => value + 1),
            onNext: () => setPlaying((playing + 1) % topics.length),
          }} />
        </PuzzlePreviewGame>
      </ExpoUIHost></SafeAreaProvider>
    </Modal>}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.background },
  heading: { marginHorizontal: 16, marginVertical: 12, fontSize: 22, fontWeight: '800', color: C.text },
  list: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card,
    borderColor: C.cardBorder, borderWidth: 1, borderRadius: 12, padding: 14 },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 17, fontWeight: '700', color: C.text },
  question: { fontSize: 14, lineHeight: 20, color: C.textMuted },
  measurement: { fontSize: 13, color: C.secondaryDark },
});
