import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ink } from '@/constants/puzzle-theme';
import { announcementListeners, readCountingAnnouncements } from '../puzzle/counting/announcements';

export function CountingAnnouncementLog() {
  const [entries, setEntries] = useState(readCountingAnnouncements);
  useEffect(() => {
    const update = () => setEntries(readCountingAnnouncements());
    announcementListeners.add(update);
    update();
    return () => { announcementListeners.delete(update); };
  }, []);
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.dock}>
    <Text allowFontScaling={false} style={[styles.line, styles.title]}>Counting announcements · {entries.length} · UTC · newest first</Text>
    <ScrollView>
      {entries.slice().reverse().map((entry, index) => <Text key={entries.length - index} allowFontScaling={false} style={styles.line}>
        {entry.time}  {entry.message}
      </Text>)}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  dock: { height: 66, flexShrink: 0, paddingHorizontal: 8, paddingVertical: 2,
    backgroundColor: Ink.tray, borderTopWidth: StyleSheet.hairlineWidth, borderColor: Ink.line },
  line: { fontSize: 11, lineHeight: 14, color: Ink.text },
  title: { fontWeight: '700' },
});
