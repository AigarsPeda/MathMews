import { useFilamentContext, useWorkletEffect, type FilamentAsset } from 'react-native-filament';

/** Configure once per loaded asset; movement and animation reuse its shadow geometry. */
export function useModelShadows(asset: FilamentAsset | undefined) {
  const { lightManager, renderableManager } = useFilamentContext();
  // Older native binaries retain contact shadows until the next native rebuild.
  const supported = lightManager.shadowMapsSupported === true;
  useWorkletEffect(() => {
    'worklet';
    if (!asset || !supported) return;
    for (const entity of asset.getRenderableEntities()) {
      // The native binding excludes transparent glass and unlit effects.
      renderableManager.setCastShadow(entity, true);
      renderableManager.setReceiveShadow(entity, true);
    }
  });
}
