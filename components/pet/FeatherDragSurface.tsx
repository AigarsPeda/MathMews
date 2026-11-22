import { useEffect } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import type { ISharedValue } from 'react-native-worklets-core';
import { useTranslation } from 'react-i18next';
import { GameColors } from '@/constants/game';
import type { FeatherTouch } from '@/utils/guided-feather';
import { ROOM_MENU_OPEN_Z_INDEX } from '@/utils/room-layer-order';

type TouchValue = ISharedValue<FeatherTouch | undefined>;

// The native actor reads this pointer on its drawing thread.
function setTouch(touch: TouchValue, point?: FeatherTouch) {
  touch.value = point;
}

export function FeatherDragSurface({ touch, width, height }: { touch: TouchValue; width: number; height: number }) {
  const { t } = useTranslation();
  useEffect(() => () => setTouch(touch), [touch]);
  function move({ nativeEvent }: GestureResponderEvent) {
    setTouch(touch, { x: nativeEvent.locationX - width / 2, y: nativeEvent.locationY - height / 2 });
  }
  const release = () => setTouch(touch);
  return (
    <View style={styles.surface} testID="feather-drag-surface" onStartShouldSetResponder={() => true}
      onResponderGrant={move} onResponderMove={move} onResponderRelease={release} onResponderTerminate={release}>
      <Text pointerEvents="none" style={styles.hint}>{t('home.featherDragHint')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { ...StyleSheet.absoluteFill, zIndex: ROOM_MENU_OPEN_Z_INDEX + 1 },
  hint: { position: 'absolute', bottom: 8, alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10, backgroundColor: GameColors.card, color: GameColors.text, fontSize: 12 },
});
