"""Authored trot and run footfalls for the exported cat rig.

The walk's footfalls live in cat_model.pose_cat; this module adds the faster
gaits on the same controls. Timings come from constants/cat-gaits.json, which
the runtime shares.
"""
from pathlib import Path
import json
import math

ROOT = Path(__file__).resolve().parents[2]
GAITS = json.loads((ROOT/'constants/cat-gaits.json').read_text())


def paw_swing(swing, stride, stance, height, front):
    blend = swing**3*(10-15*swing+6*swing*swing)
    travel = stride*stance/2+stride*(1-stance)*swing-stride*blend
    travel += (-.02 if front else .02)*64*swing**3*(1-swing)**3
    peel = .26*math.sin(math.pi*min(1, swing/.32))**2
    recovery = (.42 if front else .32)*math.sin(math.pi*max(0, (swing-.18)/.82))**2
    pitch = peel-recovery
    lift = height*16*swing*swing*(1-swing)**2
    lift += .23*math.sin(max(0, pitch))+.10*(math.cos(max(0, pitch))-1)
    return travel, lift, pitch


def pose_gait(driver, state, t):
    """Diagonal trot and paired running footfalls, with linear planted travel.

    Horizontal swing matches backward stance velocity and acceleration.
    Ankle lift and heel-to-toe roll clear the full mitten footprint.
    """
    spec = GAITS[state]
    stride, stance = spec['stride'], spec['stance']
    phase = t*math.tau
    # Diagonal contacts compress the trot; passing between them releases it.
    bounce = -.014*math.cos(phase*2) if state == 'trot' else .026*math.cos(phase*2+.4)
    driver['body'].location.z = .59+bounce
    paws = [*driver['feet'], *driver['back_feet']]
    for i, paw in enumerate(paws):
        gait = (t-spec['offsets'][i]) % 1
        if gait < stance:
            travel, lift, pitch = stride*(gait-stance/2), 0, 0
        else:
            swing = (gait-stance)/(1-stance)
            travel, lift, pitch = paw_swing(swing, stride, stance, .115 if state == 'trot' else .18 if i < 2 else .145, i < 2)
        paw.location.y = (-.38 if i<2 else .44)+travel
        height = .12 if i<2 else .105
        paw.location.z = height+lift
        paw.rotation_euler = (pitch, 0, 0)
    driver['tail'].rotation_euler = ((.14 if state=='trot' else .32)+.04*math.sin(phase), .04*math.sin(phase), .04*math.sin(phase))
