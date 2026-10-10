import { useMemo } from 'react';
import { useFilamentContext, useWorkletEffect, type FilamentAsset } from 'react-native-filament';
import { normalizeSpotlightAngle } from '@/constants/decoration-motion';

/** Only the head pivots; the backplate and support arm remain on the wall. */
export function NativeSpotlightHead({ asset, angle }: { asset: FilamentAsset; angle?: number }) {
  // Compiler-hoisted JS callbacks cannot cross Filament's worklet boundary.
  'use no memo';
  const { transformManager, nameComponentManager } = useFilamentContext();
  const head = useMemo(() => {
    const entity = asset.getEntities().find(entity => nameComponentManager.getEntityName(entity) === 'Spotlight head');
    if (!entity) return undefined;
    const transform = transformManager.getTransform(entity);
    return { entity, transform, pivot: transform.translation };
  }, [asset, transformManager, nameComponentManager]);
  const radians = normalizeSpotlightAngle(angle) * Math.PI / 180;
  useWorkletEffect(() => {
    'worklet';
    if (head) transformManager.setTransform(head.entity, head.transform.translate([-head.pivot[0], -head.pivot[1], -head.pivot[2]])
      .rotate(radians, [1, 0, 0]).translate(head.pivot));
  });
  return null;
}
