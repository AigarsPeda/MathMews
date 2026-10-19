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
        chest, roll = -.055*load, -.055*load
        happy = smooth_window(t,.22,.84,.10)
        blink = pulse(t,.72,.105)
        lids, mouth = .7*blink, .85*pulse(t,.44,.20)
        brow_lift = [.018*lift, .025*lift]
        ears = [[-.16*lift,-.06*lift,0],[-.23*lift,.04*lift,0]]
        tail.rotation_euler = (.04*load, .10*pulse(t,.55,.23), -.12*load)
        tail_tip = .17*pulse(t,.65,.22)
    elif state == 'puzzleProud':
        # A modest "we did it": chest opens first, eyes meet the player,
        # one deliberate nod, then a warm slow blink instead of more nodding.
        proud = beat(t, [(0,0),(.20,1),(.48,1),(.79,.6),(.96,0),(1,0)])
        nod = pulse(t,.48,.14)
        head.rotation_euler = (-.16*proud + .34*nod, -.08*proud, .045*proud)
        head.location.z += .055*proud - .025*nod
        body.location.z += .025*proud
        chest, hips = -.09*proud, .025*proud
        happy = proud
        blink = pulse(t,.73,.14)
        lids = blink
        ears = [[-.22*proud,-.045*proud,0],[-.16*proud,.045*proud,0]]
        tail.rotation_euler = (.05*proud,.13*pulse(t,.62,.26),0)
        tail_tip = -.18*pulse(t,.77,.20)
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
        # A quick "oh!", then a downcast glance and a pause. The gaze finds
        # the player again before the ears and tail recover.
        surprise = pulse(t,.115,.09)
        down = beat(t, [(0,0),(.16,0),(.31,1),(.52,1),(.78,0),(1,0)])
        reassure = pulse(t,.81,.13)
        head.location.z += .025*surprise - .105*down
        head.rotation_euler = (-.12*surprise+.27*down-.09*reassure, .10*down, -.12*down)
        body.location.z -= .055*down
        chest, hips = .07*down, -.025*down
        sad = down
        blink = .75*pulse(t,.22,.065) + pulse(t,.82,.10)
        lids = .6*pulse(t,.82,.10)
        mouth = .75*surprise
        eye_open = 1 + .24*surprise
        brow_lift = [.050*surprise, .040*surprise]
        gaze = [.012*down, -.012*down]
        ears = [[.28*down+.10*surprise,-.39*down,0],[.20*down+.14*surprise,.30*down,0]]
        tail.rotation_euler = (-.80*beat(t,[(0,0),(.18,0),(.39,1),(.58,1),(.91,0),(1,0)]),0,0)
        tail_tip = -.16*pulse(t,.49,.20) + .17*pulse(t,.87,.10)
    elif state == 'puzzleThink':
        # The eyes search the clue first. Head tilt follows, then one ear
        # swivels to listen. A little recognition lift resolves the question.
        study = beat(t,[(0,0),(.18,1),(.48,1),(.69,.3),(.88,0),(1,0)])
        tilt = beat(t,[(0,0),(.20,0),(.39,1),(.59,1),(.81,0),(1,0)])
        idea = pulse(t,.76,.11)
        head.rotation_euler = (.11*study-.19*idea, .23*study-.08*idea, -.28*tilt)
        head.location.z -= .045*study
        head.location.z += .055*idea
        chest, roll = .035*study, -.035*tilt
        sad = .55*study
        blink = pulse(t,.56,.075)
        mouth = .55*idea
        eye_open = 1+.16*idea
        brow_lift = [.045*tilt+.025*idea, -.012*tilt+.025*idea]
        gaze = [.018*study-.028*idea, -.006*study+.016*idea]
        ears = [[.13*study,-.17*study,0],[.22*tilt-.27*idea,.43*tilt, .12*tilt]]
        tail.rotation_euler = (-.38*study, .12*pulse(t,.49,.15), .08*tilt)
        tail_tip = .24*pulse(t,.72,.17)
    elif state == 'puzzleRecover':
        # Share the disappointment, exhale with eyes closed, then take a
        # visible breath and lift the chest. Finish with a small confident nod.
        low = beat(t,[(0,0),(.23,1),(.43,1),(.69,0),(1,0)])
        breath = pulse(t,.60,.18)
        resolve = pulse(t,.78,.13)
        head.location.z -= .14*low
        head.location.z += .045*breath
        head.rotation_euler = (.29*low-.13*breath+.13*resolve, -.065*low, .07*low)
        body.location.z -= .09*low
        body.location.z += .045*breath
        chest, hips = .11*low-.08*breath, -.045*low
        sad = low
        blink = smooth_window(t,.29,.51,.10) + .65*pulse(t,.85,.07)
        lids = .55*pulse(t,.85,.07)
        happy = .45*resolve
        ears = [[.29*low-.19*breath,-.35*low,0],[.22*low-.23*breath,.27*low,0]]
        tail.rotation_euler = (-.9*beat(t,[(0,0),(.30,1),(.49,1),(.85,0),(1,0)]),0,0)
        tail_tip = -.12*pulse(t,.44,.18) + .24*pulse(t,.80,.17)

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
