"""Six acted notification moments, baked onto the weighted cat rig in Blender."""
import math
from cat_model import pulse, smooth_window

SUCCESS_REACTIONS = ('puzzleHighPaw', 'puzzleProud', 'puzzleBounce')
RETRY_REACTIONS = ('puzzleOops', 'puzzleThink', 'puzzleRecover')
PUZZLE_REACTIONS = SUCCESS_REACTIONS + RETRY_REACTIONS


def beat(t, keys):
    """Eased pose changes with explicit holds, rather than a repeating wave."""
    for (start, a), (end, b) in zip(keys, keys[1:]):
        if t <= end:
            u = max(0, min(1, (t-start)/(end-start)))
            return a + (b-a)*u*u*(3-2*u)
    return keys[-1][1]


def pose_reaction(driver, state, t, idle):
    head, body, tail = (driver[key] for key in ('head', 'body', 'tail'))
    for key in ('feet', 'back_feet'):
        for paw, baseline in zip(driver[key], idle[key]):
            paw.location = baseline.copy()
    head.location = idle['head'].copy()
    head.rotation_euler = (0, 0, 0)
    tail.rotation_euler = (0, 0, 0)
    # These secondary beats follow the primary gesture at different times.
    chest = hips = roll = happy = sad = blink = lids = mouth = 0
    gaze = [0, 0]
    ears = [[0, 0, 0], [0, 0, 0]]
    wrist = 0
    tail_tip = 0
    brow_lift = [0, 0]
    eye_open = 1
    active = smooth_window(t, .04, .94, .06)

    if state == 'puzzleHighPaw':
        # Notice the player, load the supporting side, then offer and hold a
        # paw. A small wrist greeting is followed by a satisfied slow blink.
        load = beat(t, [(0,0),(.12,1),(.24,1),(.70,1),(.91,0),(1,0)])
        lift = beat(t, [(0,0),(.16,0),(.34,1),(.64,1),(.86,0),(1,0)])
        greet = pulse(t, .49, .095) - .45*pulse(t, .64, .07)
        body.location.x -= .055*load
        body.location.z -= .035*load
        head.location.x += .025*load
        head.rotation_euler = (-.07*lift, -.13*lift, -.09*load)
        paw = driver['feet'][1]
        paw.location.x += .075*lift + .025*greet
        paw.location.y -= .18*lift
        paw.location.z += .67*lift
        wrist = -.80*lift + .20*greet
        chest, roll = -.11*load, -.075*load
        happy = smooth_window(t,.22,.84,.10)
        blink = pulse(t,.72,.105)
        lids, mouth = .7*blink, .85*pulse(t,.44,.20)
        brow_lift = [.018*lift, .025*lift]
        ears = [[-.16*lift,-.06*lift,0],[-.23*lift,.04*lift,0]]
        tail.rotation_euler = (.04*load, .10*pulse(t,.55,.23), -.12*load)
        tail_tip = .17*pulse(t,.65,.22)
    elif state == 'puzzleProud':
        proud = beat(t, [(0,0),(.08,0),(.25,1),(.72,1),(.95,0),(1,0)])
        nod = pulse(t,.43,.09)
        tail_follow = beat(t, [(0,0),(.13,0),(.36,1),(.77,1),(.97,0),(1,0)])
        head.rotation_euler = (-.28*proud + .13*nod, -.045*proud, .035*proud)
        head.location.y -= .025*proud
        head.location.z += .12*proud - .018*nod
        body.location.z -= .015*proud
        chest, hips = -.25*proud, .055*proud
        happy = proud
        blink = smooth_window(t,.48,.82,.10)
        lids = blink
        brow_lift = [.025*proud, .025*proud]
        ears = [[-.15*proud,.06*proud,0],[-.15*proud,-.06*proud,0]]
        tail.rotation_euler = (.12*tail_follow,.14*tail_follow,0)
        tail_tip = .42*tail_follow
    elif state == 'puzzleBounce':
        # One committed spring with a smaller rebound. The neck counters the
        # chest; shoulders absorb landing before the tail tip catches up.
        gather = pulse(t,.17,.13)
        hop = beat(t, [(0,0),(.23,0),(.34,1),(.43,.70),(.53,0),(.60,0),(.68,.35),(.77,0),(1,0)])
        land = pulse(t,.56,.075) + .45*pulse(t,.79,.07)
        body.location.z += .37*hop - .15*gather - .105*land
        head.location.z += .045*gather + .04*land
        head.rotation_euler = (.10*gather - .12*hop + .09*land, 0, .07*pulse(t,.88,.10))
        for key in ('feet','back_feet'):
            for paw in driver[key]:
                paw.location.z += .222*hop
        chest, hips = .10*gather + .09*land, -.08*gather - .05*land
        happy = smooth_window(t,.27,.91,.08)
        blink = .7*pulse(t,.18,.06) + pulse(t,.85,.10)
        lids = max(.85*pulse(t,.39,.13), blink*happy)
        mouth = 1.15*pulse(t,.40,.15)
        ears = [[-.23*hop+.12*land,-.07*gather,0],[-.20*hop+.09*land,.07*gather,0]]
        tail.rotation_euler = (.18*gather-.22*hop+.12*land,0,0)
        tail_tip = .30*pulse(t,.48,.20) - .20*pulse(t,.84,.12)
    elif state == 'puzzleOops':
        # Abrupt backward upper-body recoil, pause, then avert the eyes.
        # Body Y is not consumed by game_cat; chest/hip counter-pitch and the
        # head's rearward travel carry the backward line over planted feet.
        recoil = beat(t,[(0,0),(.04,0),(.12,1),(.26,1),(.48,0),(1,0)])
        away = beat(t,[(0,0),(.22,0),(.37,1),(.66,1),(.92,0),(1,0)])
        tail_follow = beat(t,[(0,0),(.12,0),(.32,1),(.63,1),(.96,0),(1,0)])
        head.location.y += .17*recoil-.055*away
        head.location.z += .065*recoil-.075*away
        head.rotation_euler = (-.27*recoil+.19*away, -.06*away, -.36*away)
        body.location.z -= .13*recoil+.045*away
        chest, hips, roll = -.30*recoil+.07*away, .12*recoil, -.035*away
        sad = .78*away
        blink = .75*pulse(t,.28,.055) + pulse(t,.87,.08)
        lids = .45*pulse(t,.87,.08)
        mouth = .80*recoil*(1-away)
        eye_open = 1+.22*recoil
        brow_lift = [.045*recoil+.018*away, .040*recoil]
        gaze = [-.026*away,-.010*away]
        ears = [[-.30*recoil+.18*away,-.38*away,0],[-.25*recoil+.16*away,.28*away,0]]
        tail.rotation_euler = (-.84*tail_follow,0,-.13*away)
        tail_tip = -.14*pulse(t,.52,.22)
    elif state == 'puzzleThink':
        # Shift onto the left foreleg, lift the free paw and
        # hold a diagonal head/body line. No repeated head shaking.
        study = beat(t,[(0,0),(.06,0),(.24,1),(.70,1),(.95,0),(1,0)])
        tilt = beat(t,[(0,0),(.16,0),(.32,1),(.68,1),(.92,0),(1,0)])
        idea = pulse(t,.78,.10)
        head.rotation_euler = (.065*study-.14*idea, -.27*tilt, .21*tilt)
        head.location.x += .055*tilt
        head.location.z += .015*study+.045*idea
        body.location.x -= .075*study
        body.location.z -= .065*study
        chest, hips, roll = -.055*study, .035*study, .11*tilt
        paw = driver['feet'][1]
        paw.location.x -= .045*tilt
        paw.location.y -= .07*tilt
        paw.location.z += .29*tilt
        wrist = -.42*tilt
        sad = .48*study
        blink = pulse(t,.73,.05)
        mouth = .25*idea
        eye_open = 1+.10*idea
        brow_lift = [.060*tilt+.025*idea,-.018*tilt+.025*idea]
        gaze = [.018*study,-.002*study+.010*idea]
        ears = [[.08*study,-.06*study,0],[.20*tilt-.18*idea,.35*tilt,.12*tilt]]
        tail.rotation_euler = (-.22*study,.08*tilt,.14*tilt)
        tail_tip = .27*pulse(t,.60,.28)
    elif state == 'puzzleRecover':
        # Exhale low, then expand through a long upward recovery and HOLD the
        # open chest. The final few frames release to neutral for clip mixing.
        low = beat(t,[(0,0),(.18,1),(.34,1),(.63,0),(1,0)])
        inhale = beat(t,[(0,0),(.36,0),(.60,1),(.80,1),(.97,0),(1,0)])
        resolve = pulse(t,.76,.07)
        head.location.y -= .13*low
        head.location.z += -.20*low+.20*inhale
        head.rotation_euler = (.34*low-.30*inhale+.10*resolve,-.025*low,0)
        body.location.z += -.21*low-.008*inhale
        chest, hips = .23*low-.25*inhale, -.09*low+.06*inhale
        sad = low
        blink = smooth_window(t,.23,.43,.07)
        lids = .35*pulse(t,.80,.07)
        happy = .48*inhale
        brow_lift = [.025*inhale,.025*inhale]
        ears = [[.26*low-.20*inhale,-.40*low,0],[.22*low-.20*inhale,.38*low,0]]
        tail_low = beat(t,[(0,0),(.25,1),(.43,1),(.78,0),(1,0)])
        tail.rotation_euler = (-.98*tail_low+.08*inhale,0,0)
        tail_tip = -.10*pulse(t,.39,.17)+.30*pulse(t,.79,.18)

    for ear, rotation in zip(driver['ears'], ears):
        ear.rotation_euler = rotation
    # Open eyes carry attention for most of the performance. Closed crescents
    # belong to specific smiles/blinks, rather than covering every happy beat.
    blink = min(1, blink)
    eye_height = .105*eye_open*(1-.28*sad)*(1-blink)*(1-lids)
    for i, (eye, glint, lid, brow, fan) in enumerate(zip(driver['eyes'],driver['glints'],driver['happy_lids'],driver['brows'],driver['whiskers'])):
        side = -1 if i == 0 else 1
        eye.scale = (.091, .050, eye_height)
        visible = (1-blink)*(1-lids)
        glint.scale = (.023*visible, .012*visible, .027*visible)
        lid.scale = (lids,lids,lids)
        brow.rotation_euler = (0,side*(.33*sad-.10*happy),0)
        brow.location.z = .235 + brow_lift[i]
        fan.rotation_euler = (0,side*(.10*sad-.08*happy),0)
    smile = max(0,1-2*sad-mouth)
    driver['smile'].scale = (smile,smile,smile)
    driver['mouth'].scale = (mouth,mouth,mouth)
    driver['frown'].scale = (sad,sad,sad)
    # All offsets are zero at the seam. Whiskers stay attached while their
    # spread, tail tip, gaze and wrist can move independently of the head.
    return dict(chest=chest, hips=hips, roll=roll, wrist=wrist, gaze=gaze,
                tail_tip=tail_tip, whiskers=(-.08*happy+.10*sad)*active)
