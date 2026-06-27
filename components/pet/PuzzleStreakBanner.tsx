import { NotificationBanner } from "@/components/ui/NotificationBanner";
import { useTranslation } from "react-i18next";

type PuzzleStreakBannerProps = {
  count: number;
};

export function PuzzleStreakBanner({ count }: PuzzleStreakBannerProps) {
  const { t } = useTranslation();

  return (
    <NotificationBanner
      emoji="🔥"
      message={t("home.puzzleStreak", { count })}
    />
  );
}
