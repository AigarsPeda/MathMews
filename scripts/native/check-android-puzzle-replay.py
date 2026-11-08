"""Replay and process-restart checks. Requires uiautomator2==3.7.1 and a dev server."""
import argparse
import json
import os
import pathlib
import re
import sqlite3
import subprocess
import tempfile
import time
import traceback
import xml.etree.ElementTree as ET
import uiautomator2

ROOT = pathlib.Path(__file__).resolve().parents[2]
PACKAGE = 'com.mathmews.app'
ADB = pathlib.Path(os.environ.get('ANDROID_HOME', str(pathlib.Path.home() / 'Library/Android/sdk'))) / 'platform-tools/adb'
parser = argparse.ArgumentParser()
parser.add_argument('--device', required=True)
parser.add_argument('--port', type=int, default=8082)
parser.add_argument('--simple-graphics', action='store_true')
parser.add_argument('--output', default=str(ROOT / 'docs/qa/puzzle-replay/2026-11-08/android'))
args = parser.parse_args()
output = pathlib.Path(args.output)
output.mkdir(parents=True, exist_ok=True)
events = []
restarts = []
scenarios = []
gc_checks = []
device = None


def adb(*parts, check=True, binary=False):
    result = subprocess.run([str(ADB), '-s', args.device, *parts], capture_output=True, timeout=60)
    if check and result.returncode:
        raise RuntimeError(f'adb {parts}: {result.stderr.decode(errors="replace")} {result.stdout.decode(errors="replace")}')
    return result.stdout if binary else result.stdout.decode(errors='replace').strip()


def log(message):
    print(message, flush=True)
    events.append({'at': time.time(), 'message': message})


def ui():
    # The clock changes accessibility once per second. The shell dumper can fail
    # its idle wait and leave a stale XML file; query the live instrumentation.
    raw = device.dump_hierarchy(compressed=True)
    return list(ET.fromstring(raw).iter('node'))


def find(nodes, label):
    return next((n for n in nodes if label in [n.get('text'), n.get('content-desc'), n.get('resource-id')]
                 or n.get('resource-id', '').endswith('/' + label)), None)


def click(node):
    bounds = [int(x) for x in re.findall(r'\d+', node.get('bounds', ''))]
    assert len(bounds) == 4 and bounds[2] > bounds[0] and bounds[3] > bounds[1], node.attrib
    adb('shell', 'input', 'tap', str((bounds[0] + bounds[2]) // 2), str((bounds[1] + bounds[3]) // 2))


def dismiss_warning(nodes):
    banner = next((n for n in nodes if n.get('clickable') == 'true' and n.get('content-desc', '').startswith("!, Can't perform a React state update")), None)
    if banner is None:
        return False
    box = [int(x) for x in re.findall(r'\d+', banner.get('bounds', ''))]
    for node in reversed(nodes):
        if node.get('clickable') != 'true' or node.get('text') or node.get('content-desc'):
            continue
        bounds = [int(x) for x in re.findall(r'\d+', node.get('bounds', ''))]
        if len(bounds) == 4 and bounds[0] > box[0] + (box[2] - box[0]) * .8 and box[1] <= bounds[1] < bounds[3] <= box[3]:
            click(node)
            log('Dismissed the recorded development warning overlay')
            return True
    return False


def wait(label, timeout=25, press=False):
    until = time.monotonic() + timeout
    while time.monotonic() < until:
        nodes = ui()
        if dismiss_warning(nodes):
            continue
        node = find(nodes, label)
        if node is not None:
            if press and node.get('enabled') == 'false':
                time.sleep(.1)
                continue
            if press:
                click(node)
            return node
        time.sleep(.2)
    raise AssertionError(f'Missing {label}; visible labels: {[n.get("text") or n.get("content-desc") for n in nodes if n.get("text") or n.get("content-desc")]}')


def tap(label):
    log('Tap ' + label)
    wait(label, press=True)


def handle_startup(nodes):
    close = find(nodes, 'Close')
    if close is not None and find(nodes, 'Reload') is not None:
        click(close)
        return True
    for label in ['Continue', 'Allow', 'While using the app']:
        node = find(nodes, label)
        if node is not None:
            click(node)
            return True
    return False


def open_fixture(initial=False):
    if initial:
        adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d',
            f'exp+mathmews://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A{args.port}', PACKAGE)
    else:
        adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.MAIN', '-c', 'android.intent.category.LAUNCHER',
            '-n', PACKAGE + '/.MainActivity')
    until = time.monotonic() + 180
    while time.monotonic() < until:
        nodes = ui()
        if any(find(nodes, label) is not None for label in ['QA Seed replay', 'Meet your cat!', 'Open settings']):
            break
        handle_startup(nodes)
        time.sleep(.3)
    else:
        raise AssertionError('Android app did not finish startup')
    adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', 'mathmews://android-replay-qa',
        '-n', PACKAGE + '/.MainActivity')
    wait('QA Resume disk replay', timeout=40)
    # Android can expose underlying route nodes while the loading cover still
    # intercepts touches. Wait for the actual cover to disappear before acting.
    until = time.monotonic() + 90
    clear_frames = 0
    while time.monotonic() < until:
        nodes = ui()
        covered = find(nodes, 'Math Mews') is not None or find(nodes, 'Loading game') is not None
        clear_frames = 0 if covered else clear_frames + 1
        if clear_frames >= 3:
            break
        time.sleep(.3)
    else:
        raise AssertionError('The startup loading cover did not disappear')
    wait('QA graphics ' + ('simple' if args.simple_graphics else '3d'))
    if not initial:
        disk_matches()
    # Accessibility exposes the destination before its native 220 ms push ends.
    time.sleep(.35)


def disk_matches():
    wait('QA disk matches')


def run_snapshot():
    row = wait('cold-run')
    text = row.get('text') or row.get('content-desc')
    parts = text.removeprefix('QA run ').split('|')
    assert len(parts) == 5, parts
    return {'id': parts[0], 'deadlineAt': int(parts[1]), 'puzzleId': parts[2], 'status': parts[3], 'solved': int(parts[4])}


def wait_run(predicate, timeout=20):
    until = time.monotonic() + timeout
    while time.monotonic() < until:
        snapshot = run_snapshot()
        if predicate(snapshot):
            return snapshot
        time.sleep(.1)
    raise AssertionError(f'Run did not reach the expected checkpoint: {snapshot}')


def select_pace(mode):
    tap('pace-' + mode)
    until = time.monotonic() + 10
    while time.monotonic() < until:
        node = find(ui(), 'pace-' + mode)
        if node is not None and node.get('checked') == 'true':
            return
        time.sleep(.1)
    raise AssertionError('Pace selection did not update: ' + mode)


def second_open(lives=3):
    row = wait('cold-unlock')
    assert (row.get('text') or row.get('content-desc')) == f'QA level 2 open, lives {lives}', row.attrib
    wait('QA graphics ' + ('simple' if args.simple_graphics else '3d'))


def answer(value, result='Next puzzle'):
    tap('Answer ' + value)
    tap('Check answer')
    wait(result)


def start_timed():
    tap('QA Seed replay')
    select_pace('timed')
    tap('Start challenge')
    snapshot = wait_run(lambda run: run['status'] == 'active' and run['deadlineAt'] > time.time() * 1000)
    disk_matches()
    second_open()
    return snapshot


def raw_disk():
    """Copy the closed app's actual SQLite save, including any WAL, and inspect it on the host."""
    with tempfile.TemporaryDirectory(prefix='brainpet-android-db-') as temp:
        directory = pathlib.Path(temp)
        for name in ['RKStorage', 'RKStorage-wal', 'RKStorage-shm', 'RKStorage-journal']:
            data = adb('exec-out', 'run-as', PACKAGE, 'cat', 'databases/' + name, check=False, binary=True)
            if data and not data.startswith(b'cat:'):
                (directory / name).write_bytes(data)
        with sqlite3.connect(directory / 'RKStorage') as connection:
            rows = connection.execute("SELECT key,value FROM catalystLocalStorage WHERE key LIKE '%/game-save'").fetchall()
        assert len(rows) == 1, 'Expected one production save key'
        return json.loads(rows[0][1])


def configure_graphics():
    # Set the app's existing preference on the disposable emulator while stopped.
    # Keep every other SQLite row, including the production player save.
    with tempfile.TemporaryDirectory(prefix='brainpet-android-graphics-') as temporary:
        directory = pathlib.Path(temporary)
        for name in ['RKStorage', 'RKStorage-wal', 'RKStorage-shm', 'RKStorage-journal']:
            data = adb('exec-out', 'run-as', PACKAGE, 'cat', 'databases/' + name, check=False, binary=True)
            if data and not data.startswith(b'cat:'):
                (directory / name).write_bytes(data)
        with sqlite3.connect(directory / 'RKStorage') as connection:
            connection.execute('CREATE TABLE IF NOT EXISTS catalystLocalStorage (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
            connection.execute('INSERT OR REPLACE INTO catalystLocalStorage(key,value) VALUES (?,?)',
                               ('@mathmews/graphics-mode', 'simple' if args.simple_graphics else '3d'))
            connection.commit()
            with sqlite3.connect(directory / 'prepared.db') as prepared:
                connection.backup(prepared)
        adb('push', str(directory / 'prepared.db'), '/data/local/tmp/brainpet-replay-storage.db')
        adb('shell', 'run-as', PACKAGE, 'mkdir', '-p', 'databases')
        adb('shell', 'run-as', PACKAGE, 'cp', '/data/local/tmp/brainpet-replay-storage.db', 'databases/RKStorage')
        adb('shell', 'run-as', PACKAGE, 'rm', '-f', 'databases/RKStorage-wal', 'databases/RKStorage-shm', 'databases/RKStorage-journal')
        adb('shell', 'rm', '/data/local/tmp/brainpet-replay-storage.db')


def restart(original, task, solved, status='active', lives=3, after_deadline=False):
    pid = adb('shell', 'pidof', PACKAGE)
    assert pid, 'App must be running before force-stop'
    adb('shell', 'am', 'force-stop', PACKAGE)
    assert not adb('shell', 'pidof', PACKAGE, check=False), 'Android process must be fully stopped'
    saved = raw_disk()
    saved_run = saved['progress']['challengeAttempt']
    assert saved_run['id'] == original['id'] and saved_run['deadlineAt'] == original['deadlineAt']
    assert all(f'v2-easy-cat-plans-picnic-{i}' in saved['progress']['completedPuzzleIds'] for i in range(1, 11))
    if after_deadline:
        assert original['deadlineAt'] > time.time() * 1000, 'Stop the app before its deadline'
        delay = max(0, original['deadlineAt'] / 1000 - time.time() + 1)
        time.sleep(delay)
    else:
        time.sleep(2)
    open_fixture()
    restored = run_snapshot()
    assert restored == {**original, 'puzzleId': f'v2-easy-cat-plans-picnic-{task}', 'solved': solved, 'status': status}, restored
    second_open(lives)
    new_pid = adb('shell', 'pidof', PACKAGE)
    assert new_pid and new_pid != pid, 'A new app process must load the saved checkpoint'
    restarts.append({'old_pid': pid, 'new_pid': new_pid, 'saved_run': {
        'id': saved_run['id'], 'deadlineAt': saved_run['deadlineAt'], 'puzzleId': saved_run['puzzleId'], 'status': saved_run['status']},
        'restored': restored, 'level_2_unlocked': True, 'lives': lives})
    log(f'Android force-stop/relaunch passed: task {task}, {status}, same deadline, level 2 open')


def screenshot(name):
    (output / (name + '.png')).write_bytes(adb('exec-out', 'screencap', '-p', binary=True))


def full_replay():
    tap('QA Seed full replay')
    for value in ['10', '5', '11:00', '8', '600', '2', '2']:
        answer(value)
        tap('Next puzzle')
        second_open()
    select_pace('timed')
    tap('Start challenge')
    original = wait_run(lambda run: run['status'] == 'active' and run['deadlineAt'] > time.time() * 1000)
    disk_matches()
    for value in ['10:00', '4']:
        answer(value)
        tap('Next puzzle')
        second_open()
        current = run_snapshot()
        assert current['deadlineAt'] == original['deadlineAt'] and current['id'] == original['id'], (original, current)
    answer('3', 'Next level')
    screenshot('full-replay-next-level')
    tap('Next level')
    wait('Answer 13')  # First task in "Make a reading corner".
    second_open()
    scenarios.append('Full ten-task timed replay and opening level 2')
    log('Android full replay passed: every Next puzzle stayed in the level; level 2 opens')


def cold_replay():
    original = start_timed()
    restart(original, 8, 0)
    tap('QA Resume disk replay')
    answer('10:00')
    # Keep the success sheet open while killing the app.
    restart(original, 9, 1)
    tap('QA Resume disk replay')
    answer('4')
    tap('Next puzzle')
    disk_matches()
    restart(original, 10, 2)
    tap('QA Resume disk replay')
    answer('3', 'Next level')
    tap('Next level')
    wait('Answer 13')
    second_open()
    screenshot('cold-replay-level-two')
    scenarios.append('Three cold restarts before an answer, with result open, and between later tasks; finish into level 2')


def closed_expiry():
    start_timed()
    answer('10:00')
    tap('Next puzzle')
    prior_deadline = run_snapshot()['deadlineAt']
    tap('QA Near deadline')
    original = wait_run(lambda run: 0 < run['deadlineAt'] < prior_deadline)
    disk_matches()
    restart(original, 8, 0, status='expired', lives=2, after_deadline=True)
    restart(original, 8, 0, status='expired', lives=2)
    tap('QA Resume disk replay')
    wait('Try again')
    second_open(2)
    select_pace('untimed')
    tap('Try again')
    for value in ['10:00', '4']:
        answer(value)
        tap('Next puzzle')
        second_open(2)
    answer('3', 'Next level')
    tap('Next level')
    wait('Answer 13')
    second_open(2)
    screenshot('expired-replay-untimed-retry-level-two')
    scenarios.append('Deadline expires while force-stopped; one-life loss survives another restart; untimed retry finishes into level 2')


def startup_gc():
    if args.simple_graphics:
        return
    # Keep the real home renderer mounted while ART repeatedly collects its heap.
    adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', 'mathmews:///',
        '-n', PACKAGE + '/.MainActivity')
    wait('Open settings', timeout=40)
    time.sleep(5)
    nodes = list(ET.fromstring(device.dump_hierarchy(compressed=False)).iter('node'))
    assert any(n.get('class') == 'android.view.TextureView' for n in nodes), 'The native 3D surface must be mounted'
    screenshot('normal-3d-home-before-gc')
    pid = adb('shell', 'pidof', PACKAGE)
    for index in range(3):
        path = f'/data/local/tmp/brainpet-replay-gc-{index}.hprof'
        adb('shell', 'rm', '-f', path)
        response = adb('shell', 'am', 'dumpheap', '-g', PACKAGE, path)
        assert 'Exception' not in response, response
        until = time.monotonic() + 40
        size = 0
        while time.monotonic() < until:
            assert adb('shell', 'pidof', PACKAGE, check=False) == pid, 'Renderer process died during forced GC'
            raw_size = adb('shell', 'stat', '-c', '%s', path, check=False)
            if raw_size.isdigit() and int(raw_size) > 100000:
                size = int(raw_size)
                break
            time.sleep(.3)
        assert size > 100000, 'Forced GC must finish and produce a managed heap dump'
        wait('Open settings')
        gc_checks.append({'pid': pid, 'forced_collection': index + 1, 'heap_dump_bytes': size})
        adb('shell', 'rm', '-f', path)
        log(f'Normal 3D renderer survived forced garbage collection {index + 1}')
    # The original startup failure appeared within 39 seconds on this emulator.
    for _ in range(45):
        assert adb('shell', 'pidof', PACKAGE, check=False) == pid, '3D startup soak must retain the same process'
        time.sleep(1)
    wait('Open settings')
    screenshot('normal-3d-home-after-gc')
    open_fixture()
    second_open(2)
    scenarios.append('Normal 3D home renders through three forced garbage collections and a 45-second startup soak without fallback')


fixture = ROOT / 'app/android-replay-qa.tsx'
assert args.device.startswith('emulator-'), 'Use a disposable emulator for seeded progress'
assert 'BrainPet_Replay_QA' in adb('emu', 'avd', 'name'), 'Use the dedicated BrainPet_Replay_QA emulator'
boot_deadline = time.monotonic() + 120
while adb('shell', 'getprop', 'sys.boot_completed', check=False) != '1':
    assert time.monotonic() < boot_deadline, 'Android emulator did not finish booting'
    time.sleep(1)
source = ROOT / 'scripts/native/puzzle-replay/cold-fixture.tsx'
with fixture.open('x') as handle:
    handle.write(source.read_text())
started = time.time()
try:
    adb('reverse', f'tcp:{args.port}', f'tcp:{args.port}')
    adb('shell', 'am', 'force-stop', PACKAGE)
    adb('logcat', '-c', '-b', 'crash')
    device = uiautomator2.connect(args.device)
    device.jsonrpc.setConfigurator({'waitForIdleTimeout': 0, 'waitForSelectorTimeout': 0})
    configure_graphics()
    # Android's DevSettings setter reloads JS even if the value is unchanged.
    # Configure the disposable app's preference before launch instead.
    preferences_path = 'shared_prefs/' + PACKAGE + '_preferences.xml'
    adb('shell', 'run-as', PACKAGE, 'mkdir', '-p', 'shared_prefs')
    raw_preferences = adb('exec-out', 'run-as', PACKAGE, 'cat', preferences_path, check=False)
    preferences = ET.fromstring(raw_preferences) if raw_preferences.startswith('<?xml') else ET.Element('map')
    hot = next((n for n in preferences if n.get('name') == 'hot_module_replacement'), None)
    if hot is None:
        hot = ET.SubElement(preferences, 'boolean', {'name': 'hot_module_replacement'})
    hot.set('value', 'false')
    with tempfile.TemporaryDirectory(prefix='brainpet-android-devprefs-') as temporary:
        path = pathlib.Path(temporary) / 'preferences.xml'
        path.write_bytes(ET.tostring(preferences, encoding='utf-8', xml_declaration=True))
        adb('push', str(path), '/data/local/tmp/brainpet-replay-devprefs.xml')
        adb('shell', 'run-as', PACKAGE, 'cp', '/data/local/tmp/brainpet-replay-devprefs.xml', preferences_path)
        adb('shell', 'rm', '/data/local/tmp/brainpet-replay-devprefs.xml')
    open_fixture(initial=True)
    log('Android production provider fixture is ready')
    full_replay()
    cold_replay()
    closed_expiry()
    startup_gc()
    crashes = adb('logcat', '-d', '-b', 'crash', '-v', 'brief')
    (output / 'native-crashes.log').write_text(crashes + '\n')
    assert PACKAGE not in crashes and 'om.mathmews.app' not in crashes, 'No native app crash is allowed during the suite'
    result = {'result': 'passed', 'platform': 'Android', 'device': args.device,
              'android_release': adb('shell', 'getprop', 'ro.build.version.release'),
              'api': adb('shell', 'getprop', 'ro.build.version.sdk'),
              'dev_server_port': args.port, 'fast_refresh': 'disabled before launch',
              'graphics_mode': 'simple' if args.simple_graphics else '3d',
              'scenarios': scenarios, 'process_restarts': restarts, 'elapsed_seconds': round(time.time() - started, 2),
              'forced_gc_checks': gc_checks,
              'persistence': 'Production GameProvider, AsyncStorage SQLite save, native Android views and result sheets',
              'test_setup': 'Disposable real player profile; production commands seed completed level 1. No memory save is supplied after restart.'}
    (output / 'test-result.json').write_text(json.dumps(result, indent=2) + '\n')
    log(f'Android replay suite passed: {len(scenarios)} scenarios, {len(restarts)} real process restarts')
except Exception:
    screenshot('failure')
    (output / 'failure.txt').write_text(traceback.format_exc())
    raise
finally:
    (output / 'events.json').write_text(json.dumps(events, indent=2) + '\n')
    adb('shell', 'am', 'force-stop', PACKAGE, check=False)
    fixture.unlink()
