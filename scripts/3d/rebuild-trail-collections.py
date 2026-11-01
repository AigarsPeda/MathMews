"""Rebuild all editable sources, app sprites and reference comparisons."""
import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
blender = os.environ.get('BLENDER_BIN') or shutil.which('blender') or '/Applications/Blender.app/Contents/MacOS/Blender'
for collection in ['easy', 'medium', 'hard']:
    subprocess.run([blender, '--background', '--threads', '3', '--python-exit-code', '1',
                    '--python', 'scripts/3d/build-trail-collections.py', '--', '--collection', collection],
                   cwd=ROOT, check=True)
for script in ['scripts/3d/pack-trail-collections.mjs', 'scripts/3d/review-trail-collections.mjs', 'scripts/check-trail-collections.mjs']:
    subprocess.run(['node', script], cwd=ROOT, check=True)
