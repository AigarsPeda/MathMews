import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { Ink, LandSpring, Motion, PuzzleColors as GameColors, Quantity, Radius, Stroke } from "@/constants/puzzle-theme";
import { findPuzzleDropZone, type PuzzleDropZone } from "@/utils/puzzle-drag";
import { moderateScale } from "@/utils/scale";
import * as Haptics from "expo-haptics";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { cancelAnimation, Easing, FadeIn, measure, ReduceMotion, useAnimatedRef, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming, type AnimatedRef, type EntryAnimationsValues, type LayoutAnimation, type LayoutAnimationFunction, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

export const numberTileFaces = StyleSheet.create({
  resting: { borderWidth: 0, borderBottomWidth: 3, borderBottomColor: Quantity.amber.edge, backgroundColor: Quantity.amber.fill },
  lifted: { borderWidth: 0, borderBottomWidth: 3, borderBottomColor: Quantity.violet.edge, backgroundColor: Quantity.violet.fill, transform: [{ translateY: -2 }] },
});

type DragContext = {
  board: AnimatedRef<View>;
  zones: SharedValue<PuzzleDropZone[]>;
  source: SharedValue<string>;
  hovered: SharedValue<string | null>;
  position: SharedValue<{ x: number; y: number; width: number; height: number }>;
  released: SharedValue<{ id: string; translationX: number; translationY: number } | null>;
  lift: SharedValue<number>;
  landing: SharedValue<string>;
  begin: (label: string) => void;
  finish: (source: string, target: string | null) => void;
  register: (id: string, view: View | null) => void;
  refresh: () => void;
  /** True once the board's first frame is on screen: later mounts are placements and land. */
  ready: { current: boolean };
};
const Context = createContext<DragContext | null>(null);
// Worklets cannot call moderateScale: sizes used on the UI thread are fixed here.
const INSERT_OFFSET = moderateScale(8);
const LAND_DROP = moderateScale(10);
function useDragBoard() {
  const context = useContext(Context);
  if (!context) throw new Error("Puzzle drag controls need a PuzzleDragBoard");
  return context;
}

export function PuzzleDragBoard({ children, onDrop, onDragStateChange, floatingStyle }: {
  floatingStyle?: StyleProp<ViewStyle>; children: ReactNode; onDrop: (source: string, target: string) => void;
  onDragStateChange: (dragging: boolean) => void;
}) {
  const board = useAnimatedRef<View>();
  const zones = useSharedValue<PuzzleDropZone[]>([]);
  const source = useSharedValue("");
  const hovered = useSharedValue<string | null>(null);
  const position = useSharedValue({ x: 0, y: 0, width: 0, height: 0 });
  const released = useSharedValue<{ id: string; translationX: number; translationY: number } | null>(null);
  const lift = useSharedValue(1);
  const landing = useSharedValue("");
  const views = useRef(new Map<string, View>());
  const measurements = useRef(new Map<string, PuzzleDropZone>());
  const [label, setLabel] = useState("");
  const ready = useRef(false);
  useEffect(() => { ready.current = true; }, []);
  const refresh = useCallback(() => {
    const ancestor = board.current;
    if (!ancestor) return;
    views.current.forEach((view, id) => view.measureLayout(ancestor, (x, y, width, height) => {
      if (views.current.get(id) !== view) return;
      // Shared-value writes reach the UI thread asynchronously. Build the complete
      // list on this thread so sibling measurement callbacks cannot overwrite it.
      measurements.current.set(id, { id, x, y, width, height });
      zones.set([...measurements.current.values()]);
    }, () => {}));
  }, [board, zones]);
  const register = useCallback((id: string, view: View | null) => {
    if (view) views.current.set(id, view);
    else {
      views.current.delete(id);
      measurements.current.delete(id);
      zones.set([...measurements.current.values()]);
    }
  }, [zones]);
  const begin = useCallback((value: string) => {
    setLabel(value);
    onDragStateChange(true);
    refresh();
  }, [onDragStateChange, refresh]);
  const finish = useCallback((id: string, target: string | null) => {
    onDragStateChange(false);
    if (target !== null) {
      onDrop(id, target);
      void Haptics.selectionAsync();
    }
  }, [onDragStateChange, onDrop]);
  useEffect(() => () => onDragStateChange(false), [onDragStateChange]);
  const floating = useAnimatedStyle(() => {
    const p = position.get();
    return { width: p.width, height: p.height, opacity: source.get() ? 1 : 0, transform: [{ translateX: p.x }, { translateY: p.y }, { scale: lift.get() }] };
  });
  return <Context value={{ board, zones, source, hovered, position, released, lift, landing, begin, finish, register, refresh, ready }}>
    <Animated.View ref={board} collapsable={false} onLayout={refresh} style={styles.board}>
      {children}
      <Animated.View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.tile, styles.floating, floatingStyle, floating]}>
        <TileLabel label={label} />
      </Animated.View>
    </Animated.View>
  </Context>;
}

/** Stacked a/b for fraction labels ("2/4"), plain text for everything else. */
export function TileLabel({ label, compact = false, selected = false, size }: { label: string; compact?: boolean; selected?: boolean; size?: number }) {
  // An explicit size belongs to a physical piece, so system text size does not grow it past the piece.
  const cap = size ? 1 : undefined;
  const fraction = /^(\d+)\/(\d+)$/.exec(label);
  // An explicit size (pt) is used as given, so big tiles keep big digits.
  const sized = size ? { fontSize: size, lineHeight: Math.round(size * 1.2) } : null;
  const text = [styles.number, compact && styles.compactNumber, selected && styles.selectedNumber, sized];
  if (!fraction) return <Text numberOfLines={1} maxFontSizeMultiplier={cap} style={text}>{label}</Text>;
  return <View style={styles.fraction} accessible={false}>
    <Text maxFontSizeMultiplier={cap} style={[text, styles.fractionPart, sized]}>{fraction[1]}</Text>
    <View style={[styles.fractionBar, selected && styles.fractionBarSelected]} />
    <Text maxFontSizeMultiplier={cap} style={[text, styles.fractionPart, sized]}>{fraction[2]}</Text>
  </View>;
}

/**
 * A move (drag) inserts the tile before or after the hovered one; a two-tap
 * swap exchanges them. Moving tiles pass each other on opposite arcs, so a
 * swap visibly crosses over; a tile released by the finger lands with the
 * shared landing spring.
 */
export function PuzzleDropArea({ id, motionId, children, style, label, insertion = false, fillOnly = false }: {
  id: string; motionId?: string; children: ReactNode; style?: StyleProp<ViewStyle>; label: string;
  /** Show an insertion bar on the side the dragged tile will be inserted, instead of outlining the target. */
  insertion?: boolean; fillOnly?: boolean;
}) {
  const { register, refresh, hovered, released, source, landing, zones } = useDragBoard();
  const reducedMotion = useReducedMotion();
  const ref = useCallback((view: View | null) => register(id, view), [id, register]);
  const highlight = useAnimatedStyle(() => ({ opacity: !insertion && source.get() !== id && hovered.get() === id ? 1 : 0 }));
  const insertBar = useAnimatedStyle(() => {
    if (!insertion || hovered.get() !== id || source.get() === id) return { opacity: 0 };
    const all = zones.get();
    const from = all.find(zone => zone.id === source.get()), to = all.find(zone => zone.id === id);
    const after = !!from && !!to && from.x < to.x;
    return { opacity: 1, left: after ? undefined : -INSERT_OFFSET, right: after ? -INSERT_OFFSET : undefined };
  });
  const layer = useAnimatedStyle(() => ({ zIndex: motionId && landing.get() === motionId ? 100 : 0 }));
  const settle = useCallback<LayoutAnimationFunction>(values => {
    "worklet";
    const drop = released.get();
    const fromFinger = drop !== null && drop.id === motionId;
    if (fromFinger) {
      released.set(null);
      source.set("");
    }
    const timing = { duration: reducedMotion ? 0 : Motion.step, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };
    const half = { duration: reducedMotion ? 0 : Motion.step / 2, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System };
    const dx = values.targetOriginX - values.currentOriginX;
    // Rightward tiles ride over the top and leftward tiles under, so a swap crosses instead of colliding.
    const rise = Math.min(values.currentHeight * .55, Math.abs(dx) * .35) * (dx > 0 ? -1 : 1);
    const originY = reducedMotion ? withTiming(values.targetOriginY, timing)
      : fromFinger ? withSpring(values.targetOriginY, LandSpring)
        : Math.abs(dx) > 1 && Math.abs(values.targetOriginY - values.currentOriginY) < 1
          ? withSequence(withTiming(values.targetOriginY + rise, half), withSpring(values.targetOriginY, LandSpring))
          : withTiming(values.targetOriginY, timing);
    return {
      initialValues: {
        originX: values.currentOriginX + (fromFinger ? drop.translationX : 0),
        originY: values.currentOriginY + (fromFinger ? drop.translationY : 0),
        width: values.currentWidth, height: values.currentHeight,
        transform: [{ scale: fromFinger && !reducedMotion ? 1.06 : 1 }],
      },
      animations: {
        originX: withTiming(values.targetOriginX, timing), originY,
        width: withTiming(values.targetWidth, timing), height: withTiming(values.targetHeight, timing),
        transform: [{ scale: reducedMotion ? withTiming(1, timing) : withSpring(1, LandSpring) }],
      },
      callback: finished => {
        if (landing.get() === motionId) landing.set("");
        if (finished) scheduleOnRN(refresh);
      },
    };
  }, [landing, motionId, reducedMotion, refresh, released, source]);
  return <Animated.View ref={ref} collapsable={false} onLayout={refresh} layout={motionId ? settle : undefined} style={[styles.dropArea, style, layer]} accessibilityLabel={label}>
    {children}
    {!fillOnly && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.highlight, highlight]} />}
    {insertion ? <Animated.View pointerEvents="none" style={[styles.insertBar, insertBar]} /> : null}
  </Animated.View>;
}

/** A picked tile can be placed in any tinted slot. */
export function PuzzleDropSlot({ armed, onPress, accessibilityLabel, compact, style }: {
  armed: boolean; onPress: () => void; accessibilityLabel: string; compact?: boolean; style?: StyleProp<ViewStyle>;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled: !armed }} disabled={!armed} onPress={onPress}
    hitSlop={6} style={({ pressed }) => [styles.slot, compact && styles.compactSlot, armed && styles.slotArmed, pressed && styles.slotPressed, style]}>
    {armed ? <View style={styles.slotDot} accessible={false} /> : null}
  </Pressable>;
}

function landTile(_values: EntryAnimationsValues): LayoutAnimation {
  "worklet";
  return {
    initialValues: { opacity: 0, transform: [{ translateY: -LAND_DROP }, { scale: .86 }] },
    animations: { opacity: withTiming(1, { duration: Motion.tap }), transform: [{ translateY: withSpring(0, LandSpring) }, { scale: withSpring(1, LandSpring) }] },
  };
}

export function PuzzleDragTile({ id, motionId, label, disabled, compact, grip, style, accessibilityLabel, accessibilityHint, actions, onPress, selected, face, footer }: {
  id: string; motionId?: string; label: string; disabled: boolean; compact?: boolean;
  /** Show a small grip under the number: this tile can be picked up and reordered. */
  grip?: boolean; style?: StyleProp<ViewStyle>; accessibilityLabel: string; accessibilityHint: string;
  actions: { id: string; label: string }[];
  onPress?: () => void;
  selected?: boolean;
  /** Small picture under the label (e.g. a fraction strip). */
  footer?: ReactNode; face?: ReactNode;
}) {
  const { board, zones, source, hovered, position, released, lift, landing, begin, finish, ready } = useDragBoard();
  const reducedMotion = useReducedMotion();
  // Tiles that appear after the first frame have just been placed: they land.
  // Reordered tiles (motionId) travel with their drop area instead.
  const entering = !motionId && ready.current ? reducedMotion ? FadeIn.duration(Motion.fade) : landTile : undefined;
  const tile = useAnimatedRef<View>();
  const origin = useSharedValue({ x: 0, y: 0, pageX: 0, pageY: 0 });
  const target = useSharedValue<string | null>(null);
  const active = useSharedValue(false);
  const gesture = useMemo(() => Gesture.Pan().enabled(!disabled).maxPointers(1).minDistance(4)
    .onBegin(() => { target.set(null); })
    // Gesture Handler stores this callback and measures only when a native drag starts.
    // eslint-disable-next-line react-hooks/refs
    .onStart(() => {
      cancelAnimation(position);
      released.set(null);
      landing.set("");
      source.set("");
      scheduleOnRN(begin, label);
      const root = measure(board), item = measure(tile);
      if (!root || !item) return;
      const x = item.pageX - root.pageX, y = item.pageY - root.pageY;
      origin.set({ x, y, pageX: root.pageX, pageY: root.pageY });
      position.set({ x, y, width: item.width, height: item.height });
      lift.set(withTiming(1.06, { duration: Motion.tap, reduceMotion: ReduceMotion.System }));
      active.set(true);
      source.set(id);
    })
    .onUpdate(event => {
      if (source.get() !== id) return;
      const start = origin.get(), p = position.get();
      position.set({ ...p, x: start.x + event.translationX, y: start.y + event.translationY });
      hovered.set(findPuzzleDropZone(zones.get(), event.absoluteX - start.pageX, event.absoluteY - start.pageY));
    })
    .onEnd(event => {
      if (source.get() !== id) return;
      const start = origin.get();
      target.set(findPuzzleDropZone(zones.get(), event.absoluteX - start.pageX, event.absoluteY - start.pageY));
    })
    .onFinalize((_event, success) => {
      if (!active.get()) {
        scheduleOnRN(finish, id, null);
        return;
      }
      active.set(false);
      const destination = source.get() === id && success ? target.get() : null;
      hovered.set(null);
      if (source.get() === id && (destination === null || motionId && destination === id)) {
        const start = origin.get();
        lift.set(withTiming(1, { duration: Motion.tap, reduceMotion: ReduceMotion.System }));
        // Released nowhere: the tile travels back to where it came from.
        position.set(withTiming({ ...position.get(), x: start.x, y: start.y }, { duration: Motion.step, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }, done => {
          if (done) source.set("");
        }));
      } else {
        if (source.get() === id && motionId) {
          const p = position.get(), start = origin.get();
          released.set({ id: motionId, translationX: p.x - start.x, translationY: p.y - start.y });
          landing.set(motionId);
        } else source.set("");
      }
      scheduleOnRN(finish, id, destination);
    }), [active, begin, board, disabled, finish, hovered, id, label, landing, lift, motionId, origin, position, released, source, target, tile, zones]);
  const combinedGesture = useMemo(() => onPress
    ? Gesture.Race(gesture, Gesture.Tap().enabled(!disabled).onEnd((_event, success) => { if (success) { released.set(null); scheduleOnRN(onPress); } }))
    : gesture, [disabled, gesture, onPress, released]);
  const dragging = useAnimatedStyle(() => ({ opacity: motionId && released.get()?.id === motionId ? 0 : source.get() === id ? 0.2 : 1 }));
  return <GestureDetector gesture={combinedGesture}>
    <Animated.View ref={tile} testID={`drag-choice-${id}`} collapsable={false} entering={entering} style={[styles.tile, compact && styles.compact, selected && !disabled && styles.selected, style, dragging]} accessible
      accessibilityRole="button" accessibilityState={{ disabled, selected }} accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint}
      accessibilityActions={disabled ? [] : actions.map(action => ({ name: action.id, label: action.label }))}
      onAccessibilityTap={disabled ? undefined : () => { released.set(null); onPress?.(); }}
      onAccessibilityAction={event => {
        if (disabled) return;
        released.set(null);
        if (event.nativeEvent.actionName === "activate") onPress?.();
        else if (actions.some(action => action.id === event.nativeEvent.actionName)) finish(id, event.nativeEvent.actionName);
      }}>
      {face ?? <TileLabel label={label} compact={compact} selected={selected && !disabled} />}
      {footer}
      {grip && !disabled ? <View style={styles.grip} accessible={false}>{[0, 1, 2].map(i => <View key={i} style={styles.gripDot} />)}</View> : null}
    </Animated.View>
  </GestureDetector>;
}

// Draggable tiles share the kit's NumberTile recipe: white face, 2 pt outline,
// 4 pt lip; selection is the berry ring. The lifted copy is flat (no blur).
const styles = StyleSheet.create({
  board: { position: "relative", gap: moderateScale(16) },
  tile: { minWidth: moderateScale(64), minHeight: moderateScale(60), paddingHorizontal: moderateScale(12), paddingVertical: moderateScale(8), borderRadius: Radius.tray, borderBottomWidth: 3, borderColor: GameColors.cardBorder, backgroundColor: Ink.tray, justifyContent: "center", alignItems: "center" },
  compact: { minWidth: moderateScale(48), minHeight: moderateScale(48), paddingHorizontal: moderateScale(6), paddingVertical: moderateScale(4), borderRadius: moderateScale(10) },
  selected: { borderColor: GameColors.primary, backgroundColor: GameColors.selectedSurface },
  number: { fontSize: moderateScale(23), fontWeight: "800", color: Ink.text, textAlign: "center", fontVariant: ["tabular-nums"] },
  selectedNumber: { color: GameColors.primaryDark },
  compactNumber: { fontSize: moderateScale(19) },
  fraction: { alignItems: "center" },
  fractionPart: { fontSize: moderateScale(19), lineHeight: moderateScale(22) },
  fractionBar: { alignSelf: "stretch", minWidth: moderateScale(18), height: Stroke.outline, borderRadius: 1, backgroundColor: Ink.text, marginVertical: 1 },
  fractionBarSelected: { backgroundColor: GameColors.primaryDark },
  grip: { flexDirection: "row", gap: moderateScale(3), marginTop: moderateScale(4) },
  gripDot: { width: moderateScale(4), height: moderateScale(4), borderRadius: moderateScale(2), backgroundColor: Ink.line },
  floating: { position: "absolute", left: 0, top: 0, zIndex: 100, elevation: 0, borderColor: GameColors.primary, backgroundColor: GameColors.selectedSurface },
  dropArea: { position: "relative" },
  // friendly-ok: Visible only over the active drag destination.
  highlight: { borderStyle: "dashed", borderColor: GameColors.primary, borderWidth: 3, borderRadius: moderateScale(14) },
  insertBar: { position: "absolute", top: moderateScale(4), bottom: moderateScale(4), width: moderateScale(4), borderRadius: 2, backgroundColor: GameColors.primary },
  slot: { minWidth: moderateScale(52), minHeight: moderateScale(52), borderRadius: Radius.tray, backgroundColor: Ink.tray,
    alignItems: "center", justifyContent: "center" },
  compactSlot: { minWidth: moderateScale(48), minHeight: moderateScale(48), borderRadius: moderateScale(10) },
  slotArmed: { backgroundColor: GameColors.selectedSurface },
  slotPressed: { transform: [{ scale: .97 }] },
  slotDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: GameColors.primary },
});
