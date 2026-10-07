import { useTranslation } from "react-i18next";
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import { moderateScale } from "@/utils/scale";
import {
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import { RoomActionMenu, type RoomItemMenuAction } from "@/components/pet/RoomActionMenu";
import { getRoomDepthZIndex } from "@/utils/room-depth";
import { ROOM_MENU_OPEN_Z_INDEX } from "@/utils/room-layer-order";

export type RoomPetOffset = {
  x: number;
  y: number;
};

const DEFAULT_OFFSET: RoomPetOffset = { x: 0, y: 0.12 };
const DRAG_THRESHOLD = moderateScale(6);

type DraggableRoomPetProps = {
  children: ReactNode;
  testID?: string;
  accessibilityLabel?: string;
  selected?: boolean;
  snapToGrid?: boolean;
  petSize: number;
  allowDrag?: boolean;
  dragScale?: number;
  interactive?: boolean;
  externalPosition?: { x: number; y: number };
  animatedPosition?: { x: SharedValue<number>; y: SharedValue<number> };
  /** Tap/drag target — defaults to petSize. Use a smaller value for narrow sprites. */
  hitSize?: number;
  initialOffset?: RoomPetOffset;
  onOffsetChange?: (offset: RoomPetOffset) => void;
  /** Live position in room pixels relative to the room's center. */
  onPositionChange?: (position: { x: number; y: number }) => void;
  onDragPositionChange?: (position: { x: number; y: number }) => void;
  onDragStart?: () => void;
  onPetTap?: () => void;
  layerZIndex?: number;
  /** Ground contact below the sprite center, as a fraction of its size. */
  depthAnchor?: number;
  depthScale?: SharedValue<number>;
  depthY?: SharedValue<number>;
  menuActions?: RoomItemMenuAction[];
};

function maxAxisOffset(roomSize: number, petSize: number) {
  return Math.max(0, (roomSize - petSize) / 2);
}

function offsetToPixels(
  offset: RoomPetOffset,
  roomWidth: number,
  roomHeight: number,
  petSize: number,
) {
  const maxX = maxAxisOffset(roomWidth, petSize);
  const maxY = maxAxisOffset(roomHeight, petSize);
  return {
    x: offset.x * maxX,
    y: offset.y * maxY,
  };
}

function pixelsToOffset(
  x: number,
  y: number,
  roomWidth: number,
  roomHeight: number,
  petSize: number,
): RoomPetOffset {
  const maxX = maxAxisOffset(roomWidth, petSize);
  const maxY = maxAxisOffset(roomHeight, petSize);
  return {
    x: maxX > 0 ? x / maxX : 0,
    y: maxY > 0 ? y / maxY : 0,
  };
}

function clampPosition(
  x: number,
  y: number,
  roomWidth: number,
  roomHeight: number,
  petSize: number,
) {
  const maxX = maxAxisOffset(roomWidth, petSize);
  const maxY = maxAxisOffset(roomHeight, petSize);
  return {
    x: Math.max(-maxX, Math.min(maxX, x)),
    y: Math.max(-maxY, Math.min(maxY, y)),
  };
}

export function DraggableRoomPet({
  children,
  testID,
  accessibilityLabel,
  selected = false,
  snapToGrid = false,
  petSize,
  allowDrag = true,
  dragScale = 1,
  interactive = true,
  animatedPosition,
  externalPosition,
  hitSize,
  initialOffset = DEFAULT_OFFSET,
  onOffsetChange,
  onPositionChange,
  onDragPositionChange,
  onDragStart,
  onPetTap,
  layerZIndex = 1,
  depthAnchor,
  depthScale,
  depthY,
  menuActions,
}: DraggableRoomPetProps) {
  const { t } = useTranslation();
  const [roomSize, setRoomSize] = useState({ width: 0, height: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const liveX = useSharedValue(0);
  const liveY = useSharedValue(0);
  const dragging = useSharedValue(false);
  useLayoutEffect(() => { if (!dragging.get()) { liveX.set(position.x); liveY.set(position.y); } }, [dragging, liveX, liveY, position]);
  useLayoutEffect(() => {
    if (!dragging.get()) onPositionChange?.(position);
  }, [dragging, onPositionChange, position]);

  const positionRef = useRef(position);

  const dragStartRef = useRef({ x: 0, y: 0 });
  const gestureMovedRef = useRef(false);

  const onOffsetChangeRef = useRef(onOffsetChange);
  const onPositionChangeRef = useRef(onPositionChange);
  const onDragPositionChangeRef = useRef(onDragPositionChange);
  const onDragStartRef = useRef(onDragStart);

  const onPetTapRef = useRef(onPetTap);

  useLayoutEffect(() => {
    if (!dragging.get()) positionRef.current = position;
    onOffsetChangeRef.current = onOffsetChange;
    onPositionChangeRef.current = onPositionChange;
    onDragPositionChangeRef.current = onDragPositionChange;
    onDragStartRef.current = onDragStart;
    onPetTapRef.current = onPetTap;
  }, [dragging, position, onOffsetChange, onPositionChange, onDragPositionChange, onDragStart, onPetTap]);

  const resolvedOffset = initialOffset ?? DEFAULT_OFFSET;
  const resolvedHitSize = Math.min(hitSize ?? petSize, petSize);
  const hitInset = (petSize - resolvedHitSize) / 2;

  const syncPosition = useCallback(
    (width: number, height: number, size: number, offset: RoomPetOffset) => {
      const pixels = offsetToPixels(offset, width, height, size);
      setPosition(pixels);
    },
    [],
  );

  const placementKey = `${roomSize.width}:${roomSize.height}:${petSize}:${resolvedOffset.x}:${resolvedOffset.y}`;
  const [previousPlacement, setPreviousPlacement] = useState(placementKey);
  if (previousPlacement !== placementKey) {
    setPreviousPlacement(placementKey);
    setPosition(offsetToPixels(resolvedOffset, roomSize.width, roomSize.height, petSize));
  }

  const commitOffset = useCallback(() => {
    if (!onOffsetChangeRef.current || roomSize.width <= 0) return;
    const offset = pixelsToOffset(positionRef.current.x, positionRef.current.y, roomSize.width, roomSize.height, petSize);
    onOffsetChangeRef.current(snapToGrid ? { x: Math.round(offset.x * 10) / 10, y: Math.round(offset.y * 10) / 10 } : offset);
  }, [petSize, roomSize.height, roomSize.width, snapToGrid]);

  const hasTap = Boolean(onPetTap);
  // Native menu triggers own the touch. Keep editable objects as plain drag
  // targets; their options live in the selected-item controls instead.
  const hasMenu = !allowDrag && Boolean(menuActions?.length);
  const panResponder = useMemo(
    () =>
      // PanResponder stores these event callbacks without invoking them during render.
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onStartShouldSetPanResponder: () => interactive && (allowDrag || hasTap),
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          interactive && allowDrag && Math.hypot(gesture.dx, gesture.dy) > DRAG_THRESHOLD,
        onMoveShouldSetPanResponder: (_, gesture) =>
          interactive && allowDrag && Math.hypot(gesture.dx, gesture.dy) > DRAG_THRESHOLD,
        onPanResponderGrant: () => {
          gestureMovedRef.current = false;
          dragStartRef.current = { ...positionRef.current };
          dragging.set(true);
        },
        onPanResponderMove: (_, gesture) => {
          if (!allowDrag) return;
          if (!gestureMovedRef.current) {
            if (Math.hypot(gesture.dx, gesture.dy) <= DRAG_THRESHOLD) return;
            gestureMovedRef.current = true;
            onDragStartRef.current?.();
          }
          if (roomSize.width <= 0 || roomSize.height <= 0) return;
          const scale = Math.max(1, dragScale);
          const next = clampPosition(dragStartRef.current.x + gesture.dx / scale, dragStartRef.current.y + gesture.dy / scale,
            roomSize.width, roomSize.height, petSize);
          positionRef.current = next;
          liveX.set(next.x); liveY.set(next.y);
          onPositionChangeRef.current?.(next);
          onDragPositionChangeRef.current?.(next);
        },
        onPanResponderRelease: () => {
          dragging.set(false);
          if (!gestureMovedRef.current) {
            onPetTapRef.current?.();
            return;
          }
          setPosition(positionRef.current);
          commitOffset();
        },
        onPanResponderTerminate: () => {
          dragging.set(false);
          if (gestureMovedRef.current) {
            setPosition(positionRef.current);
            commitOffset();
          }
        },
      }),
    [allowDrag, dragScale, hasTap, interactive, commitOffset, petSize, roomSize.height, roomSize.width, dragging, liveX, liveY],
  );

  const halfPet = petSize / 2;
  const left =
    roomSize.width > 0 ? roomSize.width / 2 - halfPet : 0;
  const top =
    roomSize.height > 0 ? roomSize.height / 2 - halfPet : 0;

  const livePositionStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: animatedPosition && !dragging.get() ? animatedPosition.x.get() : externalPosition && !dragging.get() ? externalPosition.x : liveX.get() },
      { translateY: animatedPosition && !dragging.get() ? animatedPosition.y.get() : externalPosition && !dragging.get() ? externalPosition.y : liveY.get() },
    ],
  }));
  const depthStyle = useAnimatedStyle(() => ({
    zIndex: (depthAnchor === undefined && depthY === undefined) || layerZIndex >= ROOM_MENU_OPEN_Z_INDEX ? layerZIndex
      : getRoomDepthZIndex(depthY?.get() ?? ((animatedPosition && !dragging.get() ? animatedPosition.y.get() : externalPosition && !dragging.get() ? externalPosition.y : liveY.get())
          + petSize * (depthAnchor ?? 0) * (depthScale?.get() ?? 1)), layerZIndex),
  }));

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.layer, depthStyle]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setRoomSize({ width, height });
        syncPosition(width, height, petSize, resolvedOffset);
      }}
    >
      <Animated.View
        style={[
          styles.petSlot,
          {
            left,
            top,
            width: petSize,
            height: petSize,
          },
          livePositionStyle,
          selected && { borderWidth: 2, borderColor: "#23766F", borderRadius: 12 },
        ]}
        collapsable={false}
        pointerEvents="box-none"
      >
        <View pointerEvents="none" style={styles.visualSlot}>
          {children}
        </View>
        <View
          style={[
            styles.hitTarget,
            {
              width: resolvedHitSize,
              height: resolvedHitSize,
              left: hitInset,
              top: hitInset,
            },
          ]}
          testID={testID}
          accessible={interactive && !hasMenu && Boolean(accessibilityLabel)}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          accessibilityActions={[
            { name: "activate" },
            ...(allowDrag ? ["moveLeft", "moveRight", "moveUp", "moveDown"].map(name => ({ name, label: t(`home.nudge${name.replace("move", "").toLowerCase()}`) })) : []),
          ]}
          onAccessibilityTap={() => { onPetTapRef.current?.(); }}
          onAccessibilityAction={event => {
            const action = event.nativeEvent.actionName;
            if (action === "activate") { onPetTapRef.current?.(); return; }
            if (!allowDrag) return;
            const next = clampPosition(positionRef.current.x + (action === "moveLeft" ? -12 : action === "moveRight" ? 12 : 0),
              positionRef.current.y + (action === "moveUp" ? -12 : action === "moveDown" ? 12 : 0), roomSize.width, roomSize.height, petSize);
            positionRef.current = next; setPosition(next); commitOffset();
          }}
          collapsable={false}
          pointerEvents={interactive ? "auto" : "none"}
          {...panResponder.panHandlers}
        >
          {hasMenu && menuActions ? (
            <RoomActionMenu actions={menuActions} label={accessibilityLabel ?? ""}
              size={{ width: resolvedHitSize, height: resolvedHitSize }}>
              <View style={{ width: resolvedHitSize, height: resolvedHitSize }}
                {...panResponder.panHandlers} />
            </RoomActionMenu>
          ) : null}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
  },
  petSlot: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  visualSlot: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  hitTarget: {
    position: "absolute",
  },
});
