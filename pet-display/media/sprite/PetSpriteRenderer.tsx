import { GameColors } from "@/constants/game";
import type { PetMediaSegment, SpriteSheetConfig } from "@/pet-display/types";
import { moderateScale } from "@/utils/scale";
import {
  Canvas,
  FilterMode,
  Group,
  Image as SkiaImage,
  MipmapMode,
  type SkImage,
} from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useAnimatedReaction, useDerivedValue, useSharedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useAtlasPages } from "./use-atlas-pages";
import { useSpriteClock } from "./use-sprite-clock";

const DEFAULT_SIZE = 200;
const VIEW_PADDING = 0.9;
const SMOOTH_SAMPLING = {
  filter: FilterMode.Linear,
  mipmap: MipmapMode.None,
};

type PetSpriteRendererProps = {
  segment?: PetMediaSegment;
  scenarioSteps?: PetMediaSegment[];
  size?: number;
  resolutionScale?: number;
  loop?: boolean;
  transparentBackground?: boolean;
  onAnimationComplete?: () => void;
  onStepComplete?: (stepIndex: number) => void;
  onPress?: () => void;
};

function segmentToken(steps: PetMediaSegment[]) {
  return steps
    .map(
      (step, index) =>
        `${step.assetKey}:${step.sprite?.source ?? 0}:${step.sprite?.fps ?? 0}:${step.sprite?.reverse ? "reverse" : "forward"}:${step.loop ? "loop" : "once"}:${index}`,
    )
    .join("|");
}

function layoutFrame(
  sprite: SpriteSheetConfig,
  frameIndex: number,
  displaySize: number,
) {
  const coord = sprite.frames[frameIndex] ?? sprite.frames[0];
  const desiredFrameHeight = Math.floor(displaySize * VIEW_PADDING);
  const scale = desiredFrameHeight / sprite.frameHeight;
  const frameWidth = sprite.frameWidth * scale;
  const frameHeight = sprite.frameHeight * scale;
  const sheetWidth = sprite.sheetWidth * scale;
  const sheetHeight = sprite.sheetHeight * scale;

  return {
    coord,
    scale,
    frameWidth,
    frameHeight,
    sheetWidth,
    sheetHeight,
    imageX: -coord.col * sprite.frameWidth * scale,
    imageY: -coord.row * sprite.frameHeight * scale,
    anchor: sprite.anchor ?? "bottom-center",
    containerSize: Math.ceil(frameHeight / VIEW_PADDING),
  };
}

type DrawnFrame = { image: SkImage | null; col: number; row: number; columns: number; rows: number };

// Only the playback controller changes between clips. The drawing surface and
// its last frame survive while the next clip's first texture is being decoded.
function SpriteStep({ segment, loop, onStepDone, drawn }: {
  segment: PetMediaSegment; loop: boolean; onStepDone: () => void; drawn: SharedValue<DrawnFrame>;
}) {
  const sprite = segment.sprite!;
  const sources = useMemo(() => sprite.pages ?? [sprite.source], [sprite]);
  const cellsPerPage = sprite.framesPerPage ?? sprite.frames.length;
  const reverse = sprite.reverse === true;
  const shouldLoop = loop || segment.loop === true;
  const [page, setPage] = useState(reverse ? sources.length - 1 : 0);
  const decoded = useAtlasPages(sources, page, reverse, shouldLoop);
  const readyPages = decoded.map(entry => entry.page);
  const frameIndex = useSpriteClock({ frameCount: sprite.frames.length, fps: sprite.fps,
    loop: shouldLoop, reverse, framesPerPage: cellsPerPage, readyPages, onComplete: onStepDone });
  useAnimatedReaction(() => Math.floor(frameIndex.get() / cellsPerPage), (next, previous) => {
    if (next !== previous) scheduleOnRN(setPage, next);
  });
  useAnimatedReaction(() => {
    const index = frameIndex.get();
    const image = decoded.find(entry => entry.page === Math.floor(index / cellsPerPage))?.image;
    if (!image) return null;
    const coord = sprite.frames[index] ?? sprite.frames[0];
    return { image, col: coord.col, row: coord.row,
      columns: sprite.sheetWidth / sprite.frameWidth, rows: sprite.sheetHeight / sprite.frameHeight };
  }, next => {
    if (next) drawn.set(next);
  });
  return null;
}

export function PetSpriteRenderer({
  segment,
  scenarioSteps,
  size = moderateScale(DEFAULT_SIZE),
  resolutionScale = 1,
  loop = false,
  transparentBackground = false,
  onAnimationComplete,
  onStepComplete,
  onPress,
}: PetSpriteRendererProps) {
  const steps = useMemo(() => scenarioSteps ?? (segment ? [segment] : []), [scenarioSteps, segment]);
  const [stepIndex, setStepIndex] = useState(0);
  const token = segmentToken(steps);
  const [previousToken, setPreviousToken] = useState(token);
  if (previousToken !== token) {
    setPreviousToken(token);
    setStepIndex(0);
  }
  const onCompleteRef = useRef(onAnimationComplete);
  const onStepRef = useRef(onStepComplete);

  useEffect(() => {
    onCompleteRef.current = onAnimationComplete;
  }, [onAnimationComplete]);

  useEffect(() => {
    onStepRef.current = onStepComplete;
  }, [onStepComplete]);

  const active = steps[stepIndex];
  const drawn = useSharedValue<DrawnFrame>({ image: null, col: 0, row: 0, columns: 1, rows: 1 });
  const layout = active?.sprite ? layoutFrame(active.sprite, 0, size) : null;
  const cellW = (layout?.frameWidth ?? size) * resolutionScale;
  const cellH = (layout?.frameHeight ?? size) * resolutionScale;
  const image = useDerivedValue(() => drawn.get().image);
  const imageX = useDerivedValue(() => -drawn.get().col * cellW);
  const imageY = useDerivedValue(() => -drawn.get().row * cellH);
  const sheetWidth = useDerivedValue(() => drawn.get().columns * cellW);
  const sheetHeight = useDerivedValue(() => drawn.get().rows * cellH);

  const finishStep = useCallback(() => {
    onStepRef.current?.(stepIndex);
    const next = stepIndex + 1;
    if (next < steps.length) {
      setStepIndex(next);
      return;
    }
    onCompleteRef.current?.();
  }, [stepIndex, steps.length]);


  const containerSize = active?.sprite
    ? layoutFrame(active.sprite, 0, size).containerSize : size;

  const content = (
    <View
      style={[
        styles.container,
        transparentBackground && styles.containerTransparent,
        { width: containerSize, height: containerSize },
      ]}
    >
      {active?.sprite ? (
        <SpriteStep key={`${token}:${stepIndex}`} segment={active} loop={loop}
          onStepDone={finishStep} drawn={drawn} />
      ) : null}
      <View style={[styles.frameWindow, { width: containerSize, height: containerSize,
        justifyContent: layout?.anchor === "center" ? "center" : "flex-end" }]}>
        <View style={{ width: layout?.frameWidth ?? size, height: layout?.frameHeight ?? size }}>
          <Canvas style={{ width: cellW, height: cellH, transformOrigin: "top left", transform: [{ scale: 1 / resolutionScale }] }}>
            <Group clip={{ x: 0, y: 0, width: cellW, height: cellH }}>
              <SkiaImage image={image} x={imageX} y={imageY} width={sheetWidth} height={sheetHeight}
                fit="fill" sampling={SMOOTH_SAMPLING} />
            </Group>
          </Canvas>
        </View>
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      style={styles.pressable}
      accessibilityRole="button"
      accessibilityLabel="Pet your companion"
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: GameColors.petVideoBg,
    borderRadius: moderateScale(12),
  },
  containerTransparent: {
    backgroundColor: "transparent",
    borderRadius: 0,
  },
  frameWindow: {
    overflow: "hidden",
    position: "relative",
    alignItems: "center",
  },
});
