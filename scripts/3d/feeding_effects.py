"""Small meal effects authored in each feeder's local coordinates."""
import math

FEEDING_EFFECT_IDS = ('feedingTile', 'feedingPebble', 'foodTrailTray', 'kibbleDispenser', 'lickingPad')


def build_feeding_effect(id, h):
    pieces = []
    count = {'feedingTile': 6, 'feedingPebble': 6, 'foodTrailTray': 9,
             'kibbleDispenser': 8, 'lickingPad': 6}[id]
    for i in range(count):
        name = 'Food smear' if id == 'lickingPad' and i < 4 else 'Wet food splash' if id in ('feedingTile', 'lickingPad') else 'Spilled kibble'
        obj = h['sphere'](f'{name} {i + 1}', (0, 0, 0), (.03, .03, .03),
                          h['material']('Wet feeder food', 'B67A58') if id in ('feedingTile', 'lickingPad') else 'brown' if i % 2 else 'gold')
        pieces.append(obj)
    pose_feeding_effect(id, pieces, 0, h)
    return pieces


def pose_feeding_effect(id, pieces, t, h):
    contact = h['care_action_time']('eating', t)
    cleanup = 1 - h['smoothstep']((t - .875) / .125)
    for i, obj in enumerate(pieces):
        born = .27 + (i - 4) * .16 if id == 'lickingPad' and i >= 4 else .17 + i * (.13 if id == 'lickingPad' else .065)
        flight = max(0, min(1, (contact - born) / .12))
        appear = h['smoothstep']((contact - born) / .012) * cleanup
        angle = (-2.7, -.4, -1.6, -2.3, -.8, -2.9, -1.2, -.15, 1.4)[i]
        if id == 'lickingPad' and i < 4:
            # A lick spreads food along a groove without throwing dry crumbs.
            y = (-.12, -.04, .12, .20)[i]
            obj.location = (.08 + .09 * flight, y, .067)
            obj.scale = ((.025 + .09 * flight) * appear, .024 * appear, .003 * appear)
            obj.rotation_euler = (0, 0, 0)
            continue
        if id == 'feedingTile':
            start = (.11 * math.cos(angle), .10 * math.sin(angle), .13)
            radius = (.43 + .012 * i) / max(abs(math.cos(angle)), abs(math.sin(angle)))
            end = (radius * math.cos(angle), radius * math.sin(angle), .006)
            arc = .18
            landed = h['smoothstep']((flight - .80) / .20)
            size = (.026 + .038 * landed, .020 + .024 * landed, .025 - .021 * landed)
        elif id == 'lickingPad':
            y = -.12 if i == 4 else .12
            start, end = (.17, y, .075), (.43, y, .006)
            arc = .10
            landed = h['smoothstep']((flight - .80) / .20)
            size = (.017 + .018 * landed, .014 + .011 * landed, .017 - .013 * landed)
        elif id == 'feedingPebble':
            start = (.11 * math.cos(angle), .09 * math.sin(angle), .12)
            end = ((.46 + .015 * i) * math.cos(angle), (.39 + .015 * i) * math.sin(angle), .038)
            arc, size = .20, (.033, .028, .025)
        elif id == 'foodTrailTray':
            spot = i % 3
            x, y = ((-.34, .06), (0, -.06), (.34, .06))[spot]
            start = (x, y, .12)
            end = (x + .10 * math.sin(i * 2.4), (-1 if i % 2 else 1) * (.35 + .03 * (i // 3)), .034)
            arc, size = .15, (.031, .026, .025)
        else:
            # Kibble trickles from the dispenser's low front outlet.
            start = (.018 * math.sin(i), -.185, .15)
            end = (.16 * math.sin(i * 2.4), -.42 - .035 * i, .04)
            arc, size = .08, (.035, .029, .027)
        position = [a + (b - a) * flight for a, b in zip(start, end)]
        wet = id in ('feedingTile', 'lickingPad')
        bounce = 0 if wet else .045 * math.sin(math.pi * max(0, min(1, (contact - born - .12) / .09)))
        position[2] += arc * 4 * flight * (1 - flight) + bounce
        obj.location = position
        obj.scale = tuple(value * appear for value in size)
        obj.rotation_euler = (0, 0, angle) if wet else (flight * 2.4, flight * 3.1, angle)
