"""Verify displayed euro amounts in the merchandise editor against native image/text bounds."""

import re
import subprocess
import tempfile
from pathlib import Path

import cv2
import numpy as np

from analyze import label, load, recordings, walk


EUROS = re.compile(r"€\d+(?:[.,]\d+)?")
PRICE_SEQUENCE = re.compile(rf"\)?{EUROS.pattern}(?:\s+{EUROS.pattern})*")


def matches_price(price, rows, *, grouped):
    if not grouped and len(rows) != 1:
        return False
    for row in rows:
        text = row["text"].strip()
        if row.get("confidence", 0) < .8:
            continue
        if text == price:
            return True
        # Vision sometimes merges neighboring prices and item icons into one line.
        # Consume complete currency tokens so €2 cannot match €20, €2.50 or €2….
        if grouped:
            for segment in text.split('•'):
                if PRICE_SEQUENCE.fullmatch(segment.strip()) and price in EUROS.findall(segment):
                    return True
    return False


def price_ink_crop(image):
    # Merchandise draws all prices in one ink. Leave their positions intact while removing the colorful goods.
    dark = image[image.max(axis=2) < 150]
    if not dark.size:
        return None
    colors, counts = np.unique(dark, axis=0, return_counts=True)
    ink = colors[counts.argmax()].astype(np.int16)
    return np.where(np.abs(image.astype(np.int16) - ink).max(axis=2) < 30, 0, 255).astype(np.uint8)


def read_prices(path, nodes, screen, dock, image, locale):
    targets = {}
    for node in nodes:
        if node['type'] != 'Image' or not any(a[1] == 'play-entry-model' for a in node['ancestors']):
            continue
        group_box = recordings.bounds(node)
        clip_boxes = [screen, (*screen[:3], dock[1]), group_box]
        clip_boxes.extend(recordings.bounds({'frame': frame}) for kind, ident, frame in node['ancestors']
                          if frame and (kind == 'ScrollArea' or ident == 'play-model-scroll'))
        leaves = set()
        for child in walk(node.get('children', [])):
            value = label(child)
            if child['type'] == 'StaticText' and EUROS.fullmatch(value):
                leaves.add(value)
                targets[value, recordings.bounds(child), False] = clip_boxes
        # AX may fold the first item price into the merchandise image's description.
        for value in sorted(set(EUROS.findall(label(node))) - leaves):
            targets[value, group_box, True] = clip_boxes

    evidence = []
    if not targets:
        return evidence
    with tempfile.TemporaryDirectory() as temp:
        files = {}
        ink_files = {}
        for (value, box, grouped), clips in targets.items():
            item = dict(text=value, box=list(box), source='image' if grouped else 'label', verified=False)
            evidence.append(item)
            if not all(recordings.inside(box, clip) for clip in clips):
                item['reason'] = 'outside the visible merchandise area'
                continue
            if box not in files:
                crop = recordings.crop(image, box, screen)
                file = Path(temp) / f'{len(files)}.png'
                if not crop.size or not cv2.imwrite(str(file), crop):
                    item['reason'] = 'missing crop'
                    continue
                files[box] = file
                if grouped:
                    ink = price_ink_crop(crop)
                    ink_file = Path(temp) / f'{len(files)}-ink.png'
                    if ink is not None and cv2.imwrite(str(ink_file), ink):
                        ink_files[box] = ink_file
        if files:
            subprocess.run([str(path.parents[2] / 'recognize'), locale, *map(str, files.values()), *map(str, ink_files.values())],
                           check=True, capture_output=True, timeout=40)
            for item in evidence:
                if 'reason' in item:
                    continue
                rows = load(Path(str(files[tuple(item['box'])]) + '.ocr.json'))
                item['seen'] = [row['text'] for row in rows]
                item['verified'] = matches_price(item['text'], rows, grouped=item['source'] == 'image')
                ink_file = ink_files.get(tuple(item['box']))
                if item['source'] == 'image' and not item['verified'] and ink_file and not any('…' in r or '...' in r for r in item['seen']):
                    ink_rows = load(Path(str(ink_file) + '.ocr.json'))
                    item['inkSeen'] = [r['text'] for r in ink_rows]
                    item['verified'] = matches_price(item['text'], ink_rows, grouped=True)
                if not item['verified']:
                    item['reason'] = f"crop read {item['seen']!r}"
    return evidence
