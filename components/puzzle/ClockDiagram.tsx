import { ProofEquationSlot } from './everyday/ProofEquationSlot';
import { PuzzleText } from './PuzzleText';
import { useProofAnnouncement } from './counting/useProofAnnouncement';
import { useProofViewport } from '@/components/puzzle/PlayProofCaption';
import { HelpProofContext } from './kit/HelpProofContext';
import { ProofLine } from './help/helpKit';
import { useContext, useLayoutEffect, useState } from 'react';
import { Path, Skia, StrokeCap } from '@shopify/react-native-skia';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { Ink, ProofMotion, Quantity } from '@/constants/puzzle-theme';
import { clockHandChoices, clockTime, clockTravel, type ClockAttempt, type ClockInput, type ClockModel } from '@/utils/puzzle-clock';
import { ClockHandInput } from './everyday/ClockHandInput';
import { ProofWindow } from './everyday/ProofWindow';
import { PaintedModel, ProofCanvas } from './everyday/PaintedModel';
import { DiagramSurface } from './everyday/DiagramSurface';
import { DenseLabel, useMeasuredLabels, valueToken } from './kit/DenseLayout';
import { Caption, ProofCaption } from './kit/Focus';
import { EntryBuild } from './kit/PracticeAffordances';
import { useRevealBeats } from './kit/useRevealBeats';

const numeralRadius = 76;
const hours = Array.from({ length: 12 }, (_, i) => String(i + 1));
const displayTime = (minutes: number) => clockTime(minutes).replace(/^0(?=\d:)/, '');
function point(minutes: number, radius: number) {
  const angle = (minutes * Math.PI) / 30;
  return { x: 120 + Math.sin(angle) * radius, y: 120 - Math.cos(angle) * radius };
}
const arcRadius = 99;
const ticks = hours.map((_, i) => {
  const p = point(i * 5, 110);
  return <View key={i} testID={'clock-dial-tick-' + i * 5} style={{
    position: 'absolute', left: p.x - 2.5, top: p.y - 5, width: 5, height: 10,
    borderRadius: 2.5, backgroundColor: Quantity.teal.onFill, transform: [{ rotate: `${i * 30}deg` }],
  }} />;
});

function HourWedge({ hourTime, progress }: { hourTime: number; progress: SharedValue<number> }) {
  const path = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const angle = Math.floor(hourTime / 60) * 30 - 90;
    const radians = angle * Math.PI / 180;
    p.moveTo(120, 120);
    p.lineTo(120 + Math.cos(radians) * 73, 120 + Math.sin(radians) * 73);
    p.arcToOval(Skia.XYWHRect(47, 47, 146, 146), angle, ((hourTime % 60 + 60) % 60) / 2 * Math.min(1, progress.value), false);
    p.lineTo(120, 120);
    return p;
  });
  return <Path path={path} color={Quantity.amber.light} />;
}

function DialArc({
  start,
  length,
  offset,
  distance,
  color, exactMinutes = false,
}: {
  start: number;
  length: number;
  offset: number;
  distance: SharedValue<number>;
  color: string; exactMinutes?: boolean;
}) {
  const path = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const arc = Math.min(Math.abs(length), Math.max(0, distance.value - offset));
    if (arc >= 60) p.addCircle(120, 120, arcRadius);
    else if (arc) p.arcToOval(Skia.XYWHRect(120 - arcRadius, 120 - arcRadius, arcRadius * 2, arcRadius * 2), start * 6 - 90, arc * Math.sign(length) * 6, true);
    return p.stroke({ width: 10, cap: StrokeCap.Round }) ?? p;
  });
  const minuteDots = useDerivedValue(() => {
    const p = Skia.Path.Make();
    if (exactMinutes) {
      const arc = Math.min(Math.abs(length), Math.max(0, distance.value - offset), 60);
      for (let i = 1; i <= Math.floor(arc); i++) {
        const minute = start + i * Math.sign(length);
        if (minute % 5 === 0) continue;
        const angle = minute * Math.PI / 30;
        p.addCircle(120 + Math.sin(angle) * arcRadius, 120 - Math.cos(angle) * arcRadius, 2);
      }
    }
    return p;
  });
  return <><Path path={path} color={color} />
    {exactMinutes && <Path path={minuteDots} color="white" />}</>;
}

type ClockProps = {
  model: ClockModel;
  clockInput?: ClockInput;
  clockAttempt?: ClockAttempt;
  elapsedUnit?: ClockInput['elapsedUnit'];
  onSolutionShown?: () => void;
};

export function ClockDiagram({ model, clockInput, clockAttempt, elapsedUnit, onSolutionShown }: ClockProps) {
  const help = useContext(HelpProofContext);
  const viewport = useProofViewport();
  const { width, height, fontScale } = useWindowDimensions();
  const [available, setAvailable] = useState(0);
  const { t } = useTranslation();
  const numerals = useMeasuredLabels(hours, help ? 'sequence' : 'value');
  const labelWidth = numerals.ready ? numerals.width : 19 * fontScale;
  const labelHeight = numerals.ready ? numerals.height : 18 * fontScale;
  const solving = !!onSolutionShown,
    read = model.task === 'read',
    elapsed = model.task === 'elapsed';
  const start = model.minutes,
    delta = clockAttempt && !read ? clockHandChoices(model, { choices: [clockAttempt.choice], elapsedUnit: clockAttempt.elapsedUnit })[0] - start : clockTravel(model),
    direction = Math.sign(delta);
  const namedHour = ((Math.floor(start / 60) % 12) + 12) % 12 || 12;
  const readMinutes = ((start % 60) + 60) % 60;
  const wrongRead = read && !!clockAttempt;
  const stationary = !!clockAttempt && (read || delta === 0);
  const magnitude = Math.abs(delta),
    firstHour = delta < 0 ? start % 60 || 60 : 60 - (start % 60);
  const stops = [0];
  const interval = help ? 5 : 60;
  for (let boundary = help ? interval : firstHour; !clockAttempt && boundary < magnitude; boundary += interval) stops.push(boundary);
  if (magnitude) stops.push(magnitude);
  const legs = stops.slice(1).map((stop, i) => stop - stops[i]);
  const beats = useRevealBeats(solving ? (read ? (clockAttempt ? 1 : 2) : Math.max(1, legs.length)) : 0, {
    awaitInitialPaint: solving,
    onDone: onSolutionShown,
    reducedSteps: true,
    easing: 'inOut',
    minTotal: 0,
    lead: 80,
    step: (i) => (stationary ? 320 : read ? (i === 0 ? 490 : 650) : legs.length > 1 ? 580 : 980),
    hold: (n) => ((read ? n === 1 : n < legs.length) ? 180 : ProofMotion.settle),
  });
  const { reduced, landed, position, settled } = beats;
  const distance = useDerivedValue(() => {
    const at = reduced ? landed : position.value;
    if (read) return Math.max(0, at - 1) * readMinutes;
    const i = Math.floor(at);
    return (stops[i] ?? magnitude) + (at - i) * (legs[i] ?? 0);
  });
  const [preview, setPreview] = useState<number | null>(null);
  const input = !solving && !read ? clockInput : undefined;
  const times = input ? clockHandChoices(model, input) : [];
  const shownTime = input ? preview ?? (input.selectedIndex == null ? start : times[input.selectedIndex]) : start;
  const editorTime = useSharedValue(shownTime);
  const inputEnabled = !!input;
  useLayoutEffect(() => {
    editorTime.value = inputEnabled && preview === null && !reduced ? withTiming(shownTime, { duration: 145 }) : shownTime;
  }, [editorTime, inputEnabled, preview, reduced, shownTime]);
  const dialTime = useDerivedValue(() => inputEnabled ? editorTime.value : read ? start : start + direction * distance.value);
  const hourHand = useAnimatedStyle(() => ({ transform: [{ rotate: `${dialTime.value / 2}deg` }] }));
  const minuteHand = useAnimatedStyle(() => ({ transform: [{ rotate: `${dialTime.value * 6}deg` }] }));
  const hourProgress = useDerivedValue(() => reduced ? landed : position.value);
  const hourPop = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, hourProgress.value));
    return { transform: [{ scale: reduced ? 1 : 1 + .18 * Math.sin(progress * Math.PI) }] };
  });
  const mismatchPulse = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, hourProgress.value));
    return { transform: [{ scaleX: reduced ? 1 : 1 + (wrongRead ? .3 : .65) * Math.sin(progress * Math.PI) }] };
  });
  const onHourLanding = useAnimatedStyle(() => {
    const progress = Math.max(0, Math.min(1, hourProgress.value - 1));
    return { transform: [{ scaleX: reduced ? 1 : 1 + .5 * Math.sin(progress * Math.PI) }] };
  });
  const dialReady = available > 0 && numerals.ready;
  const DialFrame = solving ? View : EntryBuild;
  const showGivenTime = !solving && !read && !elapsed && !input && !model.analog;
  const showDuration = !elapsed && !read && (!solving || !!clockAttempt);
  const outsideChip = showDuration && (fontScale >= 1.5 || shownTime !== start);
  const elapsedEnd = model.end ?? start;
  const markHour = elapsedUnit === 'hours';
  const endMarkMinute = markHour ? elapsedEnd / 12 : elapsedEnd;
  const startMarkMinute = elapsed && markHour ? start / 12 : start;
  const markerRadius = elapsed ? 105 : 110;
  const rimStart = point(startMarkMinute, markerRadius);
  const rimEnd = point(endMarkMinute, markerRadius);
  // When both land at the same graduation, show a knob and flag side by side on its tangent.
  const joinedMarks = elapsed && Math.hypot(rimEnd.x - rimStart.x, rimEnd.y - rimStart.y) < 19;
  const tangent = { x: Math.cos(startMarkMinute * Math.PI / 30), y: Math.sin(startMarkMinute * Math.PI / 30) };
  const showEndTime = elapsed && !solving && !markHour && clockTravel(model) >= 60;
  const modelHeight = viewport?.availableModelHeight ?? height;
  const givenHeight = showGivenTime || outsideChip || showEndTime ? Math.ceil(20 * fontScale) + 8 : 0;
  // At the top of the face, the centres of 11 and 12 are half a label-ring radius apart.
  const spacedDiameter = (2 * (labelWidth + 4) * 240) / numeralRadius;
  const size = help ? Math.min(available || width - 48, Math.max(204, help.height - 12)) : Math.min(
    available || width - 48,
    solving ? viewport?.innerWidth ?? width : width,
    Math.max(204, 4 * Math.max(labelWidth, labelHeight),
      Math.min(modelHeight - givenHeight - 12, Math.max(Math.min(282, height * 0.33), spacedDiameter))),
  );
  // Keep the draggable tip clear of the numeral glyphs at every text size.
  const minuteRadius = Math.min(71, numeralRadius - ((Math.max(labelWidth, labelHeight) / 2 + 10) * 240) / size);
  const hourRadius = Math.min(48, minuteRadius * 0.67);
  const span = valueToken(t('clockSolution.minutes', { value: magnitude }));
  const pastHour = t(readMinutes ? 'clockSolution.pastHour' : 'clockSolution.onHour', { hour: namedHour });
  const end = displayTime(start + delta),
    day = Math.floor((start + delta) / 1440);
  const dayLabel = day ? ' · ' + t(day > 0 ? 'clockSolution.nextDay' : 'clockSolution.previousDay') : '';
  const readCaption = read && readMinutes ? t('clockSolution.minutesPast', { minutes: readMinutes, hour: namedHour }) : pastHour;
  const final = clockAttempt ? clockAttempt.choice : read
    ? readCaption
    : elapsed
      ? elapsedUnit === 'hours' ? span + ' = ' + valueToken(t('clockSolution.hours', { value: magnitude / 60 })) : (legs.length > 1 ? legs.join(' + ') + ' = ' : '') + span
      : `${displayTime(start)} ${direction < 0 ? '−' : '+'} ${span} = ${end}${dayLabel}`;
  const caption =
    settled || landed >= (read ? 2 : legs.length)
      ? final
      : read
        ? pastHour
        : displayTime(start + direction * (stops[landed] ?? 0));
  useProofAnnouncement(beats, wrongRead ? model.label : clockAttempt?.choice ?? caption, solving);
  const wrongColor = !!clockAttempt;
  const wrongHour = wrongColor && (wrongRead || delta === 0 && model.duration != null && model.duration % 60 === 0);
  const initialGrip = point((input ? Math.max(...times) - Math.min(...times) >= 60 : (model.duration ?? 0) % 60 === 0) ? start / 12 : start, 1);
  const fullSpan = valueToken(t('clockSolution.minutes', { value: model.duration ?? 0 }));
  const landedMinutes = read ? start : start + direction * (stops[landed] ?? magnitude);
  const focus = point(landedMinutes, numeralRadius).y / 240;
  return (
    <DiagramSurface playing={solving} beats={beats} replayable={!stationary || settled}>
      <View style={styles.wrap} onLayout={(e) => setAvailable(e.nativeEvent.layout.width)}>
        {numerals.probe}
        <ProofWindow playing={solving} inset={8} focus={focus}>
          <DialFrame {...(solving ? {} : { ready: dialReady })}>
            <PaintedModel beats={solving ? beats : undefined} ready={dialReady}
              nativeID={solving ? 'play-proof-model' : 'play-entry-model'}
              testID={solving ? 'play-proof-model' : 'play-entry-model'}
              accessible={!input}
              accessibilityRole="image"
              accessibilityLabel={wrongRead ? model.label : clockAttempt?.choice ?? (solving ? caption || model.label : model.label)}
              style={{ width: size, height: size }}
            >
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[styles.dial, { left: (size - 240) / 2, top: (size - 240) / 2, transform: [{ scale: size / 240 }] }]}
              >
                <View style={styles.lip} /><View style={styles.face} />
                {ticks}
                {solving && !wrongRead && (
                  <ProofCanvas pointerEvents="none" style={StyleSheet.absoluteFill}>
                    {read ? (
                      <><HourWedge hourTime={start} progress={hourProgress} />
                        <DialArc start={0} offset={0} length={readMinutes} distance={distance}
                          color={Quantity.teal.edge} exactMinutes={readMinutes % 5 !== 0} /></>
                    ) : (
                      legs.map((leg, i) => (
                        <DialArc
                          key={i}
                          start={start + direction * stops[i]}
                          offset={stops[i]}
                          length={direction * leg}
                          distance={distance}
                          exactMinutes={start % 5 !== 0 || delta % 5 !== 0}
                          color={help ? Quantity.teal.fill : wrongColor ? Quantity.berry.edge : i % 2 ? Quantity.amber.edge : Quantity.teal.edge}
                        />
                      ))
                    )}
                  </ProofCanvas>
                )}
                {elapsed ? <>
                  <View testID="clock-given-start" style={[styles.knob, {
                    left: rimStart.x - 10 - (joinedMarks ? 8 * tangent.x : 0),
                    top: rimStart.y - 10 - (joinedMarks ? 8 * tangent.y : 0),
                  }]}><View style={styles.knobFace} /></View>
                  <View testID="clock-elapsed-end" style={[styles.flag, {
                    left: rimEnd.x - 11 + (joinedMarks ? 8 * tangent.x : 0),
                    top: rimEnd.y - 10 + (joinedMarks ? 8 * tangent.y : 0),
                  }]}><View style={styles.flagPost} /><View style={styles.flagCloth} /></View>
                </> : solving && !read && <View testID="clock-given-start" style={[styles.start, { left: rimStart.x - 6, top: rimStart.y - 6 }]} />}
                <Animated.View style={[StyleSheet.absoluteFill, hourHand]}>
                  <Animated.View style={[styles.hourHand, help && { backgroundColor: Quantity.amber.fill }, { top: 120 - hourRadius, height: hourRadius + 3 }, read && solving && !wrongRead && styles.highlight, wrongHour && styles.mismatch, stationary && wrongHour && mismatchPulse]} />
                </Animated.View>
                <Animated.View style={[StyleSheet.absoluteFill, minuteHand]}>
                  <Animated.View style={[styles.minuteHand, help && { backgroundColor: Quantity.violet.fill, width: 10, left: 115 }, { top: 120 - minuteRadius, height: minuteRadius + 3 }, wrongColor && !wrongHour && styles.mismatch, stationary && !wrongHour && mismatchPulse, read && solving && !wrongRead && !readMinutes && onHourLanding]} />
                </Animated.View>
                <View style={styles.pivot} />
              </View>
              {hours.map((hour, i) => {
                const minute = (i + 1) * 5;
                const nearMark = (value: number) => Math.abs(((minute - value + 630) % 60) - 30) <= 2;
                const underMarker = elapsed && (nearMark(startMarkMinute % 60) || nearMark(endMarkMinute % 60));
                const p = point(minute, fontScale >= 2 && underMarker ? numeralRadius - 4 : numeralRadius);
                // Extra space separates the two-digit labels at the top of the enlarged face.
                if (fontScale >= 2 && (hour === '11' || hour === '1')) {
                  p.x += hour === '11' ? -5 : 5;
                  p.y += 1;
                }
                if (fontScale >= 2 && (hour === '10' || hour === '2')) p.y += 5;
                if (fontScale >= 2 && hour === '12') p.y -= 3;
                return (
                  <View
                    key={hour}
                    style={{
                      position: 'absolute',
                      left: (size * p.x) / 240 - labelWidth / 2,
                      top: (size * p.y) / 240 - labelHeight / 2,
                      width: labelWidth,
                      alignItems: 'center',
                    }}
                  >
                    <Animated.View style={read && solving && !wrongRead && Number(hour) === namedHour ? [hourPop, { backgroundColor: Quantity.amber.light, borderRadius: 8 }] : undefined}>
                      <DenseLabel role={help ? 'sequence' : 'value'}>{hour}</DenseLabel>
                    </Animated.View>
                  </View>
                );
              })}
              {input && <ClockHandInput size={size} hourRadius={hourRadius} minuteRadius={minuteRadius} time={shownTime} dialTime={dialTime} backward={model.task === 'start'} showDirection={!elapsed} givenLabel={model.label} input={input} times={times} onPreview={setPreview} />}
            </PaintedModel>
            {showDuration && <View pointerEvents="none" nativeID="clock-duration-chip" testID="clock-duration-chip" style={[styles.durationChip, outsideChip ? { alignSelf: initialGrip.x < 120 ? 'flex-start' : 'flex-end' } : [styles.attachedChip, initialGrip.x < 120 ? { left: 0 } : { right: 0 }, initialGrip.y < 120 ? { top: 0 } : { bottom: 0 }]]}>
              <PuzzleText style={styles.durationText}>{!solving && shownTime !== start && `${displayTime(start)} `}{model.task === 'start' ? '↶' : '↷'} {fullSpan}</PuzzleText>
            </View>}
            {showEndTime && <View pointerEvents="none" style={[styles.endChip, { alignSelf: rimEnd.x < 120 ? 'flex-start' : 'flex-end' }]}>
              <PuzzleText style={styles.endText}>{displayTime(elapsedEnd)}</PuzzleText>
            </View>}
          </DialFrame>
        </ProofWindow>
        {showGivenTime && (
          <Caption>
            {displayTime(start)}
          </Caption>
        )}
        {solving && !clockAttempt && (
          <ProofEquationSlot settled={settled}>
            <View testID="clock-solution-caption" style={styles.caption}>
              <View testID={read ? 'clock-solution-time' : 'clock-solution-duration'}>
                {help ? <ProofLine readout caption={caption} equation={settled ? final : undefined} /> : <ProofCaption text={caption} reserveTexts={[final]} />}
              </View>
            </View>
          </ProofEquationSlot>
        )}
      </View>
    </DiagramSurface>
  );
}
const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 4, gap: 6 },
  dial: { position: 'absolute', width: 240, height: 240 },
  face: { position: 'absolute', top: 3, left: 3, width: 234, height: 231, borderRadius: 117, backgroundColor: Quantity.teal.soft },
  lip: { position: 'absolute', top: 6, left: 3, width: 234, height: 231, borderRadius: 117, backgroundColor: Quantity.teal.light },
  start: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: Quantity.amber.fill },
  knob: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: Quantity.amber.edge },
  knobFace: { height: 17, borderRadius: 9, backgroundColor: Quantity.amber.fill },
  flag: { position: 'absolute', width: 22, height: 21 },
  flagPost: { position: 'absolute', left: 1, width: 5, height: 21, borderRadius: 2.5, backgroundColor: Quantity.teal.onFill },
  flagCloth: { position: 'absolute', left: 3, width: 18, height: 15, borderTopRightRadius: 7, borderBottomRightRadius: 5,
    backgroundColor: Quantity.teal.fill, borderBottomWidth: 3, borderColor: Quantity.teal.edge },
  endChip: { paddingHorizontal: 6, borderRadius: 6, backgroundColor: Quantity.teal.soft },
  endText: { color: Quantity.teal.onFill, fontWeight: '800', fontSize: 14 },
  attachedChip: { position: 'absolute' },
  durationChip: { alignItems: 'center', paddingHorizontal: 7, backgroundColor: Quantity.amber.soft, borderBottomWidth: 3, borderColor: Quantity.amber.light, borderRadius: 9 },
  durationText: { color: Quantity.amber.onFill, fontSize: 14, fontWeight: '800' },
  mismatch: { backgroundColor: Quantity.berry.edge },
  hourHand: {
    position: 'absolute',
    left: 114,
    width: 12,
    borderRadius: 6,
    backgroundColor: Ink.text,
  },
  highlight: { backgroundColor: Quantity.teal.edge },
  minuteHand: {
    position: 'absolute',
    left: 117,
    width: 6,
    borderRadius: 3,
    backgroundColor: Quantity.teal.onFill,
  },
  pivot: {
    position: 'absolute',
    top: 115,
    left: 115,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Quantity.teal.onFill,
  },
  caption: { alignSelf: 'stretch' },
});
