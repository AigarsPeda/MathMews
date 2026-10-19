import { BOSS_SCENE_ASSETS } from "@/constants/boss-scene-assets";
import { useAnimationActivity } from "@/hooks/use-animation-activity";
import type { BossStory } from "@/types/curriculum";
import type { AppLocale } from "@/types/locale";
import { advanceBossOutcome } from "@/utils/boss-story";
import { moderateScale } from "@/utils/scale";
import { Canvas, Group, Image as SkiaImage, useImage } from "@shopify/react-native-skia";
import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { runOnJS, useDerivedValue, useFrameCallback, useSharedValue, type FrameInfo } from "react-native-reanimated";

type Props = { story: BossStory; locale: AppLocale; completed: number; outcome?: boolean; reaction?: boolean; active?: boolean };

function ScenePlayback({ source, stillSource, frameCount, width, active, label, hint, ending }: {
  source: number; stillSource: number; frameCount: number; width: number; active: boolean; label: string; hint?: string; ending: boolean;
}) {
  const { t } = useTranslation();
  const { active: foreground, reduceMotion } = useAnimationActivity();
  const image = useImage(reduceMotion ? null : source);
  const [finished, setFinished] = useState(false);
  const elapsed = useSharedValue(0);
  const frame = useSharedValue(0);
  const done = useSharedValue(false);
  const advance = useCallback((info: FrameInfo) => {
    "worklet";
    if (done.get()) return;
    const next = advanceBossOutcome(elapsed.get(), info.timeSincePreviousFrame ?? 0, frameCount);
    elapsed.set(next.elapsed); frame.set(next.frame);
    if (next.finished) { done.set(true); runOnJS(setFinished)(true); }
  }, [done, elapsed, frame, frameCount]);
  const clock = useFrameCallback(advance, false);
  useEffect(() => {
    clock.setActive(active && foreground && !reduceMotion && !!image && !finished);
    return () => clock.setActive(false);
  }, [active, clock, finished, foreground, image, reduceMotion]);
  const height = width / 1.6;
  const x = useDerivedValue(() => -(frame.get() % 4) * width);
  const y = useDerivedValue(() => -Math.floor(frame.get() / 4) * height);
  const still = reduceMotion || !image || finished;
  return <>
    <View accessible accessibilityRole="image" accessibilityLabel={label} accessibilityHint={hint}
      accessibilityValue={{ text: t(finished || reduceMotion ? ending ? "bossStory.missionReady" : "bossStory.catReady" : "bossStory.catReacting") }} style={{ width, height }}>
      {still ? <Image source={stillSource} style={StyleSheet.absoluteFill} contentFit="contain" /> : null}
      {!still ? <Canvas style={StyleSheet.absoluteFill}>
        <Group clip={{ x: 0, y: 0, width, height }}>
          <SkiaImage image={image} x={x} y={y} width={width * 4} height={height * (frameCount / 4)} fit="fill" />
        </Group>
      </Canvas> : null}
    </View>
    {ending ? <View style={{ height: 44 }}>{finished && !reduceMotion ? <Pressable accessibilityRole="button" style={styles.replay} onPress={() => {
      elapsed.set(0); frame.set(0); done.set(false); setFinished(false);
    }}><Text style={styles.replayText}>{t("bossStory.replay")}</Text></Pressable> : null}</View> : null}
  </>;
}

/** Four Blender checkpoints, short cat reactions and a two-second mission outcome. */
export function BossStoryScene({ story, locale, completed, outcome = false, reaction = false, active = true }: Props) {
  const { t } = useTranslation();
  const { reduceMotion } = useAnimationActivity();
  const [width, setWidth] = useState(0);
  const assets = BOSS_SCENE_ASSETS[story.sceneId];
  const stage = Math.max(0, Math.min(3, Math.floor(completed)));
  if (!assets) return null;
  return <View style={styles.wrap} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <View style={styles.picture}>
      {(outcome || reaction && stage > 0) && width > 0 ? <ScenePlayback key={`${story.sceneId}-${stage}`}
        source={stage === 3 ? assets.outcome : assets.reactions[stage - 1]} stillSource={assets.states[stage]} frameCount={stage === 3 ? 16 : 8}
        width={width} active={active} label={stage === 3 ? story.outcome[locale] : t("bossStory.scene", { count: stage, total: 3 })}
        hint={story.catActions?.[stage]?.[locale]} ending={stage === 3} />
        : <View accessible accessibilityRole="image" accessibilityLabel={t("bossStory.scene", { count: stage, total: 3 })} accessibilityHint={story.catActions?.[stage]?.[locale]}>
          <Image source={assets.states[stage]} style={{ width: "100%", aspectRatio: 1.6 }}
            transition={reduceMotion ? 0 : 180} contentFit="contain" />
        </View>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  picture: { width: "100%" },
  replay: { alignSelf: "center", minHeight: 44, justifyContent: "center", paddingHorizontal: 16 },
  replayText: { color: "#634297", fontSize: moderateScale(15), fontWeight: "700" },
});
