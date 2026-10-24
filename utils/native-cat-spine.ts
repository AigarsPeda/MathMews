import { pawReachWeight } from '@/utils/native-paw-contact';

/** Gait follows distance; a swat loads the support side before the paw arrives.
 * These offsets bend the weighted torso while contact IK retains the footprint.
 */
export function catSpinePose(phase: number, speed: number, turn: number, jump?: number, play?: number) {
  'worklet';
  const amount=Math.max(0,Math.min(1,speed/1.8));
  const run=Math.max(0,Math.min(1,(speed-3)/1.6));
  const wave=phase*Math.PI*2, flex=Math.sin(wave+.35);
  const bend=Math.max(-1,Math.min(1,turn/.7));
  const flight=jump===undefined?0:Math.sin(Math.PI*Math.max(0,Math.min(1,(jump-.20)/.52)))**2;
  const left=play===undefined?0:pawReachWeight(play+.035,0);
  const right=play===undefined?0:pawReachWeight(play+.035,1);
  const load=Math.max(left,right),lean=left-right;
  return {
    arch:amount*(.030+.028*run)*flex+.045*flight+.065*load,
    side:-.040*bend+.026*lean,
    chestPitch:amount*(.030+.028*run)*flex+.025*flight+.14*load,
    hipPitch:-amount*(.014+.056*run)*Math.sin(wave-.2)-.035*flight-.045*load,
    chestYaw:.22*bend+amount*.045*(1-run)*Math.sin(wave)+.065*lean,
    hipYaw:-.13*bend-amount*.030*(1-run)*Math.sin(wave-.65)-.025*lean,
    // Lowering into each load leaves elbow room; never stretch a planted leg.
    chestLift:-amount*.035*(.5+.5*Math.cos(wave*2))-.048*load,
    hipLift:-amount*.018*(.5+.5*Math.cos(wave*2-.9))-.014*load,
  };
}
