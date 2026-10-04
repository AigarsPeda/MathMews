import { GameColors } from "@/constants/game";
import { useStartupVisualReady } from "@/contexts/StartupVisualContext";
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
import { Image, Pressable, StyleSheet, View } from "react-native";
import { useAnimatedReaction, useDerivedValue, useSharedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useAtlasPages } from "./use-atlas-pages";
import { useSpriteClock } from "./use-sprite-clock";
import { EMPTY_PLAY_PROP, type RoomPlayPropFrame } from "./room-play-prop";

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
  roomPlayProp?: SharedValue<RoomPlayPropFrame>;
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
const NO_PROP_PAGES: readonly number[] = [];
function SpriteStep({ segment, loop, onStepDone, onTextureFailure, drawn, playProp }: {
  segment: PetMediaSegment; loop: boolean; onStepDone: () => void; onTextureFailure: () => void; drawn: SharedValue<DrawnFrame>; playProp: SharedValue<RoomPlayPropFrame>;
}) {
  const sprite = segment.sprite!;
  const sources = useMemo(() => sprite.pages ?? [sprite.source], [sprite]);
  const cellsPerPage = sprite.framesPerPage ?? sprite.frames.length;
  const reverse = sprite.reverse === true;
  const shouldLoop = loop || segment.loop === true;
  const [page, setPage] = useState(reverse ? sources.length - 1 : 0);
  const recoveryDone = useRef(false);
  const decoded = useAtlasPages(sources, page, reverse, shouldLoop, () => {
    if (!recoveryDone.current) { recoveryDone.current = true; onTextureFailure(); onStepDone(); }
  });
  const [propPage, setPropPage] = useState(reverse ? Math.floor((sprite.frames.length - 1) / 12) : 0);
  const [propFailed, setPropFailed] = useState(false);
  const propPages = useAtlasPages(sprite.playProp?.pages ?? NO_PROP_PAGES, propPage, reverse, shouldLoop, () => setPropFailed(true));
  const readyPages = decoded.filter(entry => !sprite.playProp || propFailed
    || propPages.some(prop => prop.page === Math.floor(entry.page * cellsPerPage / 12))).map(entry => entry.page);
  const frameIndex = useSpriteClock({ frameCount: sprite.frames.length, fps: sprite.fps,
    loop: shouldLoop, reverse, framesPerPage: cellsPerPage, readyPages, onComplete: onStepDone });
  useAnimatedReaction(() => Math.floor(frameIndex.get() / cellsPerPage), (next, previous) => {
    if (next !== previous) scheduleOnRN(setPage, next);
  });
  useAnimatedReaction(() => Math.floor(frameIndex.get() / 12), (next, previous) => {
    if (next !== previous && sprite.playProp) scheduleOnRN(setPropPage, next);
  });
  useAnimatedReaction(() => {
    const index = frameIndex.get();
    const image = decoded.find(entry => entry.page === Math.floor(index / cellsPerPage))?.image;
    if (!image) return null;
    const coord = sprite.frames[index] ?? sprite.frames[0];
    const propImage = propPages.find(entry => entry.page === Math.floor(index / 12))?.image;
    if (sprite.playProp && !propImage && !propFailed) return null;
    return { cat: { image, col: coord.col, row: coord.row,
      columns: sprite.sheetWidth / sprite.frameWidth, rows: sprite.sheetHeight / sprite.frameHeight },
      prop: sprite.playProp && propImage ? { image: propImage, col: index % 4, row: Math.floor(index % 12 / 4), groundY: sprite.playProp.groundY[index] } : EMPTY_PLAY_PROP };
  }, next => {
    if (next) { drawn.set(next.cat); playProp.set(next.prop); }
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
  roomPlayProp,
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

  const [showFallback, setShowFallback] = useState(false);
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  useStartupVisualReady(firstFrameReady);
  const active = steps[stepIndex];
  const drawn = useSharedValue<DrawnFrame>({ image: null, col: 0, row: 0, columns: 1, rows: 1 });
  const localPlayProp = useSharedValue<RoomPlayPropFrame>(EMPTY_PLAY_PROP);
  const playProp = roomPlayProp ?? localPlayProp;
  const layout = active?.sprite ? layoutFrame(active.sprite, 0, size) : null;
  const cellW = (layout?.frameWidth ?? size) * resolutionScale;
  const cellH = (layout?.frameHeight ?? size) * resolutionScale;
  useAnimatedReaction(() => Boolean(drawn.get().image), (ready, previous) => {
    if (ready && !previous) {
      scheduleOnRN(setShowFallback, false);
      scheduleOnRN(setFirstFrameReady, true);
    }
  });
  const image = useDerivedValue(() => drawn.get().image);
  const imageX = useDerivedValue(() => -drawn.get().col * cellW);
  const imageY = useDerivedValue(() => -drawn.get().row * cellH);
  const sheetWidth = useDerivedValue(() => drawn.get().columns * cellW);
  const sheetHeight = useDerivedValue(() => drawn.get().rows * cellH);
  const propImage = useDerivedValue(() => playProp.get().image);
  const propX = useDerivedValue(() => -playProp.get().col * cellW);
  const propY = useDerivedValue(() => -playProp.get().row * cellH);

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
          onStepDone={finishStep} onTextureFailure={() => { playProp.set(EMPTY_PLAY_PROP); if (!drawn.get().image) setShowFallback(true); }} drawn={drawn} playProp={playProp} />
      ) : null}
      {showFallback ? <Image source={require("@/assets/3d/cat-preview.png")} style={{ position: "absolute", width: size, height: size }} resizeMode="contain"
        onLoad={() => setFirstFrameReady(true)} onError={() => setFirstFrameReady(true)} /> : null}
      <View style={[styles.frameWindow, { width: containerSize, height: containerSize,
        justifyContent: layout?.anchor === "center" ? "center" : "flex-end" }]}>
        <View style={{ width: layout?.frameWidth ?? size, height: layout?.frameHeight ?? size }}>
          <Canvas style={{ width: cellW, height: cellH, transformOrigin: "top left", transform: [{ scale: 1 / resolutionScale }] }}>
            <Group clip={{ x: 0, y: 0, width: cellW, height: cellH }}>
              <SkiaImage image={image} x={imageX} y={imageY} width={sheetWidth} height={sheetHeight}
                fit="fill" sampling={SMOOTH_SAMPLING} />
              {!roomPlayProp ? <SkiaImage image={propImage} x={propX} y={propY} width={cellW * 4} height={cellH * 3}
                fit="fill" sampling={SMOOTH_SAMPLING} /> : null}
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
