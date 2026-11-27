import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export function landTick() {
  if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => undefined);
}
export function resultTick(result: 'correct' | 'wrong') {
  if (Platform.OS === 'web') return;
  void Haptics.notificationAsync(result === 'correct' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => undefined);
}
