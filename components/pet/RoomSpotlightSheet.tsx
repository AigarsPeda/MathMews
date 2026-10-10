import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { GameColors } from '@/constants/game';
import { DEFAULT_SPOTLIGHT_ANGLE } from '@/constants/decoration-motion';
import Slider from '@react-native-community/slider';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { visible: boolean; name: string; angle: number; simpleGraphics?: boolean;
  onPreview: (angle: number) => void; onApply: (angle: number) => void; onClose: () => void };

export function RoomSpotlightSheet({ visible, ...props }: Props) {
  return <AppBottomSheet visible={visible} onClose={props.onClose}>
    {visible && <AimControls {...props} />}
  </AppBottomSheet>;
}

function AimControls({ name, angle: initial, simpleGraphics, onPreview, onApply, onClose }: Omit<Props, 'visible'>) {
  const { t } = useTranslation();
  const [angle, setAngle] = useState(initial);
  const change = (value: number) => { setAngle(value); onPreview(value); };
  return <View style={styles.content}>
    <Text style={styles.title}>{t('home.aimSpotlight', { name })}</Text>
    <Text style={styles.hint}>{t('home.spotlightHint')}</Text>
    {simpleGraphics && <Text style={styles.hint}>{t('home.spotlightSimpleHint')}</Text>}
    <View style={styles.row}>
      {[[DEFAULT_SPOTLIGHT_ANGLE, 'spotlightBelow'], [55, 'spotlightPainting']].map(([value, key]) =>
        <Pressable key={key} style={[styles.button, angle === value && styles.selected]} accessibilityRole="button"
          accessibilityState={{ selected: angle === value }} onPress={() => change(Number(value))}>
          <Text style={styles.label}>{t(`home.${key}`)}</Text>
        </Pressable>)}
    </View>
    <Text style={styles.angle}>{angle}°</Text>
    <Slider value={angle} minimumValue={-60} maximumValue={75} step={1} tapToSeek onValueChange={change}
      minimumTrackTintColor={GameColors.secondary} maximumTrackTintColor={GameColors.cardBorder} thumbTintColor={GameColors.secondary}
      accessibilityRole="adjustable" accessibilityLabel={t('home.spotlightAngle')}
      accessibilityValue={{ min: -60, max: 75, now: angle, text: `${angle}°` }} />
    <View style={styles.row}>
      <Pressable style={styles.button} accessibilityRole="button" onPress={onClose}><Text style={styles.label}>{t('common.cancel')}</Text></Pressable>
      <Pressable style={[styles.button, styles.apply]} accessibilityRole="button" onPress={() => onApply(angle)}><Text style={styles.applyText}>{t('home.applyRotation')}</Text></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14 },
  title: { fontSize: 22, fontWeight: '700', color: GameColors.text },
  hint: { fontSize: 14, color: GameColors.textMuted },
  angle: { fontSize: 20, fontWeight: '600', color: GameColors.text, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: GameColors.background, alignItems: 'center', justifyContent: 'center', padding: 8 },
  selected: { borderColor: GameColors.secondary, borderWidth: 2 },
  label: { fontSize: 16, color: GameColors.text },
  apply: { backgroundColor: GameColors.secondary },
  applyText: { fontSize: 16, fontWeight: '700', color: 'white' },
});
