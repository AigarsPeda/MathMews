/** Small walking sway, stronger running flexion and a curve into a turn.
 * Phase follows the paws' distance clock, so slowing down cannot leave the
 * torso cycling at a different speed. Values are offsets on the authored rig.
 */
export function catSpinePose(phase: number, speed: number, turn: number, jump?: number) {
  'worklet';
  const amount=Math.max(0,Math.min(1,speed/1.8));
  const run=Math.max(0,Math.min(1,(speed-3)/1.6));
  const wave=phase*Math.PI*2, flex=Math.sin(wave+.35);
  const bend=Math.max(-1,Math.min(1,turn/.7));
  const flight=jump===undefined?0:Math.sin(Math.PI*Math.max(0,Math.min(1,(jump-.20)/.52)))**2;
  return {
    arch:amount*(.006+.045*run)*flex+.045*flight,
    side:-.012*bend,
    chestPitch:amount*.055*run*flex+.025*flight,
    hipPitch:-amount*.070*run*flex-.035*flight,
    chestYaw:.12*bend+amount*.025*(1-run)*Math.sin(wave),
    hipYaw:-.085*bend-amount*.020*(1-run)*Math.sin(wave-.45),
  };
}
