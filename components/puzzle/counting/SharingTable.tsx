import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { QuantityStage } from './QuantityStage';
import { useProofViewport } from '../PlayProofCaption';
import { useQuantityPractice } from './QuantityPractice';
import { HelpProofContext } from '../kit/HelpProofContext';
import { landTick } from '../kit/proofHaptics';
import { ProofLanding } from '../kit/ProofFeedback';
import { EntryBuild, IdleHint } from '../kit/PracticeAffordances';
import { ProofWindow } from './ProofWindow';
import { useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { ProofMotion, PuzzleColors, Quantity, Shape } from '@/constants/puzzle-theme';
import type { PuzzleObject } from '@/types/puzzle-object';
import { PressFace } from '../kit/PressFace';
import { DiagramIcon } from '../kit/DiagramIcon';
import { CountingCounter } from './CountingCounter';
import { useModelPaint } from './useModelPaint';
import type { RevealBeats } from '../kit/useRevealBeats';

type Box = { x: number; y: number; width: number; height: number; columns: number; pitch?: number; insetY?: number };
let encounteredSharing = false;
const cell = 44;
const pad = 8;
const gap = 8;
export function sharingSlot(box: Box, slot: number) {
  const pitch = box.pitch ?? cell;
  return {x: box.x + (box.width - box.columns * pitch) / 2 + slot % box.columns * pitch,
    y: box.y + (box.insetY ?? pad) + Math.floor(slot / box.columns) * pitch};
}
export function sharingTableLayout(width: number, slots: number[], items: number, groups: number, badges = false, pitch = cell, stacked = false, fill = false) {
  const padding = badges ? 2 : pad;
  const across = Math.max(1, Math.min(groups, Math.floor((width + gap) / ((stacked ? 1 : 2) * pitch + 2 * padding + gap))));
  const columns = Math.max(1, Math.min(stacked ? 1 : Math.ceil(Math.sqrt(Math.max(1, items / groups))),
    Math.floor(((width + gap) / across - gap - 2 * padding) / pitch)));
  // Picture help spreads the groups over the whole width when they sit in one row.
  const dishWidth = fill && across === groups ? (width - (groups - 1) * gap) / groups : columns * pitch + 2 * padding;
  const sourceCols = Math.max(1, Math.min(items === 4 ? 2 : items, Math.floor((width - 2 * pad) / pitch)));
  const sourceWidth = sourceCols * pitch + 2 * pad;
  const boxes: Box[] = [{ x: (width - sourceWidth) / 2, y: 0, width: sourceWidth,
    height: Math.ceil(items / sourceCols) * pitch + 2 * pad, pitch, columns: sourceCols }];
  let y = boxes[0].height + gap;
  for (let first = 0; first < groups; first += across) {
    const n = Math.min(across, groups - first);
    const capacity = Math.max(1, Math.floor(items / groups), ...slots.slice(first, first + n));
    const insetY = badges ? 38 : pad;
    const height = Math.ceil(capacity / columns) * pitch + insetY + padding;
    for (let i = 0; i < n; i++) boxes.push({ x: (width - n * dishWidth - (n - 1) * gap) / 2 + i * (dishWidth + gap),
      y, width: dishWidth, height, columns, insetY, pitch });
    y += height + gap;
  }
  return { boxes, height: y };
}

export type DealFlight = {id: number; destination: number; slot: number};
export function sharingSlots(places: readonly number[]) {
  return places.map((place, id) => place ? places.slice(0, id).filter(p => p === place).length : id);
}
export function submittedSlots(places: readonly number[], saved: {locations: number[]; shareSlots: number[]}) {
  return saved.shareSlots.length === places.length && places.every((place, id) => saved.locations[id] === place)
    ? saved.shareSlots : sharingSlots(places);
}
function freeSlot(places: readonly number[], slots: readonly number[], destination: number) {
  const used = new Set(slots.filter((_, i) => places[i] === destination));
  let slot = 0;
  while (used.has(slot)) slot++;
  return slot;
}
export function finishDeal(initial: readonly number[], initialSlots: readonly number[], groups: number) {
  const places = [...initial], slots = [...initialSlots], flights: DealFlight[] = [];
  const each = Math.floor(places.length / groups);
  const counts = Array.from({length: groups + 1}, (_, g) => places.filter(p => p === g).length);
  for (let round = 0; round < each; round++) {
    for (let dest = 1; dest <= groups; dest++) {
      if (counts[dest] > round) continue;
      const id = places.findIndex(p => !p || counts[p] > each);
      if (id < 0) continue;
      const slot = freeSlot(places, slots, dest);
      counts[places[id]]--; counts[dest]++; slots[id] = slot; places[id] = dest;
      flights.push({id, destination: dest, slot});
    }
  }
  // Leave any indivisible remainder in the supply, keeping its original slot.
  places.forEach((place, id) => {
    if (place && counts[place] > each) { counts[place]--; flights.push({id, destination: 0, slot: id}); }
  });
  return flights;
}
function TrayFinish({position, start, color, plate}: {position: SharedValue<number>; start: number; color: string; plate: boolean}) {
  const motion = useAnimatedStyle(() => ({opacity: Math.max(0, Math.min(1, position.value - start))}));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {borderRadius: plate ? 60 : 16,
    backgroundColor: color, bottom: plate ? Shape.lip : 0}, motion]} />;
}
function Movable({ x, y, pitch, flight, landed, muted, entryIndex, object, selected, enabled, label, hint, actions, onAction, onPick, onDrop }: {
  flight?: {x: number; y: number; turn: number; position: SharedValue<number>}; landed: boolean; muted: boolean;
  x: number; y: number; pitch: number; entryIndex?: number; object?: PuzzleObject; selected: boolean; enabled: boolean; label: string; hint: string;
  actions: { name: string; label: string }[]; onAction: (name: string) => void;
  onPick: () => void; onDrop: (x: number, y: number) => void;
}) {
  const reduced = useReducedMotion();
  const dx = useSharedValue(0), dy = useSharedValue(0);
  const left = useDerivedValue(() => withTiming(x, { duration: reduced ? 0 : ProofMotion.travel }));
  const top = useDerivedValue(() => withTiming(y, { duration: reduced ? 0 : ProofMotion.travel }));
  const start = useRef({ x: 0, y: 0, localX: 0, localY: 0 });
  const [dragging, setDragging] = useState(false);
  const style = useAnimatedStyle(() => {
    const t = flight ? Math.max(0, Math.min(1, flight.position.value - flight.turn)) : 0;
    return {transform: [{translateX: left.value + dx.value + ((flight?.x ?? x) - x) * t},
      {translateY: top.value + dy.value + ((flight?.y ?? y) - y) * t - 6 * Math.sin(Math.PI * t)}, {scale: dragging && !reduced ? .95 : 1}]};
  });
  function finish(e: GestureResponderEvent) {
    const deltaX = e.nativeEvent.pageX - start.current.x, deltaY = e.nativeEvent.pageY - start.current.y;
    if (Math.hypot(deltaX, deltaY) < 6) onPick();
    else onDrop(x + start.current.localX + deltaX, y + start.current.localY + deltaY);
    dx.set(0); dy.set(0); setDragging(false);
  }
  const size = pitch - Shape.space.loose;
  const help = useContext(HelpProofContext);
  const paint = object ? <DiagramIcon name={object} size={size} /> : <CountingCounter diameter={help ? size : 28} />;
  return <Animated.View accessible={enabled} accessibilityElementsHidden={!enabled} importantForAccessibility={enabled ? 'yes' : 'no-hide-descendants'} pointerEvents={enabled ? 'auto' : 'none'} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} accessibilityState={{ selected }}
    accessibilityActions={[{ name: 'activate' }, ...actions]} onAccessibilityAction={e => {
      const name = e.nativeEvent.actionName;
      if (name === 'activate') onPick(); else onAction(name);
    }}
    onStartShouldSetResponder={() => true} onResponderTerminationRequest={() => false}
    onResponderGrant={e => { const { pageX, pageY, locationX, locationY } = e.nativeEvent;
      start.current = { x: pageX, y: pageY, localX: locationX, localY: locationY }; setDragging(true); }}
    onResponderMove={e => { dx.set(e.nativeEvent.pageX - start.current.x); dy.set(e.nativeEvent.pageY - start.current.y); }}
    onResponderRelease={finish} onResponderTerminate={() => { dx.set(0); dy.set(0); setDragging(false); }}
    style={[styles.piece, {width: pitch, height: pitch}, selected && styles.selected, { zIndex: dragging ? 3 : 1, opacity: muted ? .55 : 1 }, style]}>
    <View pointerEvents="none"><ProofLanding landed={landed}>{entryIndex === undefined ? paint : <EntryBuild index={entryIndex}>{paint}</EntryBuild>}</ProofLanding></View>
  </Animated.View>;
}

/** Zero is the supply. Each entry follows the same object for the entire attempt. */
export function SharingTable({ items, groups, object, disabled = false, onDistributionChange, selectedGroups = 0, initialLocations, beats, flights, position, completed = 0, tintAt, attemptTray, highlight = false }: {
  attemptTray?: number; tintAt?: number; position?: SharedValue<number>; completed?: number; flights?: DealFlight[]; highlight?: boolean; beats?: RevealBeats; items: number; groups: number; object?: PuzzleObject; disabled?: boolean; initialLocations?: readonly number[]; selectedGroups?: number; onDistributionChange?: (locations: number[]) => void;
}) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const drawing = useModelPaint(width > 0, beats);
  const [locations, setLocations] = useState<number[]>(() => initialLocations?.length === items ? [...initialLocations] : Array(items).fill(0));
  const [selected, select] = useState<number | null>(null);
  const [interacted, setInteracted] = useState(() => !!initialLocations?.some(Boolean));
  const [firstEncounter] = useState(() => !encounteredSharing);
  const [buildOnEntry] = useState(!disabled);
  useEffect(() => { if (!disabled) encounteredSharing = true; }, [disabled]);
  const practice = useQuantityPractice();
  const viewport = useProofViewport();
  const [slots, setSlots] = useState(() => submittedSlots(locations, practice.snapshot));
  useEffect(() => { if (!disabled) practice.saveDeal(locations, slots); }, [disabled, locations, slots, practice]);
  const counts = Array.from({ length: groups }, (_, i) => Math.max(0, ...slots.map((slot, id) => locations[id] === i + 1 ? slot + 1 : 0)));
  const badges = selectedGroups > 0 && object === 'plant';
  const help = useContext(HelpProofContext);
  // Picture help stacks a small share on each plate and takes the biggest cookies the model area holds.
  const stacked = !!help && (object === 'cookie' || selectedGroups > 0) && items / groups <= 3;
  const fill = !!help && selectedGroups > 0;
  let pitch = object === 'cookie' && items <= 6 && groups <= 2 && width >= 275 ? Math.min(76, Math.floor((width - 4 * pad - gap) / 4)) : cell;
  if (help && (object === 'cookie' || selectedGroups > 0) && width >= 275) {
    // The fraction sheet also needs room for a translated equation and wrapping playback controls.
    pitch = selectedGroups > 0 ? 56 : 76;
    while (pitch > cell && sharingTableLayout(width, counts, items, groups, badges, pitch, stacked, fill).height > help.height) pitch--;
  }
  const { boxes: positionedBoxes, height } = sharingTableLayout(width, counts, items, groups, badges, pitch, stacked, fill);
  const leftEdge = Math.min(...positionedBoxes.map(box => box.x));
  const boardWidth = Math.max(...positionedBoxes.map(box => box.x + box.width)) - leftEdge;
  const boxes = positionedBoxes.map(box => ({ ...box, x: box.x - leftEdge }));
  const sourceId = locations.indexOf(0);
  const source = sharingSlot(boxes[0], sourceId);
  const firstPlate = boxes[1];
  const status = (places: number[]) => t('actionMotion.sharing', { remaining: places.filter(place => !place).length,
    counts: counts.map((_, i) => places.filter(place => place === i + 1).length).join(', ') });
  const currentPlaces = [...locations];
  flights?.slice(0, completed).forEach(({id, destination}) => { currentPlaces[id] = destination; });
  const name = (i: number) => i ? t(object === 'cookie' ? 'friendlyQ.plate' : 'friendlyQ.tray', { n: i,
    defaultValue: object === 'cookie' ? 'Plate {{n}}' : 'Tray {{n}}' }) : t('friendlyQ.supply', { defaultValue: 'Supply' });
  const activeBox = attemptTray == null ? undefined : boxes[attemptTray];
  const focus = activeBox ? (activeBox.y + activeBox.height / 2) / height : 0;
  const visibleHeight = viewport && viewport.availableModelHeight > 0 ? Math.max(1, viewport.availableModelHeight - 8) : undefined;
  const inspectedId = attemptTray == null ? -1 : locations.indexOf(attemptTray);
  const selectedPlace = disabled || selected === null ? null : locations[selected];
  const spokenStatus = beats?.settled && attemptTray != null ? `${name(attemptTray)}, ${currentPlaces.filter(p => p === attemptTray).length}` : status(currentPlaces);
  function move(id: number, destination: number) {
    if (disabled) return;
    setInteracted(true);
    const next = locations.map((place, i) => i === id ? destination : place);
    const nextSlots = [...slots];
    nextSlots[id] = locations[id] === destination ? slots[id] : destination ? freeSlot(locations, slots, destination) : id;
    practice.saveDeal(next, nextSlots); setSlots(nextSlots); landTick();
    setLocations(next); select(null); onDistributionChange?.(next);
    AccessibilityInfo.announceForAccessibility(status(next));
  }
  const modelID = beats ? 'play-proof-model' : 'play-entry-model';
  return <View style={styles.wrap} onTouchStart={!disabled && !interacted ? () => setInteracted(true) : undefined} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
    {width > 0 && <QuantityStage model={object === 'cookie' ? 'cookies' : 'share'} locked={disabled}><View ref={drawing} collapsable={false} accessible={!!beats} accessibilityRole={beats ? "image" : undefined} accessibilityLabel={beats ? spokenStatus : undefined} nativeID={modelID} testID={modelID}
      style={{alignSelf: 'center', width: boardWidth}}>
      <ProofWindow focus={focus} height={visibleHeight} contentHeight={height}><View style={{height}}>{boxes.map((box, i) => <Pressable key={i} disabled={disabled}
      accessibilityRole={disabled ? "image" : "button"} accessibilityLabel={name(i) + ', ' + currentPlaces.filter(p => p === i).length}
      accessibilityHint={badges && i ? (i <= selectedGroups ? t('objectScenes.flowers', {count: 1}) : t('taskObjects.leaf')) : undefined}
      onPress={() => { setInteracted(true); if (selected !== null) move(selected, i); }}
      style={[styles.tray, { left: box.x, top: box.y, width: box.width, height: box.height },
        i > 0 && styles.receivingTray, badges && i > 0 && i <= selectedGroups && styles.flowerTray,
        selectedPlace !== null && selectedPlace !== i && (badges ? {backgroundColor: (i > 0 && i <= selectedGroups ? Quantity.berry : Quantity.teal).light} : styles.destination),
        highlight && i > 0 && (i <= (selectedGroups || groups) ? badges ? styles.flowerFinish : styles.subset : styles.muted),
        object === 'cookie' && i > 0 && styles.dish]}>
      {object === 'cookie' && i > 0 && <PressFace pressed={false} radius={60} borderWidth={0}
        fill={highlight || selectedPlace !== null && selectedPlace !== i ? Quantity.violet.light : Quantity.teal.soft}
        edge={highlight || selectedPlace !== null && selectedPlace !== i ? Quantity.violet.fill : Quantity.teal.fill} />}
      {help && i === 0 && beats && tintAt != null && items % groups === 0 && <TrayFinish position={beats.position} start={tintAt} color={PuzzleColors.background} plate={false} />}
      {i > 0 && beats && tintAt != null && <TrayFinish position={beats.position} start={tintAt} color={selectedGroups && i > selectedGroups ? Shape.empty : badges ? Quantity.berry.light : Quantity.violet.light} plate={object === 'cookie'} />}
      {beats && i === attemptTray && <TrayFinish position={beats.position} start={0} color={Quantity.amber.light} plate={object === 'cookie' && i > 0} />}
      {badges && i > 0 && <View style={styles.badge}><MaterialCommunityIcons name={i <= selectedGroups ? 'flower' : 'leaf'}
        size={34} color={i <= selectedGroups ? Quantity.berry.edge : Quantity.teal.edge} /></View>}
    </Pressable>)}
    {locations.map((place, id) => {
      const slot = slots[id];
      const turn = flights?.findIndex(f => f.id === id) ?? -1;
      const flight = flights?.[turn];
      const { x, y } = sharingSlot(boxes[place], slot);
      const actions = boxes.flatMap((_, i) => i === place ? [] : [{ name: String(i), label: t('friendlyQ.moveTo', { where: name(i), defaultValue: 'Move to {{where}}' }) }]);
      return <Movable key={id} pitch={pitch} flight={flight && position ? {...sharingSlot(boxes[flight.destination], flight.slot), turn, position} : undefined}
        landed={!!flight && completed === turn + 1 || id === inspectedId && !!beats?.landed} muted={highlight && badges && (flight?.destination ?? place) > selectedGroups} entryIndex={buildOnEntry ? id : undefined} enabled={!disabled && (selected === null || selected === id || place === locations[selected])} {...{ x, y, object, actions }} selected={!disabled && selected === id}
        hint={object === 'cookie' ? t('friendlyQ.cookieHint') : t('friendlyQ.shareHint')}
        label={(object ? t('taskObjects.' + object) : t('countingScene.objects')) + ' ' + (id + 1) + ', ' + name(place)}
        onAction={dest => move(id, Number(dest))} onPick={() => {
          if (disabled) return;
          landTick(); setInteracted(true);
          if (selected !== null && locations[selected] !== place) move(selected, place);
          else select(selected === id ? null : id);
        }} onDrop={(px, py) => { const dest = boxes.findIndex(b => px >= b.x && px <= b.x + b.width && py >= b.y && py <= b.y + b.height);
          if (dest >= 0) move(id, dest); }} />;
    })}
    {!disabled && sourceId >= 0 && firstPlate && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 4 }]}>
      <IdleHint movable firstEncounter={firstEncounter} interacted={interacted} from={{ x: source.x + pitch / 2, y: source.y + pitch / 2 }}
        to={{ x: firstPlate.x + firstPlate.width / 2, y: firstPlate.y + firstPlate.height / 2 }} />
    </View>}
    </View></ProofWindow></View></QuantityStage>}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 8 }, tray: { position: 'absolute', borderRadius: 16, backgroundColor: Shape.empty },
  flowerTray: {backgroundColor: Quantity.berry.soft}, flowerFinish: {backgroundColor: Quantity.berry.light},
  receivingTray: { backgroundColor: Quantity.teal.soft },
  dish: { borderRadius: 60, backgroundColor: 'transparent' }, subset: { backgroundColor: Quantity.violet.light },
  muted: {backgroundColor: Shape.empty}, badge: {alignSelf: 'center', height: 38, justifyContent: 'center'},
  piece: { position: 'absolute', width: cell, height: cell, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  destination: { backgroundColor: Quantity.violet.light },
  selected: { backgroundColor: PuzzleColors.selectedSurface },
});
