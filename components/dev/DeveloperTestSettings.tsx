import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GameColors } from '@/constants/game';
import { DEVELOPER_TESTS } from '@/constants/developer-tests';
import { setDeveloperMode, useDeveloperMode } from '@/lib/developer-mode';

export function DeveloperTestSettings() {
  const router = useRouter(), { t } = useTranslation();
  const mode = useDeveloperMode();
  const [query, setQuery] = useState('');
  const selected = DEVELOPER_TESTS.find(test => test.id === mode);
  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" style={styles.button} onPress={() => router.canGoBack() ? router.back() : router.replace('/settings')}><Text style={styles.action}>{t('common.back')}</Text></Pressable>
      <Text style={styles.title}>{t('developer.title')}</Text>
      <Text style={styles.hint}>{t('developer.sessionHint')}</Text>
      <View style={styles.row}>
        <Text style={styles.name}>{t('developer.enabled')}</Text>
        <Switch accessibilityLabel={t('developer.enabled')} value={mode !== null}
          onValueChange={enabled => setDeveloperMode(enabled ? 'cat-feeding' : null)} trackColor={{ true: GameColors.secondary }}/>
      </View>
      {selected && <View style={styles.card}>
        <Text style={styles.name}>{selected.title}</Text>
        {selected.usesSavedProgress && <Text style={styles.hint}>{t('developer.savedProgress')}</Text>}
        <View style={styles.row}>
          <Pressable accessibilityRole="button" style={styles.button} onPress={() => router.replace('/dev-test')}><Text style={styles.action}>{t('developer.open')}</Text></Pressable>
          <Pressable accessibilityRole="button" style={styles.button} onPress={() => setDeveloperMode(null)}><Text style={styles.action}>{t('developer.off')}</Text></Pressable>
        </View>
      </View>}
      <TextInput accessibilityLabel={t('developer.search')} placeholder={t('developer.search')}
        value={query} onChangeText={setQuery} autoCorrect={false} style={styles.search}/>
    </View>
    <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
      {['Cat', 'Game state', 'Puzzles'].map(group => {
        const tests = DEVELOPER_TESTS.filter(test => test.group === group && `${test.title} ${test.id}`.toLowerCase().includes(query.toLowerCase()));
        return tests.length > 0 && <View key={group} style={styles.group}>
          <Text style={styles.name}>{t(`developer.groups.${group}`)}</Text>
          {tests.map(test => <View key={test.id} style={[styles.card, styles.row]}>
            <View style={styles.label}><Text style={styles.name}>{test.title}</Text>
              {test.usesSavedProgress && <Text style={styles.hint}>{t('developer.savedProgress')}</Text>}</View>
            <Switch accessibilityLabel={test.title} value={mode === test.id} trackColor={{ true: GameColors.secondary }}
              onValueChange={enabled => setDeveloperMode(enabled ? test.id : null)}/>
          </View>)}
        </View>;
      })}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GameColors.background },
  header: { paddingHorizontal: 16, gap: 10 }, list: { padding: 16, gap: 20 }, group: { gap: 8 },
  title: { fontSize: 26, fontWeight: '800', color: GameColors.text },
  name: { fontSize: 16, fontWeight: '700', color: GameColors.text }, label: { flex: 1, gap: 4 },
  hint: { fontSize: 14, lineHeight: 20, color: GameColors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  card: { backgroundColor: GameColors.card, borderRadius: 16, borderWidth: 2, borderColor: GameColors.cardBorder, padding: 12, gap: 6 },
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  action: { color: GameColors.secondaryDark, fontSize: 16, fontWeight: '700' },
  search: { backgroundColor: GameColors.card, borderWidth: 1, borderColor: GameColors.cardBorder, borderRadius: 12, padding: 12, fontSize: 16, color: GameColors.text },
});
