import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { moderateScale } from '@/utils/scale';
import { GameColors } from '@/constants/game';
import { ROOM_MENU_OPEN_Z_INDEX } from '@/utils/room-layer-order';
import { WALL_MOUNT_PLANE, WALL_PLACEMENT_MIN, WALL_PLACEMENT_MAX, WALL_PLACEMENT_BOTTOM, WALL_PLACEMENT_TOP } from '@/constants/room-geometry';
import { FLOOR_Y, projectWorld, type NativeRoomWorld, type Vec3 } from '@/utils/native-room-world';
import { ROOM_PLACEMENT_MAX, ROOM_PLACEMENT_MIN, roomItemFootprint, roomItemPlacementOutline, type RoomPlacementFeedback } from '@/utils/room-item-placement';

/** Release-only diagnostics: attempted footprint, actual blocking parts and room edges. */
export function RoomPlacementOverlay({ world, feedback }: { world: NativeRoomWorld; feedback: RoomPlacementFeedback }) {
  const { t } = useTranslation();
  const paths = useMemo(() => {
    const attempted = Skia.Path.Make(), attemptedParts = Skia.Path.Make(), blockers = Skia.Path.Make(), edges = Skia.Path.Make();
    const line = (path: typeof attempted, points: Vec3[], close = false) => {
      points.forEach((p,i) => {
        const point = projectWorld(p,world.width), x = point.x+world.width/2, y = point.y+world.height/2;
        if (i===0) path.moveTo(x,y); else path.lineTo(x,y);
      });
      if (close) path.close();
    };
    line(attempted,roomItemFootprint(feedback.candidate),true);
    const outline = (path: typeof attempted, corners: Vec3[]) => {
      line(path,corners.slice(0,4),true); line(path,corners.slice(4),true);
      for (let i=0;i<4;i++) line(path,[corners[i],corners[i+4]]);
    };
    for (const corners of roomItemPlacementOutline(feedback.candidate)) outline(attemptedParts,corners);
    for (const blocker of feedback.blockers) for (const corners of blocker.boxes) outline(blockers,corners);
    const floor = feedback.candidate.wallAxis === undefined;
    const lo = floor ? ROOM_PLACEMENT_MIN : WALL_PLACEMENT_MIN, hi = floor ? ROOM_PLACEMENT_MAX : WALL_PLACEMENT_MAX;
    for (const edge of feedback.boundaries) {
      if (edge==='leftWall') line(edges,[[lo,FLOOR_Y,lo],[lo,FLOOR_Y,hi]]);
      else if (edge==='backWall') line(edges,[[lo,FLOOR_Y,lo],[hi,FLOOR_Y,lo]]);
      else if (edge==='rightEdge') line(edges,[[hi,FLOOR_Y,lo],[hi,FLOOR_Y,hi]]);
      else if (edge==='frontEdge') line(edges,[[lo,FLOOR_Y,hi],[hi,FLOOR_Y,hi]]);
      else {
        const axis = feedback.candidate.wallAxis;
        const onWall = (along: number, y: number): Vec3 => axis===0 ? [WALL_MOUNT_PLANE,y,along] : [along,y,WALL_MOUNT_PLANE];
        if (edge==='wallStart' || edge==='wallEnd') {
          const along = edge==='wallStart' ? lo : hi;
          line(edges,[onWall(along,WALL_PLACEMENT_BOTTOM),onWall(along,WALL_PLACEMENT_TOP)]);
        } else {
          const y = edge==='wallTop' ? WALL_PLACEMENT_TOP : WALL_PLACEMENT_BOTTOM;
          line(edges,[onWall(lo,y),onWall(hi,y)]);
        }
      }
    }
    const object = feedback.candidate;
    const center = [(object.min[0]+object.max[0])/2,object.max[1]+.08,(object.min[2]+object.max[2])/2] as Vec3;
    const label = projectWorld(center,world.width);
    return {attempted,attemptedParts,blockers,edges,label};
  },[world.width,world.height,feedback]);
  const labelWidth = moderateScale(128);
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill,{zIndex:ROOM_MENU_OPEN_Z_INDEX}]}>
    <Canvas style={StyleSheet.absoluteFill}>
    <Path path={paths.attempted} color={GameColors.hunger} opacity={.12}/>
    <Path path={paths.attemptedParts} color={GameColors.hunger} style="stroke" strokeWidth={1.2} opacity={.6}/>
    <Path path={paths.attempted} color={GameColors.hunger} style="stroke" strokeWidth={2}/>
    <Path path={paths.blockers} color={GameColors.primary} style="stroke" strokeWidth={2}/>
    <Path path={paths.edges} color={GameColors.primary} style="stroke" strokeWidth={4}/>
    </Canvas>
    <Text style={[styles.label,{width:labelWidth,
      left:Math.max(4,Math.min(world.width-labelWidth-4,paths.label.x+world.width/2-labelWidth/2)),
      top:Math.max(4,Math.min(world.height-32,paths.label.y+world.height/2-24)),
    }]}>{t('home.placementAttempted')}</Text>
  </View>;
}

const styles = StyleSheet.create({
  label: {position:'absolute',backgroundColor:GameColors.background,color:GameColors.primaryDark,
    borderColor:GameColors.hunger,borderWidth:1,borderRadius:6,padding:4,
    fontSize:moderateScale(11),fontWeight:'700',textAlign:'center'},
});
