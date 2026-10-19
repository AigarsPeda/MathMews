import { GameColors } from "@/constants/game";
import { findPuzzleDropZone, type PuzzleDropZone } from "@/utils/puzzle-drag";
import { moderateScale } from "@/utils/scale";
import * as Haptics from "expo-haptics";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { cancelAnimation, Easing, measure, ReduceMotion, useAnimatedRef, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type AnimatedRef, type LayoutAnimationFunction, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

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
};
const Context = createContext<DragContext | null>(null);
function useDragBoard() {
  const context = useContext(Context);
  if (!context) throw new Error("Puzzle drag controls need a PuzzleDragBoard");
  return context;
}

export function PuzzleDragBoard({ children, onDrop, onDragStateChange }: {
  children: ReactNode; onDrop: (source: string, target: string) => void;
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
  return <Context value={{ board, zones, source, hovered, position, released, lift, landing, begin, finish, register, refresh }}>
    <Animated.View ref={board} collapsable={false} onLayout={refresh} style={styles.board}>
      {children}
      <Animated.View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.tile, styles.floating, floating]}>
        <Text style={styles.number}>{label}</Text>
      </Animated.View>
    </Animated.View>
  </Context>;
}

export function PuzzleDropArea({ id, motionId, children, style, label }: { id: string; motionId?: string; children: ReactNode; style?: StyleProp<ViewStyle>; label: string }) {
  const { register, refresh, hovered, released, source, landing } = useDragBoard();
  const reducedMotion = useReducedMotion();
  const ref = useCallback((view: View | null) => register(id, view), [id, register]);
  const highlight = useAnimatedStyle(() => ({ borderColor: hovered.get() === id ? GameColors.secondaryDark : "transparent" }));
  const layer = useAnimatedStyle(() => ({ zIndex: motionId && landing.get() === motionId ? 100 : 0 }));
  const settle = useCallback<LayoutAnimationFunction>(values => {
    "worklet";
    const drop = released.get();
    const fromFinger = drop !== null && drop.id === motionId;
    if (fromFinger) {
      released.set(null);
      source.set("");
    }
    const timing = { duration: reducedMotion ? 0 : 240, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };
    return {
      initialValues: {
        originX: values.currentOriginX + (fromFinger ? drop.translationX : 0),
        originY: values.currentOriginY + (fromFinger ? drop.translationY : 0),
        width: values.currentWidth, height: values.currentHeight,
        transform: [{ scale: fromFinger && !reducedMotion ? 1.06 : 1 }],
      },
      animations: {
        originX: withTiming(values.targetOriginX, timing), originY: withTiming(values.targetOriginY, timing),
        width: withTiming(values.targetWidth, timing), height: withTiming(values.targetHeight, timing),
        transform: [{ scale: withTiming(1, timing) }],
      },
      callback: finished => {
        if (landing.get() === motionId) landing.set("");
        if (finished) scheduleOnRN(refresh);
      },
    };
  }, [landing, motionId, reducedMotion, refresh, released, source]);
  return <Animated.View ref={ref} collapsable={false} onLayout={refresh} layout={motionId ? settle : undefined} style={[styles.dropArea, style, layer]} accessibilityLabel={label}>
    {children}
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.highlight, highlight]} />
  </Animated.View>;
}

export function PuzzleDragTile({ id, motionId, label, disabled, compact, style, accessibilityLabel, accessibilityHint, actions, onPress, selected }: {
  id: string; motionId?: string; label: string; disabled: boolean; compact?: boolean; style?: StyleProp<ViewStyle>; accessibilityLabel: string; accessibilityHint: string;
  actions: { id: string; label: string }[];
  onPress?: () => void;
  selected?: boolean;
}) {
  const { board, zones, source, hovered, position, released, lift, landing, begin, finish } = useDragBoard();
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
      lift.set(withTiming(1.06, { duration: 100, reduceMotion: ReduceMotion.System }));
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
        lift.set(withTiming(1, { duration: 200, reduceMotion: ReduceMotion.System }));
        position.set(withTiming({ ...position.get(), x: start.x, y: start.y }, { duration: 200, reduceMotion: ReduceMotion.System }, done => {
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
    <Animated.View ref={tile} collapsable={false} style={[styles.tile, compact && styles.compact, style, dragging]} accessible
      accessibilityRole="button" accessibilityState={{ disabled, selected }} accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint}
      accessibilityActions={disabled ? [] : actions.map(action => ({ name: action.id, label: action.label }))}
      onAccessibilityTap={disabled ? undefined : () => { released.set(null); onPress?.(); }}
      onAccessibilityAction={event => {
        if (disabled) return;
        released.set(null);
        if (event.nativeEvent.actionName === "activate") onPress?.();
        else if (actions.some(action => action.id === event.nativeEvent.actionName)) finish(id, event.nativeEvent.actionName);
      }}>
      <Text style={[styles.number, compact && styles.compactNumber]}>{label}</Text>
    </Animated.View>
  </GestureDetector>;
}

const styles = StyleSheet.create({
  board: { position: "relative", gap: moderateScale(16) },
  tile: { minWidth: moderateScale(64), minHeight: moderateScale(60), padding: moderateScale(12), borderRadius: moderateScale(14), borderWidth: 2, borderColor: GameColors.cardBorder, backgroundColor: GameColors.card, justifyContent: "center", alignItems: "center" },
  compact: { minWidth: moderateScale(48), minHeight: moderateScale(48), padding: moderateScale(6), borderRadius: moderateScale(10) },
  number: { fontSize: moderateScale(23), fontWeight: "800", color: GameColors.text, textAlign: "center" },
  compactNumber: { fontSize: moderateScale(19) },
  floating: { position: "absolute", left: 0, top: 0, zIndex: 100, elevation: 8, borderColor: GameColors.secondaryDark, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 8 },
  dropArea: { position: "relative" },
  highlight: { borderWidth: 3, borderRadius: moderateScale(14) },
});
