import type { NativeMenuAction } from "./NativeActionMenu.types";

export function groupMenuSections(actions: NativeMenuAction[]) {
  const sections: { id?: string; actions: NativeMenuAction[] }[] = [];
  for (const action of actions) {
    const current = sections[sections.length - 1];
    if (current && current.id === action.section) current.actions.push(action);
    else sections.push({ id: action.section, actions: [action] });
  }
  return sections;
}
