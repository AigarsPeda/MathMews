"""Keep the legacy thumbnail command on the same GLB-to-stills pipeline."""
from pathlib import Path
import runpy
import sys

renderer = runpy.run_path(str(Path(__file__).with_name('render-native-branding.py')))
renderer['regenerate'](renderer['selected_skins'](sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []))
