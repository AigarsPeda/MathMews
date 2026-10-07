import { AppIcon } from '@/components/ui/AppIcon';
import { GameColors } from '@/constants/game';
import { HOME_ROOM_IDS, type HomeRoomId } from '@/constants/home-rooms';
import { moderateScale } from '@/utils/scale';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

// Reuses the space formerly occupied by the selector above the room. The
// artwork keeps its viewport dimensions and saved placements across the change.
export const ROOM_NAVIGATION_HEIGHT = 44 + moderateScale(8);

export function RoomNavigation({ roomId, disabled, onVisit }: {
  roomId: HomeRoomId;
  disabled: boolean;
  onVisit: (id: HomeRoomId) => void;
}) {
  const { t } = useTranslation();
  const index = HOME_ROOM_IDS.indexOf(roomId);
  const previous = HOME_ROOM_IDS[index - 1], next = HOME_ROOM_IDS[index + 1];
  const visit = (id: HomeRoomId | undefined) => { if (id && !disabled) onVisit(id); };
  return <View style={styles.navigation}>
    <Pressable style={styles.arrow} disabled={disabled || !previous}
      accessibilityRole="button" accessibilityLabel={previous ? t('home.viewRoom', { room: t(`home.rooms.${previous}`) }) : t('home.previousRoom')}
      onPress={() => visit(previous)}>
      <AppIcon name="chevron-right" size={16} style={{ transform: [{ rotate: '180deg' }], opacity: disabled || !previous ? .25 : 1 }} />
    </Pressable>
    <View style={styles.current} accessible accessibilityRole="adjustable"
      accessibilityLabel={t(`home.rooms.${roomId}`)}
      accessibilityValue={{ min: 1, max: HOME_ROOM_IDS.length, now: index + 1, text: t('home.roomPosition', { current: index + 1, total: HOME_ROOM_IDS.length }) }}
      accessibilityState={{ disabled }}
      accessibilityActions={[{ name: 'decrement', label: t('home.previousRoom') }, { name: 'increment', label: t('home.nextRoom') }]}
      onAccessibilityAction={event => visit(event.nativeEvent.actionName === 'increment' ? next : event.nativeEvent.actionName === 'decrement' ? previous : undefined)}>
      <Text style={styles.name} numberOfLines={1}>{t(`home.rooms.${roomId}`)}</Text>
      <View style={styles.dots} accessible={false}>
        {HOME_ROOM_IDS.map(id => <View key={id} style={[styles.dot, id === roomId && styles.activeDot]} />)}
      </View>
    </View>
    <Pressable style={styles.arrow} disabled={disabled || !next}
      accessibilityRole="button" accessibilityLabel={next ? t('home.viewRoom', { room: t(`home.rooms.${next}`) }) : t('home.nextRoom')}
      onPress={() => visit(next)}>
      <AppIcon name="chevron-right" size={16} style={{ opacity: disabled || !next ? .25 : 1 }} />
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  navigation: { position: 'absolute', bottom: 0, left: 0, right: 0, height: ROOM_NAVIGATION_HEIGHT,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  arrow: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  current: { alignItems: 'center', justifyContent: 'center', gap: 5, maxWidth: '65%', paddingHorizontal: 8 },
  name: { fontSize: 13, fontWeight: '600', color: GameColors.text },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: GameColors.cardBorder },
  activeDot: { backgroundColor: GameColors.textMuted },
});
