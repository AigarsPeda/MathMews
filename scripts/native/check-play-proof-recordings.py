"""Check real Play MP4s and native frame measurements for a variant manifest.

A take has three possible results: a measured failure, a verified assertion, or
an explicit gap. Accessibility bounds do not certify the contents of a canvas.
"""
import argparse
import json
from pathlib import Path

import cv2
import numpy as np


MODEL_IDS = ('play-proof-detail', 'play-proof-model', 'bridge-plot-frame')
CAPTION_IDS = ('play-proof-equation', 'fraction-solution-equation', 'line-solution-equation',
               'decimal-solution-equation', 'clock-solution-caption', 'jug-solution-caption',
               'money-solution-caption', 'bar-solution-caption')
# Published exceptions for these specific authored fixtures. All other proofs get the standard limit.
FIXTURE_BUDGETS = {
    'v2-medium-spatial-lesson-2-4': 3500,  # symmetry
    'v2-easy-multiplication-lesson-7-boss-1': 4500,  # nine rows
    'v2-hard-fractions-apply-1': 4500,  # eighteen objects
}

EDITOR_IDS = ('response-key-', 'bridge-digit-', 'geometry-key-', 'bridge-undo')


def bounds(node):
    r = node['frame']
    return (r['x'], r['y'], r['x'] + r['width'], r['y'] + r['height'])


def inside(box, outer, tolerance=1):
    return (box[2] > box[0] and box[3] > box[1] and box[0] >= outer[0] - tolerance
            and box[1] >= outer[1] - tolerance and box[2] <= outer[2] + tolerance
            and box[3] <= outer[3] + tolerance)


def clock_checks(events, budget, failures, pending):
    checks = [e for e in events if e['phase'] == 'check']
    if len(checks) != 1:
        failures.add('No unique fresh Check')
        return {}
    runs = {}
    for event in events:
        if event['phase'] == 'check':
            continue
        run = event.get('runId', max(runs, default=0))
        runs.setdefault(run, []).append(event)
    if not runs:
        pending.add('No playback event after Check')
    durations = {}
    for run, log in runs.items():
        phases = [e['phase'] for e in log]
        if 'ready' not in phases:
            pending.add('First paint and landing telemetry unavailable')
        if 'ready' in phases and 'playing' in phases:
            ready = next(e for e in log if e['phase'] == 'ready')
            playing = next(e for e in log if e['phase'] == 'playing')
            delay = playing['time'] - ready['time']
            if delay < 0 or delay > 200:
                failures.add(f'Run {run} first movement {delay} ms after readiness')
        if phases.count('settled') > 1 or phases.count('completed') > 1:
            failures.add(f'Run {run} completed twice')
        if 'settled' in phases and any(p in ('playing', 'paused', 'landing') for p in phases[phases.index('settled') + 1:]):
            failures.add(f'Run {run} restarted after settling')
        last = next((e for e in reversed(log) if e['phase'] in ('settled', 'completed')), None)
        start = checks[0]['time'] if run == 0 else log[0]['time']
        paused_at = None
        pause_ms = 0
        haptics = set()
        landed = 0
        skipped = False
        for event in log:
            phase = event['phase']
            if phase == 'paused' and paused_at is None:
                paused_at = event['time']
            elif phase in ('playing', 'skipped', 'settled') and paused_at is not None:
                pause_ms += event['time'] - paused_at
                paused_at = None
            if phase == 'landing':
                if event['landed'] != landed + 1:
                    failures.add(f'Run {run} repeated or missed a landing')
                landed = event['landed']
            if phase == 'skipped':
                skipped = True
            if phase == 'haptic':
                if run or skipped or event['landed'] in haptics or event['landed'] != landed:
                    failures.add(f'Run {run} requested a haptic outside a fresh landing')
                haptics.add(event['landed'])
        if last:
            active = last['time'] - start - pause_ms
            durations[run] = {'activeMs': active, 'pausedMs': pause_ms, 'landings': landed, 'haptics': len(haptics)}
            if active > budget:
                failures.add(f'Run {run} exceeded {budget} ms')
        elif 'playing' in phases:
            failures.add(f'Run {run} never settled')
    return durations


def contains_id(node, identifier):
    return node.get('AXUniqueId') == identifier or any(contains_id(child, identifier) for child in node.get('children', []))


def frame_checks(audit, screen, failures, pending, dock_scrolls):
    frames = audit.get('frames', [])
    if not frames:
        pending.add('Per-event native frame geometry unavailable')
    for index, frame in enumerate(frames):
        boxes = frame['boxes']
        def first(name):
            return next(iter(boxes.get('play-proof-' + name, [])), None)
        answer, controls, result = first('answer'), first('controls'), first('result')
        if not answer:  # Check can precede the native commit of the locked answer.
            if any(e['phase'] != 'check' and e.get('frame') == index for e in audit['events']):
                failures.add(f'Frame {index} missing locked answer')
            continue
        ceiling = controls or result
        # A dense XL proof can put the dock inside the same ScrollView as the board.
        # Each row must still fit inside the measured dock and viewport width.
        dock = first('scrolling-dock')
        scroll = first('scroll')
        boundary = screen
        if dock_scrolls and scroll:
            # Older recordings expose ancestry in the native tree but lack a per-event dock marker.
            boundary = (scroll[0], scroll[1], scroll[2], float('inf'))
            if dock:
                boundary = (max(dock[0], scroll[0]), max(dock[1], scroll[1]), min(dock[2], scroll[2]), dock[3])
            if not inside(scroll, screen):
                failures.add(f'Frame {index} invalid scrollable dock')
            if any(box and not inside(box, scroll) for box in (answer, controls, result)):
                pending.add('Scroll to the controls and activate the result action on device')
        if not result or not inside(answer, boundary) or not inside(result, boundary):
            failures.add(f'Frame {index} result or answer outside its container')
        if ceiling and answer[3] > ceiling[1] + 1:
            failures.add(f'Frame {index} answer overlaps controls')
        if controls and result and (not inside(controls, boundary) or controls[3] > result[1] + 1):
            failures.add(f'Frame {index} controls overlap result or screen edge')
        proof_lane = (*screen[:3], answer[1])
        for name in ('model', 'detail', 'caption', 'equation'):
            for box in boxes.get('play-proof-' + name, []):
                limit = scroll if scroll and name in ('model', 'detail') else proof_lane
                if dock_scrolls and name in ('model', 'detail') and scroll:
                    limit = (*scroll[:3], min(scroll[3], dock[1] if dock else answer[1]))
                if not inside(box, limit):
                    failures.add(f'Frame {index} {name} clipped')
        if not first('model') and not first('detail'):
            pending.add('Active geometric landmark unavailable for at least one measured frame')


def crop(frame, box, screen):
    sx, sy = frame.shape[1] / (screen[2]-screen[0]), frame.shape[0] / (screen[3]-screen[1])
    left, top, right, bottom = box
    return frame[max(0,round((top-screen[1])*sy)):round((bottom-screen[1])*sy),
                 max(0,round((left-screen[0])*sx)):round((right-screen[0])*sx)]


def verdict_mask(image, outcome):
    b, g, r = cv2.split(image.astype(np.int16))
    if outcome == 'correct':
        return (g > r + 30) & (g > b + 25)
    return (r > g + 65) & (r > b + 55)


def frame_number(image, screen):
    # Match the QA strip's black/white prefix before decoding its eight bits.
    height, width = image.shape[:2]
    sx = width / (screen[2] - screen[0]); sy = height / (screen[3] - screen[1])
    y = round(height - 5 * sy)
    pixels = [image[y, round(width * 0.18 + (3*i+1.5)*sx)].mean() for i in range(12)]
    if any(45 < lum < 210 for lum in pixels):
        return None
    bits = [int(lum <= 45) for lum in pixels]
    if bits[:4] != [1, 0, 1, 0]:
        return None
    return sum(bit << i for i, bit in enumerate(bits[4:]))


def model_features(image, screen, lane, fixture):
    """Count complete native glyphs or closed polygons above the dock for the fixed QA examples."""
    expected = {'v2-easy-multiplication-lesson-7-boss-1': 27,
                'v2-easy-spatial-lesson-2-4': 3, 'v2-medium-spatial-lesson-2-4': 2}
    if fixture not in expected:
        return None
    roi = crop(image, lane, screen)
    if not roi.size:
        return (0, expected[fixture])
    blue, green, red = cv2.split(roi.astype(np.int16))
    mice = fixture == 'v2-easy-multiplication-lesson-7-boss-1'
    silhouette = ((blue > red + 20) & (red > green + 14) & (green < 179)) if mice else ((blue > red + 35) & (green > red + 20))
    contours, _ = cv2.findContours(silhouette.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    count = 0
    for contour in contours:
        x, y, width, height = cv2.boundingRect(contour)
        # Reject pieces cut off by any edge of the measured viewport.
        if x == 0 or y == 0 or x + width >= roi.shape[1] or y + height >= roi.shape[0]:
            continue
        if mice:
            count += int(14 <= width <= 36 and 11 <= height <= 31 and cv2.contourArea(contour) > 90)
        else:
            count += int(width > 35 and height > 35 and cv2.contourArea(contour) > 800)
    return (count, expected[fixture])


def handoff_features(image, screen, lane, variant, clock_time=(11, 5)):
    """Recognize the authored objects shared by the editor and the first proof drawing."""
    roi = crop(image, lane, screen)
    if not roi.size:
        return []
    hue, sat, val = cv2.split(cv2.cvtColor(roi, cv2.COLOR_BGR2HSV))

    def components(mask):
        contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        return [(c, *cv2.boundingRect(c)) for c in contours]

    if variant == 'budget_plan':
        for c, _, _, w, h in components((hue >= 124) & (hue <= 155) & (sat > 45) & (val > 65)):
            corners = cv2.approxPolyDP(c, 0.045 * cv2.arcLength(c, True), True)
            if len(corners) == 4 and 8 <= w <= 36 and 8 <= h <= 36 and cv2.contourArea(c) > 0.55*w*h:
                return ['book']
        return []
    if variant == 'multiple_choice_money_change':
        apple = ((hue < 10) | (hue > 172)) & (sat > 75) & (val > 140)
        cookie = (hue > 11) & (hue < 36) & (sat > 130) & (val > 160)
        return [label for label, mask in [('apple', apple), ('cookie', cookie)]
                if any(8 <= w <= 48 and 8 <= h <= 48 and cv2.contourArea(c) > .45*w*h
                       for c, _, _, w, h in components(mask))]
    # Check a complete face at one time. The retained adjustable face can show the submitted time.
    hours, minutes = clock_time
    # A thin teal rim on the old face and the filled disk on the current face
    # both trace the circumference. Confirm the hour marks before probing hands.
    candidates = components((hue >= 79) & (hue <= 111) & (sat >= 12))
    for contour, x, y, w, h in candidates:
        if w < 100 or abs(w - h) > 5 or not .70 <= cv2.contourArea(contour) / (w * h) <= .83:
            continue
        cx, cy = x + (w - 1) / 2, y + (h - 1) / 2

        def has_ink(degrees, radius, max_value=150, allow_start_dot=False):
            angle = np.deg2rad(degrees)
            px = round(cx + w / 2 * radius * np.sin(angle))
            py = round(cy - h / 2 * radius * np.cos(angle))
            region = np.s_[py-2:py+3, px-2:px+3]
            dark = val[region] < max_value
            # The starting-minute marker can cover one fixed hour mark.
            if allow_start_dot:
                dark |= (hue[region] >= 10) & (hue[region] <= 32) & (sat[region] > 85)
            return dark.any()

        if sum(any(has_ink(angle, r, allow_start_dot=True) for r in (.87, .91, .95)) for angle in range(0, 360, 30)) < 12:
            continue
        marks = ['dial and hour marks']
        for label, degrees, radii in [('hour hand', 30 * (hours % 12) + minutes / 2, (.17, .26, .33)),
                                      ('minute hand', minutes * 6, (.34, .42, .50))]:
            if all(has_ink(degrees, radius, max_value=175) for radius in radii):
                marks.append(label)
        return marks
    return []


def video_checks(path, screen, answer, models, outcome, audit, info, failures, pending):
    capture = cv2.VideoCapture(str(path))
    # Simulator recordings are variable-frame-rate. Decode in order because
    # seeking to the reported last frame can land beyond the last actual PTS.
    size = (300, round(300*(screen[3]-screen[1])/(screen[2]-screen[0])))
    samples = []
    # The submitted row can move when the playback controls mount. Match the
    # final verdict at any vertical position in the dock, including the first
    # native paint before the event strip receives its next frame number.
    dock_search = (answer[0], screen[1] + (screen[3]-screen[1])*0.25, answer[2], screen[3])
    final_mark = None
    feature_counts = []
    handoff = []
    expected_handoff = {'budget_plan': ['book'], 'multiple_choice_money_change': ['apple', 'cookie'],
                        'multiple_choice_clock_start': ['dial and hour marks', 'hour hand', 'minute hand']}.get(info['variant'])
    first_lane = next((f['boxes']['play-proof-scroll'][0] for f in audit.get('frames', []) if f['boxes'].get('play-proof-scroll')), None)
    presented = {}
    stamped = audit.get('videoFrames')
    native_frames = audit.get('frames', [])
    ready_frame = next((e.get('frame') for e in audit.get('events', []) if e['phase'] == 'ready'), None)
    submitted_time = None
    if info['variant'] == 'multiple_choice_clock_start':
        parts = str(audit.get('check', {}).get('submitted', '')).split(':')
        if len(parts) == 2 and all(part.isdecimal() for part in parts):
            submitted_time = tuple(map(int, parts))
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        pts = round(capture.get(cv2.CAP_PROP_POS_MSEC))
        serial = frame_number(frame, screen) if stamped else None
        current_boxes = models
        if serial is not None and 0 < serial <= len(native_frames):
            index = serial - 1
            presented.setdefault(index, pts)
            boxes = native_frames[index]['boxes']
            current_boxes = boxes.get('play-proof-detail') or boxes.get('play-proof-model') or []
        image = cv2.resize(frame, size, interpolation=cv2.INTER_LINEAR)
        if serial and 0 < serial <= len(native_frames) and audit.get('check', {}).get('fontScale') == 1:
            boxes = native_frames[serial - 1]['boxes']
            for lane in boxes.get('play-proof-scroll', []):
                measured = model_features(image, screen, lane, audit['puzzleId'])
                if measured:
                    feature_counts.append((pts, *measured))
        if expected_handoff and first_lane and audit.get('check', {}).get('fontScale') == 1:
            marks = handoff_features(image, screen, first_lane, info['variant'])
            # The ready event can share the last native presentation of the editor.
            # Require the worked dial on the next distinct video presentation.
            if submitted_time and marks != expected_handoff and pts <= presented.get(ready_frame, float('inf')):
                outgoing = handoff_features(image, screen, first_lane, info['variant'], submitted_time)
                if len(outgoing) > len(marks):
                    marks = outgoing
            handoff.append((pts, marks))
        face = crop(image, answer, screen)
        if not face.size:
            failures.add('Marked answer outside recorded pixels')
            break
        final_mark = verdict_mask(face, outcome).astype(np.uint8)
        dock = verdict_mask(crop(image, dock_search, screen), outcome)
        mask = np.packbits(dock, axis=1)
        blank = False
        for box in current_boxes:
            roi = crop(image, box, screen)
            extrema = cv2.minMaxLoc(cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)) if roi.size else (0, 0)
            if extrema[1] - extrema[0] < 8:
                blank = True
        if blank and serial and 0 < serial <= len(native_frames) and current_boxes:
            failures.add(f'Empty painted model in measured frame {serial - 1}')
        samples.append((pts, mask, blank))
    capture.release()
    if feature_counts:
        incomplete = [(pts, count) for pts, count, target in feature_counts if count != target]
        info['paintedFeatures'] = {'expected': feature_counts[0][2], 'sampledVideoFrames': len(feature_counts),
                                   'minimum': min(count for _, count, _ in feature_counts), 'firstMismatch': next(iter(incomplete), None)}
        if incomplete:
            failures.add(f'Incomplete model at {incomplete[0][0]} ms: {incomplete[0][1]} of {feature_counts[0][2]} complete features')
    if not samples:
        failures.add('Undecodable recording')
        return None
    if stamped:
        info['nativeFramePtsMs'] = presented
        required = {e['frame'] for e in audit['events'] if 'frame' in e and e['phase'] in ('ready', 'landing', 'settled', 'skipped')}
        missing = sorted(required - presented.keys())
        if missing:
            pending.add('Native frames without a distinguishable video PTS: ' + str(missing))
    if final_mark is None or final_mark.sum() < 3:
        pending.add('Verdict color unavailable in final video frame')
        return None
    entry_seen = False
    start = None
    blank = []
    for pts, mask, empty in samples:
        dock = np.unpackbits(mask, axis=1)[:, :final_mark.shape[1]]
        hits = cv2.matchTemplate(dock, final_mark, cv2.TM_CCORR_NORMED)
        coverage = float(cv2.minMaxLoc(hits)[1])
        if coverage < 0.2 and start is None:
            entry_seen = True
        if start is None and entry_seen and coverage >= 0.72:
            start = pts
        if start is not None and empty:
            blank.append(pts)
    if start is None:
        failures.add('Video never transitions from entry to the settled verdict')
    if handoff and start is not None and ready_frame in presented:
        first_proof = next((pts for pts, _ in handoff if pts > presented[ready_frame]), presented[ready_frame])
        transition = [(pts, seen) for pts, seen in handoff if start <= pts <= first_proof]
        missing = [(pts, sorted(set(expected_handoff) - set(seen))) for pts, seen in transition if seen != expected_handoff]
        info['transitionFeatures'] = {'expected': expected_handoff, 'frames': len(transition), 'firstMissing': next(iter(missing), None)}
        if not transition:
            pending.add('No video frame between the verdict and model readiness')
        if missing:
            failures.add(f'Incomplete first checked picture at {missing[0][0]} ms: missing {", ".join(missing[0][1])}')
    if blank:
        pending.add(f'Blank settled-model footprint at {blank[0]} ms; compare with moving geometry')
    return start


def inspect(folder, case, outcome, text):
    base = folder / case['variant']
    failures, pending = set(), set()
    info = {'id': case['id'], 'variant': case['variant']}
    def finish():
        return {**info, 'failures': sorted(failures), 'unverified': sorted(pending)}
    if not all(base.with_suffix(s).is_file() for s in ('.mp4', '.jpg', '.json')):
        failures.add('Missing recording, sheet or native snapshot')
        return finish()
    captured = json.loads(base.with_suffix('.json').read_text())
    audit, nodes = captured['audit'], captured['native']
    if audit.get('puzzleId') != case['id'] or not nodes:
        failures.add('Wrong or absent native puzzle capture')
        return finish()
    info['budgetMs'] = case.get('budgetMs', FIXTURE_BUDGETS.get(case['id'], 2800))
    info['runs'] = clock_checks(audit['events'], info['budgetMs'], failures, pending)
    screen = bounds(nodes[0])
    dock_scrolls = any(n.get('AXUniqueId') == 'play-model-scroll' and contains_id(n, 'play-answer-dock') for n in nodes)
    frame_checks(audit, screen, failures, pending, dock_scrolls)
    buttons = [n for n in nodes if n.get('type') == 'Button']
    marked = [n for n in buttons if n.get('AXValue') in text[outcome]]
    results = [n for n in buttons if n.get('AXLabel') in text['result']]
    replay = [n for n in buttons if n.get('AXLabel') in text['replay']]
    if len(marked) != 1 or not results:
        failures.add('Missing unique marked submission or result action')
        return finish()
    answer = bounds(marked[0]); info['submitted'] = marked[0]['AXLabel']
    check = audit.get('check')
    if check:
        info['check'] = check
        template = text['answerLabel'][check['locale']]
        if info['submitted'] != template.replace('{{answer}}', check['submitted']):
            failures.add('Marked response differs from frozen submission')
    if marked[0]['enabled']:
        failures.add('Submitted answer is interactive')
    if not replay and outcome == 'correct':
        failures.add('Watch again absent at settle')
    result = bounds(results[0]); controls = bounds(replay[0]) if replay else result
    if not inside(answer, screen) or answer[3] > controls[1]+1 or (replay and controls[3] > result[1]+1):
        failures.add('Settled dock rows clipped or overlapping')
    for n in [*results, *replay]:
        if min(n['frame']['height'], n['frame']['width']) < 43.99:
            failures.add('Active control smaller than 44 pt')
    if any(n['enabled'] and (n.get('AXUniqueId') or '').startswith(EDITOR_IDS) for n in nodes):
        failures.add('Active editing control during playback')
    models = [bounds(n) for n in nodes if n.get('AXUniqueId') in MODEL_IDS]
    captions = [bounds(n) for n in nodes if n.get('AXUniqueId') in CAPTION_IDS]
    lane = (*screen[:3], answer[1])
    if any(not inside(box, lane) for box in models + captions):
        failures.add('Settled model or equation crosses available bounds')
    if not models:
        last_frame = next(iter(reversed(audit.get('frames', []))), {})
        boxes = last_frame.get('boxes', {})
        models = boxes.get('play-proof-detail') or boxes.get('play-proof-model') or []
    if not models:
        pending.add('Family model landmark unavailable')
    if any('must be rendered within a <Text>' in (n.get('AXLabel') or '') for n in nodes):
        failures.add('Native text warning overlays result action')
    info['paintedVerdictPtsMs'] = video_checks(base.with_suffix('.mp4'), screen, answer, models, outcome, audit, info, failures, pending)
    if 'paintedFeatures' not in info:
        pending.add('Check family mathematical features against recorded pixels')
    return finish()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('captures', type=Path)
    parser.add_argument('--outcome', choices=('correct', 'wrong'), default='correct')
    parser.add_argument('--report', type=Path, required=True)
    parser.add_argument('--variants', nargs='*')
    args = parser.parse_args()
    cv2.setNumThreads(1)
    root = Path(__file__).resolve().parents[2]
    locales = [json.loads(p.read_text()) for p in (root/'locales').glob('*.json')]
    text = {'result': {loc['play'][key] for key in ('seeResult','tryAgain') for loc in locales},
            'correct': {loc['play']['answerCorrect'] for loc in locales},
            'wrong': {loc['play']['answerWrong'] for loc in locales},
            'replay': {loc['reveal']['replay'] for loc in locales}}
    text['answerLabel'] = {p.stem: json.loads(p.read_text())['play']['answerLabel'] for p in (root/'locales').glob('*.json')}
    cases = json.loads(args.manifest.read_text())
    reports = [inspect(args.captures, c, args.outcome, text) for c in cases if not args.variants or c['variant'] in args.variants]
    args.report.write_text(json.dumps(reports, ensure_ascii=False, indent=2) + '\n')
    failed = sum(bool(r['failures']) for r in reports)
    open_items = sum(bool(r['unverified']) for r in reports)
    print(f'{len(reports)} takes, {failed} with failures, {open_items} with outstanding checks')
    return int(bool(failed or open_items))


if __name__ == '__main__':
    raise SystemExit(main())
