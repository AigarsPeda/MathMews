import { pawReachWeight } from '@/utils/native-paw-contact';

/** Gait follows distance; a swat loads the support side before the paw arrives.
 * These offsets bend the weighted torso while contact IK retains the footprint.
 */
export function catSpinePose(phase: number, speed: number, turn: number, jump?: number, play?: number) {
  'worklet';
  const amount=Math.max(0,Math.min(1,speed/1.8));
  const run=Math.max(0,Math.min(1,(speed-3)/1.6));
  const wave=phase*Math.PI*2, flex=Math.sin(wave+.35);
  const trot=Math.max(0,Math.min(1,(speed-1.8)/1.2))*(1-run);
  const walk=amount*(1-run-trot), support=Math.sin(wave-.18*Math.PI*2);
  // Each fore contact accepts weight, then rises through passing. The hind
  // contacts lead the fore contacts in walk, and share the diagonal in trot.
  // Advance the load target by the drawing-thread filter's response time.
  const foreLoad=.5+.5*Math.cos(2*(wave-.18*Math.PI*2)+.35);
  const hindLoad=.5+.5*Math.cos(2*wave+.35);
  const diagonal=.5+.5*Math.cos(2*wave+.55);
  const foreRun=.5+.5*Math.cos(wave-.10*Math.PI*2);
  const hindRun=.5+.5*Math.cos(wave-.90*Math.PI*2);
  const bend=Math.max(-1,Math.min(1,turn/.7));
  const flight=jump===undefined?0:Math.sin(Math.PI*Math.max(0,Math.min(1,(jump-.20)/.52)))**2;
  const left=play===undefined?0:pawReachWeight(play+.035,0);
  const right=play===undefined?0:pawReachWeight(play+.035,1);
  const load=Math.max(left,right),lean=left-right;
  return {
    arch:(walk*.065+trot*.035)*flex+run*.025*Math.cos(wave-.65*Math.PI*2)+.045*flight+.065*load,
    side:-.040*bend+.026*lean+.035*walk*support,
    chestPitch:walk*(.045*flex+.035*Math.sin(2*(wave-.18*Math.PI*2)))+trot*.045*Math.sin(2*wave+.4)+.025*flight+.14*load,
    hipPitch:-walk*(.035*Math.sin(wave-.2)+.025*Math.sin(2*wave))-trot*.035*Math.sin(2*wave+.4)-.035*flight-.045*load,
    chestYaw:.22*bend+(walk+trot*.30)*.18*support+.065*lean,
    hipYaw:-.13*bend-(walk+trot*.30)*.11*Math.sin(wave-.18*Math.PI*2-.65)-.025*lean,
    // Alternate the shoulder line with the forepaw cycle. The pelvis follows
    // later, so the back twists through a stride rather than rocking as a block.
    chestRoll:(walk+trot*.35)*.14*support,
    hipRoll:-(walk+trot*.35)*.070*Math.sin(wave-.18*Math.PI*2-.65),
    scapula:(walk+trot*.4)*.080*Math.cos(wave-.18*Math.PI*2),
    // Lowering into each load leaves elbow room; never stretch a planted leg.
    chestLift:-walk*.085*foreLoad-trot*.095*diagonal-run*.070*foreRun-.048*load,
    hipLift:-walk*.060*hindLoad-trot*.075*diagonal-run*.060*hindRun-.014*load,
    // Drawing-thread followers trail the rendered torso, not a second clock.
    headPitch:0,headYaw:0,headRoll:0,
    tailFollowYaw:0,tailFollowPitch:0,tailTipYaw:0,tailTipPitch:0,
  };
}
