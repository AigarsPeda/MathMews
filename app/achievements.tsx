import { Redirect } from "expo-router";

/** Older bookmarks return to lessons after the rewards collection was retired. */
export default function RetiredAchievementsScreen() {
  return <Redirect href="/puzzles" />;
}
