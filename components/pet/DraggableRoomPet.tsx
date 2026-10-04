import { useTranslation } from "react-i18next";
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import { moderateScale } from "@/utils/scale";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import type { RoomMenuAnchorRect } from "@/components/pet/room-menu-types";

export type RoomPetOffset = {
  x: number;
  y: number;
};

const DEFAULT_OFFSET: RoomPetOffset = { x: 0, y: 0.12 };
const DRAG_THRESHOLD = moderateScale(6);

type DraggableRoomPetProps = {
  children: ReactNode;
  accessibilityLabel?: string;
  selected?: boolean;
  snapToGrid?: boolean;
  petSize: number;
  allowDrag?: boolean;
  interactive?: boolean;
  animatedPosition?: { x: SharedValue<number>; y: SharedValue<number> };
  /** Tap/drag target — defaults to petSize. Use a smaller value for narrow sprites. */
  hitSize?: number;
  initialOffset?: RoomPetOffset;
  onOffsetChange?: (offset: RoomPetOffset) => void;
  /** Live position in room pixels relative to the room's center. */
  onPositionChange?: (position: { x: number; y: number }) => void;
  onPetTap?: () => void;
  layerZIndex?: number;
  onMenuAnchorLayout?: (rect: RoomMenuAnchorRect) => void;
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
  accessibilityLabel,
  selected = false,
  snapToGrid = false,
  petSize,
  allowDrag = true,
  interactive = true,
  animatedPosition,
  hitSize,
  initialOffset = DEFAULT_OFFSET,
  onOffsetChange,
  onPositionChange,
  onPetTap,
  layerZIndex = 1,
  onMenuAnchorLayout,
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
  const petSlotRef = useRef<View>(null);

  const positionRef = useRef(position);

  const dragStartRef = useRef({ x: 0, y: 0 });
  const gestureMovedRef = useRef(false);

  const onOffsetChangeRef = useRef(onOffsetChange);
  const onPositionChangeRef = useRef(onPositionChange);

  const onPetTapRef = useRef(onPetTap);

  const onMenuAnchorLayoutRef = useRef(onMenuAnchorLayout);
  useLayoutEffect(() => {
    if (!dragging.get()) positionRef.current = position;
    onOffsetChangeRef.current = onOffsetChange;
    onPositionChangeRef.current = onPositionChange;
    onPetTapRef.current = onPetTap;
    onMenuAnchorLayoutRef.current = onMenuAnchorLayout;
  }, [dragging, position, onOffsetChange, onPositionChange, onPetTap, onMenuAnchorLayout]);

  const reportMenuAnchor = useCallback(() => {
    if (!onMenuAnchorLayoutRef.current) return;

    petSlotRef.current?.measureInWindow((pageX, pageY, width, height) => {
      onMenuAnchorLayoutRef.current?.({ pageX, pageY, width, height });
    });
  }, []);

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
  const panResponder = useMemo(
    () =>
      // PanResponder stores these event callbacks without invoking them during render.
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onStartShouldSetPanResponder: () => interactive && (allowDrag || hasTap),
        onMoveShouldSetPanResponder: (_, gesture) =>
          interactive && allowDrag && Math.hypot(gesture.dx, gesture.dy) > DRAG_THRESHOLD,
        onPanResponderGrant: () => {
          gestureMovedRef.current = false;
          dragStartRef.current = { ...positionRef.current };
          dragging.set(true);
        },
        onPanResponderMove: (_, gesture) => {
          if (!allowDrag) return;
          if (Math.hypot(gesture.dx, gesture.dy) > DRAG_THRESHOLD) {
            gestureMovedRef.current = true;
          }
          if (roomSize.width <= 0 || roomSize.height <= 0) return;
          const next = clampPosition(dragStartRef.current.x + gesture.dx, dragStartRef.current.y + gesture.dy,
            roomSize.width, roomSize.height, petSize);
          positionRef.current = next;
          liveX.set(next.x); liveY.set(next.y);
          onPositionChangeRef.current?.(next);
        },
        onPanResponderRelease: () => {
          dragging.set(false);
          if (!gestureMovedRef.current) {
            reportMenuAnchor();
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
    [allowDrag, hasTap, interactive, commitOffset, petSize, reportMenuAnchor, roomSize.height, roomSize.width, dragging, liveX, liveY],
  );

  const halfPet = petSize / 2;
  const left =
    roomSize.width > 0 ? roomSize.width / 2 - halfPet : 0;
  const top =
    roomSize.height > 0 ? roomSize.height / 2 - halfPet : 0;

  useEffect(() => {
    reportMenuAnchor();
  }, [left, top, petSize, reportMenuAnchor]);

  const livePositionStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: animatedPosition && !dragging.get() ? animatedPosition.x.get() : liveX.get() },
      { translateY: animatedPosition && !dragging.get() ? animatedPosition.y.get() : liveY.get() },
    ],
  }));

  return (
    <View
      pointerEvents="box-none"
      style={[styles.layer, { zIndex: layerZIndex }]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setRoomSize({ width, height });
        syncPosition(width, height, petSize, resolvedOffset);
      }}
    >
      <Animated.View
        ref={petSlotRef}
        onLayout={reportMenuAnchor}
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
          accessible={interactive && Boolean(accessibilityLabel)}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          accessibilityActions={[
            { name: "activate" },
            ...(allowDrag ? ["moveLeft", "moveRight", "moveUp", "moveDown"].map(name => ({ name, label: t(`home.nudge${name.replace("move", "").toLowerCase()}`) })) : []),
          ]}
          onAccessibilityTap={() => { reportMenuAnchor(); onPetTapRef.current?.(); }}
          onAccessibilityAction={event => {
            const action = event.nativeEvent.actionName;
            if (action === "activate") { reportMenuAnchor(); onPetTapRef.current?.(); return; }
            if (!allowDrag) return;
            const next = clampPosition(positionRef.current.x + (action === "moveLeft" ? -12 : action === "moveRight" ? 12 : 0),
              positionRef.current.y + (action === "moveUp" ? -12 : action === "moveDown" ? 12 : 0), roomSize.width, roomSize.height, petSize);
            positionRef.current = next; setPosition(next); commitOffset();
          }}
          collapsable={false}
          pointerEvents={interactive ? "auto" : "none"}
          {...panResponder.panHandlers}
        />
      </Animated.View>
    </View>
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
