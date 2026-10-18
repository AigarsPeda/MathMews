import profiles from '@/data/item-interactions.json';

export type ItemInteraction = {
  open?: 'window' | 'doors' | 'drawers' | 'drawer' | 'panel' | 'oven' | 'microwave' | 'lid' | 'laptop' | 'door' | 'screen';
  initiallyOpen?: boolean;
  power?: 'screen' | 'console' | 'fan' | 'machine' | 'mixer' | 'heat' | 'fire' | 'water';
  cat: 'investigate';
};
export function itemInteraction(id: string): ItemInteraction | undefined {
  return (profiles as Record<string, ItemInteraction>)[id];
}
export function isOpenableDecorationId(id: string): boolean {
  return Boolean(itemInteraction(id)?.open);
}
export function isDecorationOpen(item: { decorationId: string; opened?: boolean }): boolean {
  return item.opened ?? itemInteraction(item.decorationId)?.initiallyOpen ?? false;
}
