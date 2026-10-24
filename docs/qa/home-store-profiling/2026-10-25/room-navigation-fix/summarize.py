"""Summarize the captured React commits and JS animation-frame gaps."""
import gzip
import json
import statistics
from pathlib import Path


def frame_summary(capture):
    gaps = sorted(frame['ms'] for frame in capture['frames'])
    return dict(durationMs=capture['duration'], samples=len(gaps),
                medianGapMs=statistics.median(gaps), p95GapMs=gaps[int(len(gaps) * .95)],
                maxGapMs=max(gaps), gapsOver50Ms=sum(gap > 50 for gap in gaps))


def summarize(capture):
    names = {int(key.split(':')[-1]): name or '' for key, name in capture['names'].items()}
    commits = [commit for profile in capture['profiles'] for root in profile['dataForRoots'] for commit in root['commitData']]
    def describe(commit):
        changes = dict(commit['changeDescriptions'] or [])
        stages = [dict(fiberId=key, ms=duration, changedProps=changes.get(key, {}).get('props'))
                  for key, duration in commit['fiberActualDurations'] if 'PetStage' in names.get(key, '')]
        menus = sum('RoomActionMenu' in names.get(key, '') for key, _ in commit['fiberActualDurations'])
        return dict(reactMs=commit['duration'], stages=stages, roomActionMenuUpdates=menus)
    navigation = [commit for commit in commits if any('PetStage' in names.get(key, '') and
                  'roomVisible' in (change.get('props') or []) for key, change in commit['changeDescriptions'] or [])]
    return dict(reactCommitCount=len(commits), peakCommit=describe(max(commits, key=lambda commit: commit['duration'])),
                navigationCommits=[describe(commit) for commit in navigation],
                frames=frame_summary(capture),
                visibleRoomSequence=[dict(atMs=state['at'], rooms=[room['id'] for room in state['rooms'] if room['visible']],
                                         pendingTransition=any(room['slide'] for room in state['rooms'])) for state in capture['states']],
                layoutsUnchangedDuringCapture=[room['layout'] for room in capture['initial']] == [room['layout'] for room in capture['final']])


if __name__ == '__main__':
    folder = Path(__file__).parent
    result = {name: summarize(json.loads(gzip.decompress((folder / (name + '.json.gz')).read_bytes())))
              for name in ['rapid', 'save', 'after-save']}
    result['frameOnly'] = frame_summary(json.loads(gzip.decompress((folder / 'frame-only.json.gz').read_bytes())))
    print(json.dumps(result, indent=2))
