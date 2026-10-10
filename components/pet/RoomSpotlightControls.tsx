import { GameColors } from '@/constants/game';
import { moderateScale } from '@/utils/scale';
import Slider from '@react-native-community/slider';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = { name: string; angle: number; swivel?: number; simpleGraphics?: boolean;
  onPreview: (angle: number, swivel: number) => void; onApply: (angle: number, swivel: number) => void; onClose: () => void };

export function RoomSpotlightControls({ name, angle: initial, swivel: initialSwivel = 0, simpleGraphics, onPreview, onApply, onClose }: Props) {
  const { t } = useTranslation();
  const [angle, setAngle] = useState(initial);
  const [swivel, setSwivel] = useState(initialSwivel);
  const [axis, setAxis] = useState<'tilt' | 'turn'>('tilt');
  const [input, setInput] = useState(String(-initial));
  // Leave the native thumb uncontrolled during a drag; don't feed JS updates back into it.
  const [sliderValue, setSliderValue] = useState(-initial);
  const change = (raw: number) => {
    const value = Math.round(raw * 10) / 10;
    setInput(String(value));
    if (axis === 'turn') { setSwivel(value); onPreview(angle, value); }
    else { setAngle(-value); onPreview(-value, swivel); }
  };
  const preset = (value: number) => { setAngle(value); setSwivel(0); setInput(String(axis === 'turn' ? 0 : -value)); setSliderValue(axis === 'turn' ? 0 : -value); onPreview(value, 0); };
  const current = axis === 'turn' ? swivel : -angle;
  const minimum = axis === 'turn' ? -85 : -75;
  const maximum = axis === 'turn' ? 85 : 180;
  const parsed = Number(input.replace(',', '.'));
  const valid = input.trim() !== '' && Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum;
  return <View style={styles.content}>
    <View style={styles.heading}>
      <Text style={styles.title} numberOfLines={1}>{t('home.aimSpotlight', { name })}</Text>
      {(['tilt', 'turn'] as const).map(value => <Pressable key={value}
        style={[styles.axisButton, axis === value && styles.axisSelected]} accessibilityRole="button"
        accessibilityState={{ selected: axis === value }} onPress={() => { setAxis(value); const next = value === 'turn' ? swivel : -angle; setInput(String(next)); setSliderValue(next); }}>
        <Text style={styles.label}>{t(value === 'turn' ? 'home.spotlightTurn' : 'home.spotlightTilt')}</Text>
      </Pressable>)}
    </View>
    {axis === 'tilt' && <Text style={styles.hint}>{t('home.spotlightSweep')}</Text>}
    {simpleGraphics && <Text style={styles.hint}>{t('home.spotlightSimpleHint')}</Text>}
    <View style={styles.sliderRow}>
      <Slider key={axis} style={styles.slider} value={sliderValue} minimumValue={minimum} maximumValue={maximum} tapToSeek onValueChange={change} onSlidingComplete={setSliderValue}
        minimumTrackTintColor={GameColors.secondary} maximumTrackTintColor={GameColors.cardBorder} thumbTintColor={GameColors.secondary}
        accessibilityRole="adjustable" accessibilityLabel={t(axis === 'turn' ? 'home.spotlightSwivel' : 'home.spotlightAngle')}
        accessibilityHint={t('home.spotlightHint')}
        accessibilityValue={{ min: minimum, max: maximum, now: current, text: `${current}°` }} />
      <TextInput style={styles.angle} value={input} keyboardType="numbers-and-punctuation" selectTextOnFocus
        accessibilityLabel={t(axis === 'turn' ? 'home.spotlightSwivel' : 'home.spotlightAngle')}
        onChangeText={text => {
          setInput(text);
          const value = Number(text.replace(',', '.'));
          if (text.trim() && Number.isFinite(value) && value >= minimum && value <= maximum) {
            setSliderValue(value);
            if (axis === 'turn') { setSwivel(value); onPreview(angle, value); }
            else { setAngle(-value); onPreview(-value, swivel); }
          }
        }} />
      <Text style={styles.label}>°</Text>
    </View>
    <View style={styles.row}>
      {[[15, 'spotlightBelow'], [55, 'spotlightPainting'], [-180, 'spotlightUp']].map(([value, key]) =>
        <Pressable key={key} style={[styles.button, angle === value && swivel === 0 && styles.selected]} accessibilityRole="button"
          accessibilityState={{ selected: angle === value && swivel === 0 }} onPress={() => preset(Number(value))}>
          <Text style={styles.presetText}>{t(`home.${key}`)}</Text>
        </Pressable>)}
      <Pressable style={styles.button} accessibilityRole="button" onPress={() => { Keyboard.dismiss(); onClose(); }}><Text style={styles.label}>{t('common.cancel')}</Text></Pressable>
      <Pressable style={[styles.button, styles.apply, !valid && styles.disabled]} disabled={!valid}
        accessibilityRole="button" accessibilityState={{ disabled: !valid }}
        onPress={() => { Keyboard.dismiss(); onApply(angle, swivel); }}><Text style={styles.applyText}>{t('home.applyRotation')}</Text></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: moderateScale(12), paddingVertical: 8, gap: 8 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { flex: 1, fontSize: moderateScale(16), fontWeight: '700', color: GameColors.text },
  axisButton: { minHeight: 44, paddingHorizontal: 8, borderRadius: 12, justifyContent: 'center' },
  axisSelected: { backgroundColor: GameColors.cardBorder },
  hint: { fontSize: 12, color: GameColors.textMuted },
  angle: { width: 64, minHeight: 44, borderWidth: 1, borderColor: GameColors.cardBorder, borderRadius: 10, backgroundColor: GameColors.background, fontSize: 18, color: GameColors.text, textAlign: 'center' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slider: { flex: 1, minHeight: 44 },
  row: { flexDirection: 'row', gap: 4 },
  button: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: GameColors.background, alignItems: 'center', justifyContent: 'center', padding: 4 },
  selected: { borderColor: GameColors.secondary, borderWidth: 2 },
  label: { fontSize: moderateScale(15), color: GameColors.text },
  presetText: { fontSize: moderateScale(13), color: GameColors.text, textAlign: 'center' },
  apply: { backgroundColor: GameColors.secondary },
  disabled: { opacity: .4 },
  applyText: { fontSize: moderateScale(15), fontWeight: '700', color: GameColors.text },
});
