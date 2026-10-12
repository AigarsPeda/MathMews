import bowlSpill from '@/assets/3d/native/bowl-food-spill.glb';
import tileSplash from '@/assets/3d/native/feedingTile-eating-effect.glb';
import pebbleCrumbs from '@/assets/3d/native/feedingPebble-eating-effect.glb';
import trayCrumbs from '@/assets/3d/native/foodTrailTray-eating-effect.glb';
import dispenserKibble from '@/assets/3d/native/kibbleDispenser-eating-effect.glb';
import padSmear from '@/assets/3d/native/lickingPad-eating-effect.glb';

const FEEDING_EFFECT_SOURCES: Record<string, number> = {
  feedingTile: tileSplash,
  feedingPebble: pebbleCrumbs,
  foodTrailTray: trayCrumbs,
  kibbleDispenser: dispenserKibble,
  lickingPad: padSmear,
};

export function getFeedingEffectSource(modelId: string): number {
  return FEEDING_EFFECT_SOURCES[modelId] ?? bowlSpill;
}
