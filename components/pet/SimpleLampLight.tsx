import { Canvas, Circle, Group, RadialGradient, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { isWallSpotlightDecorationId } from '@/constants/decoration-motion';
import { lampLightConfig } from '@/utils/native-lamp-light';
import { FLOOR_Y, projectWorld, ROOM_SPAN, type NativeRoomWorld } from '@/utils/native-room-world';

/** A small floor glow for the static sprite renderer. Native rooms use actual lights. */
export function SimpleLampLight({ world }: { world: NativeRoomWorld }) {
  const clip = useMemo(() => {
    const path = Skia.Path.Make();
    for (const [index, [x, z]] of [[-2.4, -2.4], [2.4, -2.4], [2.4, 2.4], [-2.4, 2.4]].entries()) {
      const point = projectWorld([x, FLOOR_Y, z], world.width);
      const sx = point.x + world.width / 2, sy = point.y + world.height / 2;
      if (index === 0) path.moveTo(sx, sy);
      else path.lineTo(sx, sy);
    }
    path.close();
    return path;
  }, [world.width, world.height]);
  return <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Group clip={clip}>
      {world.objects.map(object => {
        const light = lampLightConfig(object);
        if (!light) return null;
        const wall = isWallSpotlightDecorationId(object.modelId);
        if (wall && (object.spotlightAngle ?? -25) > 0) return null;
        const distance = (light.position[1] - FLOOR_Y) / Math.max(.1, -light.direction[1]);
        const point = projectWorld([light.position[0] + light.direction[0] * distance, FLOOR_Y,
          light.position[2] + light.direction[2] * distance], world.width);
        const center = { x: point.x + world.width / 2, y: point.y + world.height / 2 };
        // Native cone width includes a culling workaround; retain the small sprite glow.
        const radius = (light.position[1] - FLOOR_Y) * Math.tan(Math.min(.85, light.spotLightCone[1])) * world.width / ROOM_SPAN;
        return <Group key={object.instanceId} origin={center} transform={[{ scaleY: .45 }]}>
          <Circle c={center} r={radius}>
            <RadialGradient c={center} r={radius} colors={['rgba(255,221,133,.55)', 'rgba(255,231,163,.20)', 'rgba(255,231,163,0)']} positions={[0, .6, 1]}/>
          </Circle>
        </Group>;
      })}
    </Group>
  </Canvas>;
}
