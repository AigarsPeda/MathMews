import { PuzzleStreakBanner } from "@/components/pet/PuzzleStreakBanner";
import { SlideInNotificationSlot } from "@/components/ui/SlideInNotificationSlot";

type PuzzleStreakSlotProps = {
  visible: boolean;
  count: number;
};

export function PuzzleStreakSlot({ visible, count }: PuzzleStreakSlotProps) {
  return (
    <SlideInNotificationSlot visible={visible}>
      <PuzzleStreakBanner count={count} />
    </SlideInNotificationSlot>
  );
}
