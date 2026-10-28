import { roomDragDelta, type RoomDragBase, type RoomDragMotion } from '@/utils/room-drag-motion';
import Animated, { useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { moderateScale } from '@/utils/scale';
import { GameColors } from '@/constants/game';
import { ROOM_MENU_OPEN_Z_INDEX } from '@/utils/room-layer-order';
import { WALL_MOUNT_PLANE, WALL_PLACEMENT_MIN, WALL_PLACEMENT_MAX, WALL_PLACEMENT_BOTTOM, WALL_PLACEMENT_TOP } from '@/constants/room-geometry';
import { FLOOR_Y, projectWorld, type NativeRoomWorld, type Vec3 } from '@/utils/native-room-world';
import { ROOM_PLACEMENT_MAX, ROOM_PLACEMENT_MIN, roomPlacementStatus, type RoomPlacementFeedback } from '@/utils/room-item-placement';

function line(path: ReturnType<typeof Skia.Path.Make>, points: Vec3[], width: number, height: number, close = false) {
  points.forEach((p, i) => {
    const point = projectWorld(p, width), x = point.x + width / 2, y = point.y + height / 2;
    if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
  });
  if (close) path.close();
}
/** Live placement diagnostics stay visible outside the finger's contact area. */
export function RoomPlacementOverlay({ world, feedback, visible = true, dragMotion, dragBase }: {
  world: NativeRoomWorld; feedback: RoomPlacementFeedback; visible?: boolean;
  dragMotion?: SharedValue<RoomDragMotion>; dragBase?: SharedValue<RoomDragBase | undefined>;
}) {
  const { t } = useTranslation();
  const paths = useMemo(() => {
    const blockers = Skia.Path.Make(), edges = Skia.Path.Make();
    const edgeLine = (points: Vec3[]) => line(edges, points, world.width, world.height);
    for (const blocker of feedback.blockers) for (const corners of blocker.boxes) {
      line(blockers, corners.slice(0, 4), world.width, world.height, true);
      line(blockers, corners.slice(4), world.width, world.height, true);
      for (let i = 0; i < 4; i++) line(blockers, [corners[i], corners[i + 4]], world.width, world.height);
    }
    const floor = feedback.candidate.wallAxis === undefined;
    const lo = floor ? ROOM_PLACEMENT_MIN : WALL_PLACEMENT_MIN, hi = floor ? ROOM_PLACEMENT_MAX : WALL_PLACEMENT_MAX;
    for (const edge of feedback.boundaries) {
      if (edge==='leftWall') edgeLine([[lo,FLOOR_Y,lo],[lo,FLOOR_Y,hi]]);
      else if (edge==='backWall') edgeLine([[lo,FLOOR_Y,lo],[hi,FLOOR_Y,lo]]);
      else if (edge==='rightEdge') edgeLine([[hi,FLOOR_Y,lo],[hi,FLOOR_Y,hi]]);
      else if (edge==='frontEdge') edgeLine([[lo,FLOOR_Y,hi],[hi,FLOOR_Y,hi]]);
      else {
        const axis = feedback.candidate.wallAxis;
        const onWall = (along: number, y: number): Vec3 => axis===0 ? [WALL_MOUNT_PLANE,y,along] : [along,y,WALL_MOUNT_PLANE];
        if (edge==='wallStart' || edge==='wallEnd') {
          const along = edge==='wallStart' ? lo : hi;
          edgeLine([onWall(along,WALL_PLACEMENT_BOTTOM),onWall(along,WALL_PLACEMENT_TOP)]);
        } else {
          const y = edge==='wallTop' ? WALL_PLACEMENT_TOP : WALL_PLACEMENT_BOTTOM;
          edgeLine([onWall(lo,y),onWall(hi,y)]);
        }
      }
    }
    return {blockers,edges};
  },[world.width,world.height,feedback]);
  const candidate = feedback.candidate;
  const width = world.width, height = world.height;
  const pose = useDerivedValue(() => {
    const base = dragBase?.get(), motion = dragMotion?.get();
    const live = base && motion?.active && motion.moved && base.session === motion.session;
    const object = live ? base.object : candidate;
    const delta = live ? roomDragDelta(motion.x - base.x, motion.y - base.y, width, object.wallAxis) : [0, 0, 0];
    const label = projectWorld([(object.min[0] + object.max[0]) / 2 + delta[0], object.max[1] + .08 + delta[1],
      (object.min[2] + object.max[2]) / 2 + delta[2]], width);
    return label;
  });
  const labelWidth = moderateScale(128);
  const labelPosition = useAnimatedStyle(() => ({
    left: Math.max(4, Math.min(width - labelWidth - 4, pose.get().x + width / 2 - labelWidth / 2)),
    top: Math.max(4, Math.min(height - 32, pose.get().y + height / 2 - 24)),
  }));
  const status = roomPlacementStatus(feedback);
  const valid = status === 'ready';
  const color = valid ? GameColors.secondaryDark : status === 'checking' ? GameColors.textMuted : GameColors.hunger;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill,{zIndex:ROOM_MENU_OPEN_Z_INDEX, opacity: visible ? 1 : 0}]}>
    <Canvas style={StyleSheet.absoluteFill}>
    <Path path={paths.blockers} color={GameColors.primary} style="stroke" strokeWidth={2}/>
    <Path path={paths.edges} color={GameColors.primary} style="stroke" strokeWidth={4}/>
    </Canvas>
    <Animated.Text style={[styles.label,{width:labelWidth, color, borderColor: color},labelPosition]}>{valid ? '✓ ' : status === 'checking' ? '… ' : '× '}{t(valid ? feedback.snapped ? 'home.placementAligned' : 'home.placementReady' : status === 'checking' ? 'home.placementChecking' : 'home.notPlaced')}</Animated.Text>
  </View>;
}

const styles = StyleSheet.create({
  label: {position:'absolute',backgroundColor:GameColors.background,color:GameColors.primaryDark,
    borderColor:GameColors.hunger,borderWidth:1,borderRadius:6,padding:4,
    fontSize:moderateScale(11),fontWeight:'700',textAlign:'center'},
});
