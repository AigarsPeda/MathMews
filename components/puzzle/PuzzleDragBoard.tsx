import { GameColors } from "@/constants/game";
import { findPuzzleDropZone, type PuzzleDropZone } from "@/utils/puzzle-drag";
import { moderateScale } from "@/utils/scale";
import * as Haptics from "expo-haptics";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { measure, useAnimatedRef, useAnimatedStyle, useSharedValue, type AnimatedRef, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

type DragContext = {
  board: AnimatedRef<View>;
  zones: SharedValue<PuzzleDropZone[]>;
  source: SharedValue<string>;
  hovered: SharedValue<string | null>;
  position: SharedValue<{ x: number; y: number; width: number; height: number }>;
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
    return { width: p.width, height: p.height, opacity: source.get() ? 1 : 0, transform: [{ translateX: p.x }, { translateY: p.y }, { scale: 1.06 }] };
  });
  return <Context value={{ board, zones, source, hovered, position, begin, finish, register, refresh }}>
    <Animated.View ref={board} collapsable={false} onLayout={refresh} style={styles.board}>
      {children}
      <Animated.View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.tile, styles.floating, floating]}>
        <Text style={styles.number}>{label}</Text>
      </Animated.View>
    </Animated.View>
  </Context>;
}

export function PuzzleDropArea({ id, children, style, label }: { id: string; children: ReactNode; style?: StyleProp<ViewStyle>; label: string }) {
  const { register, refresh, hovered } = useDragBoard();
  const ref = useCallback((view: View | null) => register(id, view), [id, register]);
  const highlight = useAnimatedStyle(() => ({ borderColor: hovered.get() === id ? GameColors.secondaryDark : "transparent" }));
  return <View ref={ref} collapsable={false} onLayout={refresh} style={[styles.dropArea, style]} accessibilityLabel={label}>
    {children}
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.highlight, highlight]} />
  </View>;
}

export function PuzzleDragTile({ id, label, disabled, compact, style, accessibilityLabel, accessibilityHint, actions }: {
  id: string; label: string; disabled: boolean; compact?: boolean; style?: StyleProp<ViewStyle>; accessibilityLabel: string; accessibilityHint: string;
  actions: { id: string; label: string }[];
}) {
  const { board, zones, source, hovered, position, begin, finish } = useDragBoard();
  const tile = useAnimatedRef<View>();
  const origin = useSharedValue({ x: 0, y: 0, pageX: 0, pageY: 0 });
  const target = useSharedValue<string | null>(null);
  const gesture = useMemo(() => Gesture.Pan().enabled(!disabled).maxPointers(1).minDistance(4)
    .onBegin(() => { target.set(null); scheduleOnRN(begin, label); })
    // Gesture Handler stores this callback and measures only when a native drag starts.
    // eslint-disable-next-line react-hooks/refs
    .onStart(() => {
      const root = measure(board), item = measure(tile);
      if (!root || !item) return;
      const x = item.pageX - root.pageX, y = item.pageY - root.pageY;
      origin.set({ x, y, pageX: root.pageX, pageY: root.pageY });
      position.set({ x, y, width: item.width, height: item.height });
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
      source.set(""); hovered.set(null);
      scheduleOnRN(finish, id, success ? target.get() : null);
    }), [begin, board, disabled, finish, hovered, id, label, origin, position, source, target, tile, zones]);
  const dragging = useAnimatedStyle(() => ({ opacity: source.get() === id ? 0.2 : 1 }));
  return <GestureDetector gesture={gesture}>
    <Animated.View ref={tile} collapsable={false} style={[styles.tile, compact && styles.compact, style, dragging]} accessible
      accessibilityRole="button" accessibilityState={{ disabled }} accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint}
      accessibilityActions={disabled ? [] : actions.map(action => ({ name: action.id, label: action.label }))}
      onAccessibilityAction={event => { if (!disabled && actions.some(action => action.id === event.nativeEvent.actionName)) finish(id, event.nativeEvent.actionName); }}>
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
