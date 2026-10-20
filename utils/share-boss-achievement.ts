import { ACHIEVEMENT_MEDIA } from "@/constants/achievement-media";
import { getShareableBossAchievement } from "@/utils/boss-achievements";
import { Asset } from "expo-asset";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

/** Exports only the earned Blender animation. No player data or game writes. */
export async function shareBossAchievement(id: string, completedPuzzleIds: readonly string[], title: string) {
  const achievement = getShareableBossAchievement(id, completedPuzzleIds);
  if (!achievement) return "locked";
  if (Platform.OS === "web" || !await Sharing.isAvailableAsync()) return "unavailable";
  const media = ACHIEVEMENT_MEDIA[achievement.level.story!.sceneId];
  if (!media) throw new Error("Missing achievement animation");
  const asset = await Asset.fromModule(media.gif).downloadAsync();
  if (!asset.localUri?.startsWith("file://")) throw new Error("Animation is not available locally");
  const directory = new Directory(Paths.cache, "achievement-shares", achievement.id);
  directory.create({ idempotent: true, intermediates: true });
  const file = new File(directory, `${title.replace(/[\\/:]/g, "-").slice(0, 80)}.gif`);
  if (file.exists) file.delete();
  new File(asset.localUri).copy(file);
  await Sharing.shareAsync(file.uri, { mimeType: "image/gif", UTI: "com.compuserve.gif", dialogTitle: title });
  return "closed";
}
