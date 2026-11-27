"""Informational scan for 1-device-pixel rules beside a tiled model."""

import math

import cv2
import numpy as np


def repeated_tiles(gray, region):
    """Locate repeated rectangular tile faces when AX exposes only a single drawing."""
    left, top, right, bottom = region
    crop = gray[top:bottom, left:right].astype(np.uint8)
    edges = cv2.Canny(crop, 35, 95)
    _, faces = cv2.threshold(crop, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    contours = [
        contour
        for mask in (faces, edges)
        for contour in cv2.findContours(mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)[0]
    ]
    groups = []
    for contour in contours:
        x, y, width, height = cv2.boundingRect(contour)
        if min(width, height) < 12 or cv2.contourArea(contour) < 0.78 * width * height:
            continue
        for w, h, tiles in groups:
            if abs(width - w) <= max(2, 0.06 * w) and abs(height - h) <= max(
                2, 0.06 * h
            ):
                break
        else:
            tiles = []
            groups.append((width, height, tiles))
        # Canny frequently returns both the inside and the outside of one contour.
        if all(abs(x - t[0]) > 3 or abs(y - t[1]) > 3 for t in tiles):
            tiles.append((x, y, width, height))
    if not groups:
        return None
    _, _, tiles = max(groups, key=lambda group: len(group[2]))
    if len(tiles) < 4:
        return None
    box = (
        min(x for x, y, w, h in tiles),
        min(y for x, y, w, h in tiles),
        max(x + w for x, y, w, h in tiles),
        max(y + h for x, y, w, h in tiles),
    )
    # Dispersed tick labels or unrelated buttons do not define a contiguous tile perimeter.
    if sum(w * h for x, y, w, h in tiles) < 0.6 * (box[2] - box[0]) * (box[3] - box[1]):
        return None
    return (box[0] + left, box[1] + top, box[2] + left, box[3] + top)


def measure(image, screen, tiles, model=None):
    if image is None:
        return {"status": "UNKNOWN", "reason": "No native screenshot"}
    height, width = image.shape[:2]
    sx = width / (screen[2] - screen[0])
    sy = height / (screen[3] - screen[1])

    def pixels(box):
        return tuple(
            round((v - screen[i % 2]) * (sy if i % 2 else sx))
            for i, v in enumerate(box)
        )

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY).astype(np.int16)
    if tiles:
        perimeter = pixels(
            (
                min(t[0] for t in tiles),
                min(t[1] for t in tiles),
                max(t[2] for t in tiles),
                max(t[3] for t in tiles),
            )
        )
        source = "native tile bounds"
    elif model:
        x, y, r, b = pixels(model)
        region = (max(0, x), max(0, y), min(width, r), min(height, b))
        perimeter = (
            repeated_tiles(gray, region)
            if region[2] > region[0] and region[3] > region[1]
            else None
        )
        source = "repeated tile contours"
    else:
        perimeter = None
    if perimeter is None:
        return {"status": "UNKNOWN", "reason": "No measurable tile perimeter"}
    left, top, right, bottom = perimeter
    hits = []
    tested = []
    for a, t, b, orientation, scale in (
        (left, top, right, "top", sy),
        (left, bottom, right, "bottom", sy),
        (top, left, bottom, "left", sx),
        (top, right, bottom, "right", sx),
    ):
        plane = gray if orientation in ("top", "bottom") else gray.T
        direction = -1 if orientation in ("top", "left") else 1
        if not 0 <= a < b <= plane.shape[1]:
            continue
        tested_all = True
        for distance in range(1, math.floor(3 * scale) + 1):
            # Native bounds are half open. The first exterior pixel is bottom/right, top-1/left-1.
            row = t + direction * distance - (direction == 1)
            if not 0 < row < plane.shape[0] - 1:
                tested_all = False
                continue
            near = plane[row, a:b] - plane[row - 1, a:b]
            far = plane[row, a:b] - plane[row + 1, a:b]
            # A dark or light stripe must differ from both neighbours in the same direction.
            for sign in (-1, 1):
                outer = sign * (near if direction < 0 else far) > 20
                mask = (sign * near > 20) & (sign * far > 20)
                # Measure a continuous line, not periodic dots or accumulated texture.
                changes = np.flatnonzero(np.diff(np.r_[False, mask, False]))
                longest = max(changes[1::2] - changes[::2], default=0)
                # A frame can meet an existing tile border. At the gaps the line is still
                # one pixel wide, and its exterior edge continues across adjacent faces.
                bridges_seams = np.mean(outer) >= 0.95 and all(
                    np.mean(part) >= 0.1
                    for part in np.array_split(mask, 3)
                    if len(part)
                )
                if longest >= max(4, 0.5 * (b - a)) or bridges_seams:
                    hits.append(
                        {
                            "edge": orientation,
                            "distancePx": distance,
                            "distancePt": round(distance / scale, 3),
                            "widthPx": 1,
                            "longestVerifiedRunPx": int(longest),
                            "bridgesSeams": bool(bridges_seams),
                        }
                    )
                    break
        if tested_all:
            tested.append(orientation)
    return {
        "status": "YES" if hits else ("NO" if len(tested) == 4 else "UNKNOWN"),
        "source": source,
        "perimeterPx": perimeter,
        "completeEdges": tested,
        "lines": hits,
    }
