import { ACHIEVEMENT_MEDIA } from "@/constants/achievement-media";
import { GameColors } from "@/constants/game";
import { useAnimationActivity } from "@/hooks/use-animation-activity";
import { reportAppError } from "@/lib/app-diagnostics";
import { moderateScale } from "@/utils/scale";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

/** The same framed story plays here and in the shared GIF. Only the open reward animates. */
export function AchievementMovie({ sceneId, label, active }: { sceneId: string; label: string; active: boolean }) {
  const { t } = useTranslation();
  const { active: foreground, reduceMotion } = useAnimationActivity();
  const image = useRef<Image>(null);
  const [paused, setPaused] = useState(false), [replay, setReplay] = useState(0);
  const media = ACHIEVEMENT_MEDIA[sceneId];
  const playing = active && foreground && !reduceMotion && !paused;
  useEffect(() => {
    const action = playing ? image.current?.startAnimating() : image.current?.stopAnimating();
    void action?.catch(error => reportAppError("achievement-playback", error));
  }, [playing, replay]);
  return <View>
    <Image key={replay} ref={image} source={reduceMotion ? media.poster : media.gif} autoplay={playing}
      onLoad={() => { if (!playing) void image.current?.stopAnimating().catch(error => reportAppError("achievement-playback", error)); }}
      accessible accessibilityRole="image" accessibilityLabel={label} contentFit="contain" style={styles.movie} />
    {!reduceMotion ? <View style={styles.controls}>
      <Pressable accessibilityRole="button" onPress={() => setPaused(value => !value)} style={styles.control}>
        <Text style={styles.controlText}>{t(paused ? "achievements.resume" : "achievements.pause")}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => { setPaused(false); setReplay(value => value + 1); }} style={styles.control}>
        <Text style={styles.controlText}>{t("bossStory.replay")}</Text>
      </Pressable>
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({
  movie: { width: "100%", aspectRatio: 512 / 448 },
  controls: { flexDirection: "row", justifyContent: "center", flexWrap: "wrap", gap: 8 },
  control: { minHeight: 48, justifyContent: "center", paddingHorizontal: 12 },
  controlText: { fontSize: moderateScale(14), fontWeight: "700", color: GameColors.secondaryDark },
});
