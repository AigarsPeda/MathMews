import { moderateScale } from "@/utils/scale";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, View } from "react-native";

export type RoomPetOffset = {
  x: number;
  y: number;
};

const DEFAULT_OFFSET: RoomPetOffset = { x: 0, y: 0.12 };
const DRAG_THRESHOLD = moderateScale(6);

type DraggableRoomPetProps = {
  children: ReactNode;
  petSize: number;
  initialOffset?: RoomPetOffset;
  onOffsetChange?: (offset: RoomPetOffset) => void;
  onPetTap?: () => void;
  layerZIndex?: number;
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
  petSize,
  initialOffset = DEFAULT_OFFSET,
  onOffsetChange,
  onPetTap,
  layerZIndex = 1,
}: DraggableRoomPetProps) {
  const [roomSize, setRoomSize] = useState({ width: 0, height: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const positionRef = useRef(position);
  positionRef.current = position;

  const dragStartRef = useRef({ x: 0, y: 0 });
  const gestureMovedRef = useRef(false);

  const onOffsetChangeRef = useRef(onOffsetChange);
  onOffsetChangeRef.current = onOffsetChange;

  const onPetTapRef = useRef(onPetTap);
  onPetTapRef.current = onPetTap;

  const resolvedOffset = initialOffset ?? DEFAULT_OFFSET;

  const syncPosition = useCallback(
    (width: number, height: number, size: number, offset: RoomPetOffset) => {
      const pixels = offsetToPixels(offset, width, height, size);
      setPosition(pixels);
    },
    [],
  );

  useEffect(() => {
    if (roomSize.width <= 0 || roomSize.height <= 0) return;
    syncPosition(roomSize.width, roomSize.height, petSize, resolvedOffset);
  }, [petSize, resolvedOffset, roomSize, syncPosition]);

  const commitOffset = useCallback(() => {
    if (!onOffsetChangeRef.current || roomSize.width <= 0) return;
    onOffsetChangeRef.current(
      pixelsToOffset(
        positionRef.current.x,
        positionRef.current.y,
        roomSize.width,
        roomSize.height,
        petSize,
      ),
    );
  }, [petSize, roomSize.height, roomSize.width]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.hypot(gesture.dx, gesture.dy) > DRAG_THRESHOLD,
        onPanResponderGrant: () => {
          gestureMovedRef.current = false;
          dragStartRef.current = { ...positionRef.current };
        },
        onPanResponderMove: (_, gesture) => {
          if (Math.hypot(gesture.dx, gesture.dy) > DRAG_THRESHOLD) {
            gestureMovedRef.current = true;
          }
          if (roomSize.width <= 0 || roomSize.height <= 0) return;
          setPosition(
            clampPosition(
              dragStartRef.current.x + gesture.dx,
              dragStartRef.current.y + gesture.dy,
              roomSize.width,
              roomSize.height,
              petSize,
            ),
          );
        },
        onPanResponderRelease: () => {
          if (!gestureMovedRef.current) {
            onPetTapRef.current?.();
            return;
          }
          commitOffset();
        },
        onPanResponderTerminate: () => {
          if (gestureMovedRef.current) {
            commitOffset();
          }
        },
      }),
    [commitOffset, petSize, roomSize.height, roomSize.width],
  );

  const halfPet = petSize / 2;
  const left =
    roomSize.width > 0 ? roomSize.width / 2 - halfPet + position.x : 0;
  const top =
    roomSize.height > 0 ? roomSize.height / 2 - halfPet + position.y : 0;

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
      <View
        style={[
          styles.petSlot,
          {
            left,
            top,
            width: petSize,
            height: petSize,
          },
        ]}
        collapsable={false}
        {...panResponder.panHandlers}
      >
        {children}
      </View>
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
});
