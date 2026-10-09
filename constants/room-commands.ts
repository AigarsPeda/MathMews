import type { AppIconName } from "@/constants/app-icons";
import { bathroomFixtureKind } from "@/constants/bathroom-activities";
import { isFoodBowlDecorationId } from "@/constants/cat-supplies-decorations";
import { isPlayablePlant } from "@/constants/plant-play";
import { isCatSeatDecorationId } from "@/constants/sofa-decorations";
import type { RoomLayerItem } from "@/types/game";

/** Register an interaction here once for both the cat and furnishing menus. */
export const ROOM_COMMANDS = [
  { kind: "bowlEat", target: "bowl", icon: "feed", section: "essentials" },
  { kind: "sofaSit", target: "seat", icon: "sofa", section: "essentials" },
  { kind: "sofaSleep", target: "seat", icon: "sleep", section: "essentials" },
  { kind: "bathWash", target: "bath", icon: "play", section: "essentials" },
  { kind: "showerWash", target: "shower", icon: "play", section: "essentials" },
  { kind: "toiletUse", target: "toilet", icon: "play", section: "essentials" },
  { kind: "toyPlay", target: "toy", icon: "play", section: "play" },
  { kind: "mouseChase", target: "mouse", icon: "mouse", section: "play" },
  { kind: "plantPlay", target: "plant", icon: "play", section: "play" },
] as const satisfies readonly { kind: string; target: string; icon: AppIconName; section: string }[];

export type RoomCommandKind = typeof ROOM_COMMANDS[number]["kind"];

/** Menu eligibility must not build animation plans or solve navigation paths. */
export function getRoomCommands(item: RoomLayerItem) {
  return ROOM_COMMANDS.filter(command => {
    if (item.kind === "bed") return false;
    if (item.kind === "toy") return command.target === (item.toyId === "mouse" ? "mouse" : "toy");
    const id = item.decorationId;
    switch (command.target) {
      case "seat": return isCatSeatDecorationId(id);
      case "bowl": return isFoodBowlDecorationId(id);
      case "plant": return isPlayablePlant(id);
      case "toy": return id.startsWith("catTree") || id === "yarnRed" || id === "yarnBlue";
      case "bath": case "shower": case "toilet": return bathroomFixtureKind(id) === command.target;
      default: return false;
    }
  });
}
