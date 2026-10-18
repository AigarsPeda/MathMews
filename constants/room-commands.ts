import { itemInteraction } from '@/constants/item-interactions';
import { isSleepingBed } from '@/constants/bedroom-activities';
import type { AppIconName } from "@/constants/app-icons";
import { bathroomFixtureKind } from "@/constants/bathroom-activities";
import { isCatFeederDecorationId } from "@/constants/cat-supplies-decorations";
import { isPlayablePlant } from "@/constants/plant-play";
import { isCatSeatDecorationId } from "@/constants/sofa-decorations";
import { isKitchenChairDecorationId, isKitchenIslandDecorationId } from "@/constants/kitchen-activities";
import { isWindowDecorationId } from "@/constants/window-decorations";
import { isFridgeDecorationId } from "@/constants/decoration-motion";
import type { RoomLayerItem } from "@/types/game";

/** Register an interaction here once for both the cat and furnishing menus. */
export const ROOM_COMMANDS = [
  { kind: "bedSleep", target: "sleepingBed", icon: "sleep", section: "essentials" },
  { kind: "bedSnuggle", target: "sleepingBed", icon: "sleep", section: "essentials" },
  { kind: "bowlEat", target: "bowl", icon: "feed", section: "essentials" },
  { kind: "sofaSit", target: "seat", icon: "sofa", section: "essentials" },
  { kind: "sofaSleep", target: "seat", icon: "sleep", section: "essentials" },
  { kind: "chairNap", target: "kitchenChair", icon: "sleep", section: "essentials" },
  { kind: "islandSit", target: "island", icon: "sofa", section: "essentials" },
  { kind: "windowWatch", target: "window", icon: "paw", section: "play" },
  { kind: "fridgeInvestigate", target: "fridge", icon: "paw", section: "play" },
  { kind: "bathWash", target: "bath", icon: "play", section: "essentials" },
  { kind: "showerWash", target: "shower", icon: "play", section: "essentials" },
  { kind: "toiletUse", target: "toilet", icon: "play", section: "essentials" },
  { kind: "toyPlay", target: "toy", icon: "play", section: "play" },
  { kind: "mouseChase", target: "mouse", icon: "mouse", section: "play" },
  { kind: "cupboardHide", target: "cupboard", icon: "box", section: "play" },
  { kind: "drawerHide", target: "drawer", icon: "box", section: "play" },
  { kind: "investigate", target: "decoration", icon: "paw", section: "play" },
  { kind: "plantPlay", target: "plant", icon: "play", section: "play" },
] as const satisfies readonly { kind: string; target: string; icon: AppIconName; section: string }[];

export type RoomCommandKind = typeof ROOM_COMMANDS[number]["kind"];

/** Menu eligibility must not build animation plans or solve navigation paths. */
export function getRoomCommands(item: RoomLayerItem, bedId?: string) {
  const commands = ROOM_COMMANDS.filter(command => {
    if (item.kind === "bed") return command.target === "sleepingBed" && isSleepingBed(`bed-${bedId}`);
    if (item.kind === "toy") return command.target === (item.toyId === "mouse" ? "mouse" : "toy");
    const id = item.decorationId;
    switch (command.target) {
      case 'cupboard': return itemInteraction(id)?.cat === 'cupboardHide';
      case 'drawer': return ['drawers', 'drawer'].includes(itemInteraction(id)?.open ?? '');
      case "sleepingBed": return isSleepingBed(id);
      case "seat": return isCatSeatDecorationId(id);
      case "kitchenChair": return isKitchenChairDecorationId(id);
      case "island": return isKitchenIslandDecorationId(id);
      case "window": return isWindowDecorationId(id);
      case "fridge": return isFridgeDecorationId(id);
      case "bowl": return isCatFeederDecorationId(id);
      case "plant": return isPlayablePlant(id);
      case "toy": return id.startsWith("catTree") || id === "yarnRed" || id === "yarnBlue";
      case "bath": case "shower": case "toilet": return bathroomFixtureKind(id) === command.target;
      default: return false;
    }
  });
  return commands.length || item.kind !== 'decoration' ? commands
    : ROOM_COMMANDS.filter(command => command.kind === 'investigate');
}
