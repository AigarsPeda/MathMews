import { pawReachWeight } from '@/utils/native-paw-contact';

/** Gait follows distance; a swat loads the support side before the paw arrives.
 * These offsets bend the weighted torso while contact IK retains the footprint.
 */
export function catSpinePose(phase: number, speed: number, turn: number, jump?: number, play?: number) {
  'worklet';
  const amount=Math.max(0,Math.min(1,speed/1.8));
  const run=Math.max(0,Math.min(1,(speed-3)/1.6));
  const wave=phase*Math.PI*2, flex=Math.sin(wave+.35);
  const walk=amount*(1-run), support=Math.sin(wave-.18*Math.PI*2);
  const bend=Math.max(-1,Math.min(1,turn/.7));
  const flight=jump===undefined?0:Math.sin(Math.PI*Math.max(0,Math.min(1,(jump-.20)/.52)))**2;
  const left=play===undefined?0:pawReachWeight(play+.035,0);
  const right=play===undefined?0:pawReachWeight(play+.035,1);
  const load=Math.max(left,right),lean=left-right;
  return {
    arch:amount*(.065-.007*run)*flex+.045*flight+.065*load,
    side:-.040*bend+.026*lean+.035*walk*support,
    chestPitch:amount*(.065-.007*run)*flex+.025*flight+.14*load,
    hipPitch:-amount*(.040+.030*run)*Math.sin(wave-.2)-.035*flight-.045*load,
    chestYaw:.22*bend+walk*.18*support+.065*lean,
    hipYaw:-.13*bend-walk*.11*Math.sin(wave-.18*Math.PI*2-.65)-.025*lean,
    // Alternate the shoulder line with the forepaw cycle. The pelvis follows
    // later, so the back twists through a stride rather than rocking as a block.
    chestRoll:walk*.20*support,
    hipRoll:-walk*.095*Math.sin(wave-.18*Math.PI*2-.65),
    scapula:walk*.080*Math.cos(wave-.18*Math.PI*2),
    // Lowering into each load leaves elbow room; never stretch a planted leg.
    chestLift:-amount*.055*(.5+.5*Math.cos(wave*2))-.048*load,
    hipLift:-amount*.018*(.5+.5*Math.cos(wave*2-.9))-.014*load,
    // Drawing-thread followers trail the rendered torso, not a second clock.
    headPitch:0,headYaw:0,headRoll:0,
    tailFollowYaw:0,tailFollowPitch:0,tailTipYaw:0,tailTipPitch:0,
  };
}
