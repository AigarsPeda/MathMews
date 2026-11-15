"""Whole-body acting for the cat's short emotional clips.

game_cat.pose calls performance(state, t) outside the six puzzle reactions.
Return None to preserve an unrelated clip. Optional dict channels, in rig
units and radians:

  chest, hips   local chest / pelvis X pitch; negative opens the chest
  roll          chest Y roll, independent of the pelvis
  lift          body height offset; back is +Y, side is +X
  hop           height added to the body AND all four paws
  head          (x, y, z) offset, added after the body's translation
  look          (pitch, tilt, turn); positive pitch looks down
  ears          ((pitch, spread), (pitch, spread)), L then R
  tail          four (pitch, sway) pairs, base to tip, replacing tail carriage
  squint        eye-opening multiplier; 1 leaves the legacy eyelids alone
  brows         ((lift, slant), (lift, slant)), L then R
  paws          four (x, y, z) offsets: left fore, right fore, left hind, right hind
  plant         True drops the legacy paw offsets, so `paws` alone moves them

Signs verified with production-rig renders in astra-acting/signs:
  +Y is backward, -Y is toward the nose; +Z is up.
  Ear +pitch tips forward toward the muzzle; -pitch pins backward.
  Ear outward spread is NEGATIVE on L and POSITIVE on R. The reverse
  draws tips inward. Combine backward pitch and outward spread for anger.
  Brow +slant on L / -slant on R lowers the inner ends toward the nose
  (anger); -slant on L / +slant on R lifts the inner ends (concern).
  Tail -pitch trails backward and then down; +pitch curls toward the head.
  Tail +sway moves toward +X, -sway toward -X, in the unrotated rest frame.
  Tail rotations accumulate down the chain, not as four absolute angles.

Paws stay planted through body offsets; only hop lifts every support paw.
Keep planted lifts <= .02. Head drops include forward clearance for the chin.
Loops have identical channels at their seam. One-shot additions ease to zero
at both ends; neutral squint is 1. Existing seated/box poses and legacy facial
or paw motion remain the responsibility of game_cat and cat_model.
"""

import math


def beat(t, keys):
    """Interpolate keyed poses with stationary arrivals and explicit holds."""
    for (start, first), (end, last) in zip(keys, keys[1:]):
        if t <= end:
            fraction = max(0, min(1, (t-start)/(end-start)))
            return first + (last-first)*fraction*fraction*(3-2*fraction)
    return keys[-1][1]


def accent(t, start, peak, end):
    return beat(t, [(0, 0), (start, 0), (peak, 1), (end, 0), (1, 0)])


def hold(t, start=.04, arrive=.20, release=.70, end=.96):
    return beat(t, [(0, 0), (start, 0), (arrive, 1), (release, 1), (end, 0), (1, 0)])


def tail_pose(amount, pitches, sway=0, tip=0):
    # Match game_cat.TAIL_CARRIAGE at the neutral endpoints. Keeping these
    # four numbers here leaves this authoring module importable without bpy.
    carriage = (-.27, -.17, .20, .26)
    return tuple((rest+amount*(pitch-rest), sway*weight + (tip if index == 3 else 0))
                 for index, (rest, pitch, weight) in enumerate(zip(carriage, pitches, (1, .65, .40, .22))))


def performance(state, t):
    t = max(0, min(1, t))
    if t == 1 and state in ('idle', 'idle2', 'blinkIdle', 'sit', 'blinkSit', 'waiting', 'sad', 'cry', 'angryCute'):
        t = 0
    if state == 'sad':
        # A quiet, sustained low line. Only the long exhale moves the shoulders.
        sigh = accent(t, .10, .43, .88)
        return dict(chest=.13+.025*sigh, hips=-.035, roll=-.025,
                    lift=-.075-.012*sigh, back=.025, side=-.018,
                    head=(-.025,-.12,-.075-.014*sigh), look=(.24,.015,-.06),
                    ears=((.22,-.53),(.27,.59)),
                    tail=tail_pose(1,(-1.80,-.24,-.12,.12),-.025),
                    squint=.92, brows=((.018,-.42),(.018,.42)))
    if state == 'cry':
        # Two unequal catches of breath, then the head hangs after the chest
        # releases. The asymmetry belongs to the shoulders, not a head shake.
        first = accent(t,.12,.19,.32)
        second = accent(t,.38,.44,.61)
        sob = first+.68*second
        hang = hold(t,.15,.28,.60,.87)
        return dict(chest=.29-.20*sob, hips=-.07, roll=.12*first-.085*second,
                    lift=-.16+.075*sob, back=.045, side=.025*first-.018*second,
                    head=(0,-.17,-.13-.055*hang),
                    look=(.35+.14*hang,-.035-.07*first+.045*second,-.025),
                    ears=((.30,-.66-.05*sob),(.35,.72+.04*sob)),
                    tail=tail_pose(1,(-1.65,-.32,-.16,.14),.025*accent(t,.47,.65,.88)),
                    squint=.10+.26*sob, brows=((.028,-.50),(.028,.50)))
    if state == 'angryCute':
        lash = beat(t, [(0,0),(.09,0),(.14,.24),(.20,-.26),(.28,.16),
                        (.38,0),(.57,0),(.63,-.25),(.70,.23),(.79,-.10),(.91,0),(1,0)])
        brace = accent(t, .08, .22, .46)
        return dict(chest=.24+.025*brace, hips=-.09, lift=-.15-.012*brace,
                    back=-.035, head=(0,-.10,-.015), look=(-.16,0,0),
                    ears=((-.85,-.80),(-.85,.80)), squint=.52,
                    brows=((-.055,.78),(-.055,-.78)),
                    tail=tail_pose(1,(-1.30,-.20,-.25,-.45),lash,.45*lash))
    if state == 'surprised':
        load = accent(t,.01,.06,.11)
        recoil = beat(t,[(0,0),(.055,0),(.15,1.18),(.23,1),(.56,1),(.73,.35),(.94,0),(1,0)])
        ears = hold(t,.025,.10,.57,.88)
        follow = hold(t,.07,.21,.61,.96)
        return dict(plant=True, paws=((0,.035*recoil,.17*recoil),(0,.035*recoil,.17*recoil),(0,0,0),(0,0,0)),
                    chest=-.13*recoil+.09*load, hips=.04*recoil,
                    lift=-.045*load-.015*recoil, back=.07*recoil,
                    head=(0,.025*recoil,.13*recoil), look=(-.28*recoil,0,0),
                    ears=((-.10*ears,.12*ears),(-.10*ears,-.12*ears)),
                    tail=tail_pose(follow,(-.12,-.05,-.07,-.08)),
                    squint=1+.22*recoil, brows=((.065*recoil,0),(.065*recoil,0)))
    if state == 'incorrect':
        recoil = accent(t,.025,.14,.29)
        concern = hold(t,.09,.25,.50,.79)
        shake = beat(t,[(0,0),(.26,0),(.34,.23),(.43,-.24),(.52,.12),(.62,0),(1,0)])
        recover = accent(t,.65,.79,.94)
        return dict(chest=.09*concern-.07*recoil, hips=-.035*concern,
                    lift=-.055*concern, back=.045*recoil,
                    head=(0,-.04*concern,-.04*concern+.04*recoil),
                    look=(.12*concern-.10*recover,.14*concern,shake),
                    ears=((.22*concern,-.52*concern),(-.14*recover,.12*concern)),
                    tail=tail_pose(concern,(-.72,-.16,0,.12),.10*recover),
                    brows=((.045*concern,-.22*concern),(-.01*concern,.24*concern)))
    if state == 'correct':
        gather = accent(t,.01,.09,.19)
        flight = beat(t,[(0,0),(.14,0),(.24,.25),(.30,.23),(.39,0),(1,0)])
        land = accent(t,.34,.42,.55)
        joy = hold(t,.08,.22,.71,.94)
        follow = hold(t,.14,.32,.74,.97)
        return dict(plant=True, chest=.14*gather+.12*land-.08*joy, hips=-.09*gather-.06*land,
                    lift=-.12*gather-.09*land, hop=flight,
                    head=(0,-.025*gather,.025*joy), look=(.10*gather-.14*joy,.035*joy,0),
                    ears=((-.22*joy+.14*land,-.06*gather),(-.22*joy+.14*land,.06*gather)),
                    tail=tail_pose(follow,(-.20,.12,.22,.22),.13*accent(t,.43,.65,.91)),
                    brows=((.025*joy,0),(.025*joy,0)))
    if state == 'dance':
        groove = hold(t,.025,.13,.79,.97)
        swing = beat(t,[(0,0),(.08,0),(.18,1),(.24,1),(.35,-1),(.41,-1),
                         (.52,1),(.58,1),(.69,-1),(.75,-1),(.86,.35),(.98,0),(1,0)])
        dip = sum(accent(t,start,peak,end) for start,peak,end in
                  ((.04,.11,.19),(.23,.29,.37),(.40,.46,.54),(.57,.63,.71),(.74,.81,.91)))
        tail_swing = beat(t,[(0,0),(.13,0),(.26,.32),(.43,-.32),(.60,.32),(.77,-.32),(.97,0),(1,0)])
        # Step on the beat: the forepaw on the unweighted side lifts as the
        # body swings away from it, instead of one paw held up throughout.
        step = lambda amount: (0, -.03*amount, .17*amount)
        return dict(plant=True, paws=(step(max(0, swing)*groove), step(max(0, -swing)*groove), (0, 0, 0), (0, 0, 0)),
                    chest=.16*swing, hips=-.20*swing, roll=.25*swing,
                    side=.10*swing, lift=-.065*groove-.09*dip,
                    head=(-.065*swing,-.025*groove,.025*dip),
                    look=(-.06*groove,-.23*swing,-.17*swing),
                    ears=((-.10*groove-.10*swing,-.12*groove),(-.10*groove+.10*swing,.12*groove)),
                    tail=tail_pose(groove,(-.65,.12,.24,.18),tail_swing))
    if state == 'excited':
        happy = hold(t,.02,.16,.77,.97)
        lean = beat(t,[(0,0),(.07,0),(.22,1),(.30,1),(.47,-.8),(.55,-.8),(.73,.7),(.97,0),(1,0)])
        wag = math.sin(t*math.tau*5)*happy
        return dict(chest=-.06*happy, hips=.08*lean, roll=.11*lean,
                    side=.04*lean, lift=-.035*happy,
                    head=(.075*lean,-.025*happy,.035*happy),
                    look=(-.10*happy,.19*lean,-.10*lean),
                    ears=((-.28*happy,-.16*happy),(-.22*happy,.20*happy)),
                    tail=tail_pose(happy,(-.25,.12,.18,.20),.23*wag))
    if state == 'waiting':
        # Rock onto the haunches to listen, hold eye contact, then release.
        breath = .5-.5*math.cos(t*math.tau*2)
        listen = hold(t,.08,.27,.62,.94)
        ear = hold(t,.03,.16,.55,.84)
        return dict(plant=True, chest=-.055*listen, hips=.075*listen, roll=-.035*listen,
                    lift=-.045*listen-.012*breath, back=.045*listen, side=-.025*listen,
                    head=(.035*listen,0,.04*listen), look=(-.06*listen,.16*listen,-.10*listen),
                    ears=((-.06*ear,-.04*ear),(.20*ear,.26*ear)),
                    brows=((.045*listen,-.10*listen),(-.008*listen,0)))
    if state in ('idle','idle2','blinkIdle','sit','blinkSit'):
        # Separate ear, gaze and weight events. The runtime also supplies
        # small looks and flicks; keep these held offsets sparse and gentle.
        # Drop the legacy paw fidget. Offset the height-only breath because
        # straight standing legs cannot follow it without losing pad contact.
        breath = .5-.5*math.cos(t*math.tau*2)
        seated = state in ('sit','blinkSit')
        alternative = state == 'idle2'
        direction = -1 if alternative or seated else 1
        orient = hold(t,.055,.13,.28,.43)
        glance = hold(t,.14,.27,.47,.66)
        weight = hold(t,.38,.57,.73,.96)
        return dict(plant=True, chest=-.018*weight, hips=(.015 if seated else .025)*weight,
                    roll=direction*(.008 if seated else .024)*weight,
                    side=direction*(.010 if seated else .018)*weight,
                    lift=-.010*breath if seated else -.010*weight-.012*breath,
                    head=(direction*.012*glance,-.008*weight,.008*weight),
                    look=(-.018*glance,direction*.045*glance,direction*(.18 if alternative else .10)*glance),
                    ears=((-.06*orient,-.035*orient),(.12*orient,.09*orient)),
                    squint=1-.88*accent(t,.69,.75,.86) if state in ('blinkIdle','blinkSit') else 1)
    if state == 'ballToss':
        # Scoop low, send one paw up, then watch the invisible arc cross over
        # the forehead. The paw stays high long enough to read at game size.
        gather = accent(t,.025,.13,.25)
        reach = hold(t,.17,.31,.44,.64)
        arc = hold(t,.24,.40,.59,.84)
        track = beat(t,[(0,0),(.23,0),(.40,-.25),(.57,.26),(.73,.16),(.96,0),(1,0)])
        follow = hold(t,.27,.46,.65,.97)
        return dict(plant=True,
                    paws=((0,0,0),(.20*reach,-.17*reach,1.12*reach),(0,0,0),(0,0,0)),
                    chest=.13*gather-.17*arc, hips=.06*arc, roll=.07*reach,
                    lift=-.09*gather-.025*arc, back=.055*arc, side=-.045*reach,
                    head=(.025*track,0,.075*arc), look=(-.46*arc-.10*reach,-.07*reach,track),
                    ears=((-.17*arc,.06*arc),(-.12*arc,-.04*arc)),
                    tail=tail_pose(follow,(-.40,.05,.25,.32),-.15*track))
    if state == 'batToy':
        # A low hunting crouch, rear wiggle, then ONE lateral cut away from the
        # chest. Freeze the far-side follow-through before replacing the paw.
        crouch = hold(t,.02,.17,.70,.96)
        wiggle = (accent(t,.15,.20,.25)-accent(t,.25,.30,.35))
        cock = hold(t,.28,.40,.44,.52)
        swat = hold(t,.44,.52,.66,.88)
        tail = hold(t,.09,.26,.75,.98)
        return dict(plant=True,
                    paws=((-.025*crouch,0,0),
                          (-.10*cock+.32*swat,-.17*cock-.23*swat,.17*cock+.14*swat),(0,0,0),(0,0,0)),
                    chest=.25*crouch, hips=-.12*crouch+.055*wiggle,
                    roll=.07*cock-.13*swat, side=-.045*crouch+.035*wiggle-.025*swat,
                    lift=-.19*crouch, back=-.035*swat,
                    head=(.065*swat,-.10*crouch,-.055*crouch),
                    look=(.14*crouch,-.08*swat,-.18*cock+.29*swat),
                    ears=((.18*crouch,-.12*crouch),(.22*crouch,.16*crouch)),
                    tail=tail_pose(tail,(-1.10,-.12,.16,.22),-.20*swat+.10*wiggle))
    if state == 'yarnRoll':
        # Both paws reach forward close to the floor. Slow alternating presses
        # travel into the shoulders; the low chin stays over the work.
        low = hold(t,.04,.23,.74,.97)
        reach = hold(t,.12,.29,.73,.94)
        rhythm = math.sin((t-.29)*math.tau*3)*hold(t,.24,.32,.70,.82)
        left, right = max(0,rhythm), max(0,-rhythm)
        return dict(plant=True,
                    paws=((.025*reach,-.24*reach+.035*left,.075*left),
                          (-.025*reach,-.24*reach+.035*right,.075*right),(0,0,0),(0,0,0)),
                    chest=.29*low, hips=-.10*low, roll=.05*rhythm,
                    lift=-.22*low, back=-.035*low, side=.018*rhythm,
                    head=(.018*rhythm,-.14*low,-.10*low), look=(.27*low,.035*rhythm,0),
                    ears=((.22*low,-.20*low),(.22*low,.20*low)),
                    tail=tail_pose(hold(t,.11,.30,.79,.99),(-1.32,-.12,.12,.28),.035*rhythm))
    if state == 'featherChase':
        # Look up first, coil, then a two-paw forward pounce. The forepaws
        # land before the hind paws and the head arrives after the shoulders.
        watch = hold(t,.03,.16,.42,.56)
        track = beat(t,[(0,0),(.08,0),(.23,-.27),(.35,.25),(.48,0),(1,0)])
        gather = accent(t,.40,.54,.64)
        flight = beat(t,[(0,0),(.58,0),(.67,1),(.71,.85),(.79,0),(1,0)])
        fore_flight = beat(t,[(0,0),(.58,0),(.67,1),(.70,.85),(.76,0),(1,0)])
        reach = hold(t,.57,.67,.82,.96)
        replace = accent(t,.82,.88,.96)
        land = accent(t,.70,.78,.94)
        tail = hold(t,.11,.30,.83,.98)
        return dict(plant=True,
                    paws=((-.035*reach,-.24*reach,.24*(fore_flight-flight)+.07*replace),
                          (.035*reach,-.24*reach,.24*(fore_flight-flight)+.07*replace),
                          (0,.035*flight,.035*flight),(0,.035*flight,.035*flight)),
                    chest=-.08*watch+.25*gather+.18*land-.08*flight, hips=-.14*gather-.06*land,
                    lift=-.18*gather-.18*land-.015*watch, hop=.24*flight,
                    back=.035*gather-.065*flight,
                    head=(0,-.06*land,.05*watch-.025*land),
                    look=(-.32*watch+.16*gather+.13*land,0,track),
                    ears=((-.13*watch+.20*gather,.04*watch),(-.13*watch+.20*gather,-.04*watch)),
                    tail=tail_pose(tail,(-.90,-.06,.12,.18),-.25*track))
    if state in ('box1','box2','box3'):
        if state == 'box1':
            duck = hold(t,.32,.49,.69,.96)
            peek = accent(t,.08,.19,.31)
        elif state == 'box2':
            duck = accent(t,.03,.12,.26)+accent(t,.72,.84,.97)
            peek = hold(t,.19,.33,.63,.79)
        else:
            duck = hold(t,.02,.12,.25,.45)
            peek = hold(t,.32,.48,.67,.93)
        scan = accent(t,.34,.45,.55)-accent(t,.54,.65,.80)
        return dict(chest=.12*duck-.06*peek, hips=-.04*duck,
                    lift=-.025*duck, head=(0,-.045*duck,-.15*duck+.08*peek),
                    look=(.20*duck-.13*peek,0,.20*scan),
                    ears=((-.55*duck,-.30*duck),(-.55*duck,.30*duck)),
                    tail=tail_pose(max(duck,peek),(-.40,.22,.34,.25),.04*scan))
    if state == 'eating':
        meal = hold(t,.15,.30,.71,.83)
        swallow = accent(t,.72,.79,.88)
        return dict(hips=-.035*meal, roll=.015*meal,
                    look=(-.035*swallow,0,.025*swallow),
                    ears=((.16*meal,-.12*meal),(.12*meal,.16*meal)),
                    tail=tail_pose(meal,(-.85,.07,.17,.20),.025*swallow))
    if state == 'wash':
        wipe = hold(t,.10,.28,.69,.93)
        stroke = accent(t,.28,.39,.52)+accent(t,.55,.65,.79)
        return dict(chest=.035*wipe, roll=-.035*stroke,
                    head=(-.028*stroke,-.018*wipe,0), look=(.035*stroke,-.08*stroke,-.045*wipe),
                    ears=((.12*wipe,-.20*stroke),(.08*wipe,.06*wipe)),
                    tail=tail_pose(wipe,(-.65,-.08,.12,.23)))
    return None
