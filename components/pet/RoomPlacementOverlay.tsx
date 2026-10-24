import { Canvas, DashPathEffect, Group, Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { moderateScale } from '@/utils/scale';
import { GameColors } from '@/constants/game';
import { ROOM_MENU_OPEN_Z_INDEX } from '@/utils/room-layer-order';
import { WALL_MOUNT_PLANE, WALL_PLACEMENT_MIN, WALL_PLACEMENT_MAX, WALL_PLACEMENT_BOTTOM, WALL_PLACEMENT_TOP } from '@/constants/room-geometry';
import { FLOOR_Y, projectWorld, type NativeRoomWorld, type Vec3 } from '@/utils/native-room-world';
import { ROOM_PLACEMENT_MAX, ROOM_PLACEMENT_MIN, roomItemFootprint, roomPlacementStatus, roomItemPlacementOutline, type RoomPlacementFeedback } from '@/utils/room-item-placement';

function line(path: ReturnType<typeof Skia.Path.Make>, points: Vec3[], width: number, height: number, close = false) {
  points.forEach((p, i) => {
    const point = projectWorld(p, width), x = point.x + width / 2, y = point.y + height / 2;
    if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
  });
  if (close) path.close();
}
function outline(path: ReturnType<typeof Skia.Path.Make>, corners: Vec3[], width: number, height: number) {
  line(path, corners.slice(0, 4), width, height, true);
  line(path, corners.slice(4), width, height, true);
  for (let i = 0; i < 4; i++) line(path, [corners[i], corners[i + 4]], width, height);
}

/** Live placement diagnostics stay visible outside the finger's contact area. */
export function RoomPlacementOverlay({ world, feedback, isNew = false }: { world: NativeRoomWorld; feedback: RoomPlacementFeedback; isNew?: boolean }) {
  const { t } = useTranslation();
  const { modelId, heading, scale, collidable } = feedback.candidate;
  // Translation does not change the mesh outline. Keep the expensive Skia paths
  // and move their drawing groups; rotation/scale/model changes rebuild them.
  const shape = useMemo(() => {
    const attempted = Skia.Path.Make(), attemptedParts = Skia.Path.Make();
    const object = { modelId, heading, scale, collidable, position: [0, 0, 0] as Vec3, min: [0, 0, 0] as Vec3 };
    line(attempted, roomItemFootprint(object), world.width, world.height, true);
    for (const corners of roomItemPlacementOutline(object)) outline(attemptedParts, corners, world.width, world.height);
    return { attempted, attemptedParts };
  }, [modelId, heading, scale, collidable, world.width, world.height]);
  const origin = useMemo(() => {
    const path = Skia.Path.Make();
    const original = world.objects.find(object => object.instanceId === feedback.candidate.instanceId);
    if (original && !isNew) line(path, roomItemFootprint(original), world.width, world.height, true);
    return path;
  }, [world.objects, world.width, world.height, feedback.candidate.instanceId, isNew]);
  const paths = useMemo(() => {
    const blockers = Skia.Path.Make(), edges = Skia.Path.Make();
    const edgeLine = (points: Vec3[]) => line(edges, points, world.width, world.height);
    for (const blocker of feedback.blockers) for (const corners of blocker.boxes) outline(blockers, corners, world.width, world.height);
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
    const object = feedback.candidate;
    const center = [(object.min[0]+object.max[0])/2,object.max[1]+.08,(object.min[2]+object.max[2])/2] as Vec3;
    const label = projectWorld(center,world.width);
    return {blockers,edges,label};
  },[world.width,world.height,feedback]);
  const projectedOrigin = projectWorld([0, 0, 0], world.width);
  const translation = (point: Vec3) => {
    const projected = projectWorld(point, world.width);
    return [{ translateX: projected.x - projectedOrigin.x }, { translateY: projected.y - projectedOrigin.y }];
  };
  const position = feedback.candidate.position;
  const footprintTransform = translation([position[0], feedback.candidate.min[1], position[2]]);
  const partsTransform = translation(position);
  const labelWidth = moderateScale(128);
  const status = roomPlacementStatus(feedback);
  const valid = status === 'ready';
  const color = valid ? GameColors.secondaryDark : status === 'checking' ? GameColors.textMuted : GameColors.hunger;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill,{zIndex:ROOM_MENU_OPEN_Z_INDEX}]}>
    <Canvas style={StyleSheet.absoluteFill}>
    <Path path={origin} color={GameColors.textMuted} style="stroke" strokeWidth={1} opacity={.4}/>
    <Group transform={footprintTransform}>
      <Path path={shape.attempted} color={color} opacity={.12}/>
      <Path path={shape.attempted} color={color} style="stroke" strokeWidth={2}>{!valid && <DashPathEffect intervals={[5, 3]}/>}</Path>
    </Group>
    <Group transform={partsTransform}>
      <Path path={shape.attemptedParts} color={color} style="stroke" strokeWidth={1.2} opacity={.6}/>
    </Group>
    <Path path={paths.blockers} color={GameColors.primary} style="stroke" strokeWidth={2}/>
    <Path path={paths.edges} color={GameColors.primary} style="stroke" strokeWidth={4}/>
    </Canvas>
    <Text style={[styles.label,{width:labelWidth, color, borderColor: color,
      left:Math.max(4,Math.min(world.width-labelWidth-4,paths.label.x+world.width/2-labelWidth/2)),
      top:Math.max(4,Math.min(world.height-32,paths.label.y+world.height/2-24)),
    }]}>{valid ? '✓ ' : status === 'checking' ? '… ' : '× '}{t(valid ? feedback.snapped ? 'home.placementAligned' : 'home.placementReady' : status === 'checking' ? 'home.placementChecking' : 'home.notPlaced')}</Text>
  </View>;
}

const styles = StyleSheet.create({
  label: {position:'absolute',backgroundColor:GameColors.background,color:GameColors.primaryDark,
    borderColor:GameColors.hunger,borderWidth:1,borderRadius:6,padding:4,
    fontSize:moderateScale(11),fontWeight:'700',textAlign:'center'},
});
