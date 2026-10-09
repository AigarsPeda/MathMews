import { BlendColor, Canvas, Image, useImage } from '@shopify/react-native-skia';
import { getCatRoomSource } from '@/constants/cat-rooms';
import { useWorldClockNow } from '@/hooks/use-world-clock-now';
import { worldDaylight, type WorldClock } from '@/utils/world-clock';

export function WorldRoomTint({ clock, roomId, size, top }: { clock: WorldClock; roomId?: string; size: number; top: number }) {
  const now = useWorldClockNow(5000);
  const image = useImage(getCatRoomSource(roomId));
  const daylight = worldDaylight(clock, Math.max(now, clock.realMs));
  return <Canvas pointerEvents="none" style={{ position: 'absolute', width: size, height: size, top, opacity: (1 - daylight) * .48 }}>
    {image && <Image image={image} x={0} y={0} width={size} height={size} fit="contain">
      <BlendColor color="#183057" mode="srcIn"/>
    </Image>}
  </Canvas>;
}
