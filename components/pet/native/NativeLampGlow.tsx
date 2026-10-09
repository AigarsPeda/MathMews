import { useMemo } from 'react';
import { useFilamentContext, useWorkletEffect, type FilamentAsset, type Float4 } from 'react-native-filament';
import glowParts from '@/constants/lamp-glow-parts.json';

const parts: Record<string, { node: string; emission: number[] }[]> = glowParts;

/** Shade emission identifies the same source as the lamp's downward light. */
export function NativeLampGlow({ asset, modelId, poweredOn }: {
  asset: FilamentAsset; modelId: string; poweredOn: boolean;
}) {
  const { renderableManager, nameComponentManager } = useFilamentContext();
  const materials = useMemo(() => asset.getRenderableEntities().flatMap(entity => {
    const name = nameComponentManager.getEntityName(entity) ?? '';
    const part = parts[modelId]?.find(part => name === part.node || name.startsWith(part.node + '.'));
    return part ? Array.from({ length: renderableManager.getPrimitiveCount(entity) }, (_, index) => ({
      material: renderableManager.getMaterialInstanceAt(entity, index), emission: part.emission as Float4,
    })) : [];
  }), [asset, modelId, renderableManager, nameComponentManager]);
  useWorkletEffect(() => {
    'worklet';
    for (const { material, emission } of materials) {
      material.setFloat4Parameter('emissiveFactor', poweredOn ? emission : [0, 0, 0, 1]);
    }
  });
  return null;
}
