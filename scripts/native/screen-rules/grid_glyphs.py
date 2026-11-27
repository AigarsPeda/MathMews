"""Read isolated board letters that Vision omits, using the puzzle's rounded letterforms."""

from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np
from PIL import ImageFont


@lru_cache(maxsize=32)
def reference(letter):
    font = ImageFont.truetype(str(Path(__file__).resolve().parents[3] / "assets/fonts/nunito/Nunito-900.ttf"), 96)
    glyph = font.getmask(letter)
    mask = (np.asarray(glyph).reshape(glyph.size[::-1]) > 127).astype(np.uint8)
    x, y, w, h = cv2.boundingRect(mask)
    return mask[y:y+h, x:x+w].astype(np.float32)


def similarity(crop, letter):
    if not crop.size:
        return 0
    # The marker and axis use Ink.text (#24314B). Ignore the tile, outline and coordinates behind it.
    ink = (np.abs(crop.astype(np.int16) - (75, 49, 36)).max(axis=2) < 25).astype(np.uint8)
    _, components, stats, _ = cv2.connectedComponentsWithStats(ink)
    template = reference(letter)
    best = 0
    for index, (x, y, w, h, _) in enumerate(stats[1:], 1):
        if min(w, h) < 5 or abs(np.log((w / h) / (template.shape[1] / template.shape[0]))) > .18:
            continue
        observed = components[y:y+h, x:x+w] == index
        expected = cv2.resize(template, (w, h), interpolation=cv2.INTER_AREA) > .5
        best = max(best, np.count_nonzero(expected & observed) / np.count_nonzero(expected | observed))
    return float(best)
