"""Score untouched Play editors captured by check-screen-rules.mjs --pre-answer."""

import json
import re
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

import analyze as audit
from currency_givens import read_prices
import tile_edges

bounds = audit.recordings.bounds
RULES = ("clearance", "text", "instruction", "centering")


def union(boxes):
    return (
        min(b[0] for b in boxes),
        min(b[1] for b in boxes),
        max(b[2] for b in boxes),
        max(b[3] for b in boxes),
    )


def editor_nodes(nodes, question):
    for n in nodes:
        ancestors = n["ancestors"]
        ids = [key for _, key, _ in ancestors]
        if (
            "play-model-scroll" not in ids
            or "puzzle-question" in ids or "play-full-question" in ids
            or "puzzle-picture-help" in ids
        ):
            continue
        if n.get("AXUniqueId") == "puzzle-picture-help" or any(
            "scroll bar" in str(v).lower()
            for v in (n.get("AXLabel"), n.get("role_description"))
        ):
            continue
        if any(role == "Slider" for role, _, _ in ancestors):
            continue
        if (
            bounds(n)[1] >= question[3] - 1
            and n["frame"]["height"] > 0
            and n["frame"]["width"] > 0
        ):
            yield n


# Axis names, givens, answers, button labels, and captions identifying board parts belong to the drawing.
# Only standalone editor prose with instructional content is counted outside images and controls.
def is_instruction(text):
    if re.match(r"One long block =|Each small square is", text):
        return False
    return bool(
        re.search(
            r"^(?:tap\b|count\b|use\b|drag\b|place\b|move\b|choose\b|shade\b|match\b|pick\b|select\b|swipe\b|slide\b|add a\b|start by\b|each small\b|the strip\b|there (?:are|is)\b|the total stays\b|first\b)|[.!]$",
            text.strip(),
            re.I,
        )
    ) and not text.rstrip().endswith("?")


def outside_widget(n):
    return not any(
        role
        in (
            "Button",
            "Heading",
            "Image",
            "Slider",
            "Adjustable",
            "StaticText",
            "TextField",
        )
        for role, _, _ in n["ancestors"]
    )


def instructional(nodes, lines, dock, claims):
    rows = {}
    for n in nodes:
        if (
            n["type"] != "StaticText"
            or not outside_widget(n)
            or (audit.label(n), bounds(n)) in claims
            or not is_instruction(audit.label(n))
        ):
            continue
        b = bounds(n)
        for row in lines:
            mid = (
                (row["box"][0] + row["box"][2]) / 2,
                (row["box"][1] + row["box"][3]) / 2,
            )
            if mid[1] < dock[1] and audit.contains_point(b, mid):
                rows[tuple(row["box"])] = row["text"]
    baselines = []
    for box in sorted(rows, key=lambda b: (b[1] + b[3]) / 2):
        mid = (box[1] + box[3]) / 2
        if not baselines or mid - baselines[-1] > max(3, (box[3] - box[1]) * 0.45):
            baselines.append(mid)
    return audit.result(
        ["More than one visible instruction line"] if len(baselines) > 1 else [],
        visibleLineCount=len(baselines),
        lines=list(rows.values()),
    )


def model_bounds(content, question, dock, lines, image, screen):
    def by_id(pattern):
        return [
            bounds(n)
            for n in content
            if re.fullmatch(pattern, n.get("AXUniqueId") or "")
        ]

    # An external dimension label must not pull the tiles off centre. A whole-shape target takes precedence over alternate answer tiles.
    for pattern in (
        r"geometry-shape-.*",
        r"geometry-square-\d+",
        r"play-entry-model|bridge-plot-frame|decimal-grid|fraction-line-track|bridge-ratio-model|play-proof-model",
        r"fraction-strip-board",
        r"clock-hand-input|number-line-track",
    ):
        found = by_id(pattern)
        if found:
            return union(found), pattern
    counts = [
        n for n in content if (n.get("AXUniqueId") or "").startswith("decimal-count-")
    ]
    if len(counts) >= 2:
        # Each column's count is centred on its own cell. Reconstruct the mat's two outer edges from adjacent cell centres.
        centres = sorted({(bounds(n)[0] + bounds(n)[2]) / 2 for n in counts})
        if len(centres) >= 2:
            spacing = (centres[-1] - centres[0]) / (len(centres) - 1)
            images = [bounds(n) for n in content if n["type"] == "Image"]
            vertical = union([bounds(n) for n in counts] + images)
            return (
                centres[0] - spacing / 2,
                vertical[1],
                centres[-1] + spacing / 2,
                vertical[3],
            ), "place-value mat columns"
    for n in content:
        if (
            n["type"] == "Slider"
            and audit.label(n) == "Trace the jug scale"
            and n["ancestors"]
        ):
            return bounds({"frame": n["ancestors"][-1][2]}), "graduated jug group"
    images = [
        bounds(n)
        for n in content
        if n["type"] == "Image"
        and n["frame"]["width"] > 35
        and n["frame"]["height"] > 30
        and outside_widget(n)
    ]
    exchange = by_id("decimal-exchange")
    if exchange and images:
        # The actionable column is a button while its neighbours are native images.
        return union(exchange + images), "decimal exchange and adjacent columns"
    if images:
        return union(images), "native image"
    # Bare Skia canvases may be exposed only as unlabelled groups. Measure painted geometry inside the editor and exclude controls and instructional prose.
    h, w = image.shape[:2]
    sx = w / (screen[2] - screen[0])
    sy = h / (screen[3] - screen[1])
    top = max(0, round((question[3] + 1) * sy))
    bottom = min(h, round(dock[1] * sy))
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 125)
    edges[:top] = 0
    edges[bottom:] = 0

    def erase(b):
        x, y, r, t = b
        edges[
            max(0, round(y * sy) - 2) : min(h, round(t * sy) + 2),
            max(0, round(x * sx) - 2) : min(w, round(r * sx) + 2),
        ] = 0

    for n in content:
        ident = n.get("AXUniqueId") or ""
        txt = audit.label(n)
        if (
            n["type"] == "StaticText"
            and is_instruction(txt)
            or re.search(
                r"(?:reset|remove|fraction-line-(?:left|right)|fraction-strip-(?:add|parts)|decimal-add|bridge-add)",
                ident,
            )
            or txt in ("Start again", "Your answer", "Check answer")
            or txt.startswith("Answer ?")
        ):
            erase(bounds(n))
    for row in lines:
        if row["text"].strip().lower() in ("picture help", "check answer"):
            erase(row["box"])
    # Remove the picture-help and check regions including chip edges.
    # Canny ignores the pale gradient. Keep structural contours and apply a text-only fallback for equation puzzles.
    count, _, stats, _ = cv2.connectedComponentsWithStats(edges, 8)
    shapes = []
    for x, y, ww, hh, area in stats[1:]:
        if (
            ww / sx >= 18
            and hh / sy >= 10
            and area >= 30
            or ww / sx >= 42
            and hh / sy >= 2
        ):
            shapes.append((x / sx, y / sy, (x + ww) / sx, (y + hh) / sy))
    if shapes:
        # Include open/dashed slots and equation numerals that do not yield a connected outline.
        shapes.extend(by_id("pattern-next-gap"))
        for n in content:
            if (
                n["type"] == "StaticText"
                and outside_widget(n)
                and re.fullmatch(r"[0-9=+×÷−?]+", audit.label(n))
                and n["frame"]["width"] < 150
            ):
                shapes.append(bounds(n))
        return union(shapes), "painted contours and native math slots"
    text = [
        tuple(l["box"])
        for l in lines
        if l["box"][1] >= question[3]
        and l["box"][3] < dock[1]
        and re.search(r"\d|[=?]", l["text"])
    ]
    if text:
        return union(text), "painted mathematical text"
    return None, "No observable model"


def hairline(image, screen, content, model=None):
    tiles = [
        bounds(n)
        for n in content
        if re.fullmatch(r"geometry-square-\d+", n.get("AXUniqueId") or "")
    ]
    return tile_edges.measure(image, screen, tiles, model)


def score_text(nodes, content, lines, screen, dock, config, compact_check=False):
    compared = audit.text_check([("entry", nodes, lines, screen)], config, compact_check=compact_check)
    definite = [
        r for r in compared["reasons"] if "ellipsis" in r or "mid-word break" in r or r.startswith(("entry: currency given ", "entry: control label ", "entry: grid letter ", "entry: compact place-value text ", "entry: short label "))
    ]
    clipped = []
    for n in content:
        if (
            n["type"] not in ("StaticText", "Heading")
            or not outside_widget(n)
            or not audit.label(n)
        ):
            continue
        b = bounds(n)
        if (
            b[3] > dock[1] + 0.5
            and b[1] < dock[1] + 160
            and not is_instruction(audit.label(n))
        ):
            clipped.append(audit.label(n))
    if clipped:
        definite.append(
            "Text extends beneath the answer dock: " + ", ".join(dict.fromkeys(clipped))
        )
    if not lines:
        definite.append("No readable screenshot")
    return audit.result(
        definite,
        warnings=compared.get("warnings", ()),
        comparedLabels=compared["verifiedOrComparedLabels"],
        ocrDifferences=[r for r in compared["reasons"] if r not in definite],
    )


def take_away_trays(image, area, screen):
    # TransferBoard paints teal.soft and amber.soft even when a disabled tray has no pieces or AX node.
    sx, sy = image.shape[1] / (screen[2] - screen[0]), image.shape[0] / (screen[3] - screen[1])
    roi = audit.recordings.crop(image, area, screen)
    if not roi.size:
        return None
    boxes = []
    for rgb in ((227, 244, 247), (255, 243, 220)):
        bgr = np.array(rgb[::-1])
        mask = cv2.inRange(roi, np.maximum(bgr - 2, 0), np.minimum(bgr + 2, 255))
        _, _, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
        trays = [(area[0] + x / sx, area[1] + y / sy, area[0] + (x + w) / sx, area[1] + (y + h) / sy)
                 for x, y, w, h, pixels in stats[1:]
                 if w / sx >= 40 and h / sy >= 40 and pixels >= w * h * .15]
        if len(trays) != 1:
            return None
        boxes.extend(trays)
    return union(boxes)


def board_geometry(nodes, lines, image, retained_take_away=False, *, size="large"):
    screen = bounds(nodes[0])
    question = bounds(audit.editor_questions(nodes, size)[0])
    dock = bounds(audit.landmarks(nodes, "play-answer-dock")[0])
    viewport = bounds(audit.landmarks(nodes, "play-model-scroll")[0])
    content = list(editor_nodes(nodes, question))
    if image is None:
        raise ValueError("No editor screenshot")
    image = image.copy()
    for n in audit.landmarks(nodes, "puzzle-picture-help"):
        # Only the model should contribute to painted bounds. Replicate the neighbouring background for the row.
        y = int(max(0, bounds(n)[1]) * image.shape[0] / screen[3])
        end = int(min(screen[3], bounds(n)[3]) * image.shape[0] / screen[3])
        if 0 < y < end:
            image[y:end] = image[y - 1 : y]
    for gear in audit.landmarks(nodes, "gearshape.fill"):
        x, y, r, b = bounds(gear)
        scale = image.shape[1] / screen[2]
        x = max(0, int((x - 12) * scale))
        y = max(0, int((y - 12) * scale))
        r = min(image.shape[1], int((r + 12) * scale))
        b = min(image.shape[0], int((b + 12) * scale))
        if x < r and y < b:
            image[y:b, x:r] = image[y:b, :1]
    if retained_take_away and not audit.landmarks(content, "play-entry-model"):
        area = bounds(audit.landmarks(nodes, "play-proof-area")[0])
        area = (max(area[0], viewport[0]), max(area[1], viewport[1]),
                min(area[2], viewport[2]), min(area[3], viewport[3], dock[1]))
        box = take_away_trays(image, area, screen)
        method = "both painted take-away trays"
    else:
        box, method = model_bounds(content, question, dock, lines, image, screen)
    rules = {}
    uncertain = audit.result(["No model geometry found"])
    rules["centering"] = uncertain
    rules["clearance"] = uncertain
    if box:
        centre = (viewport[0] + viewport[2]) / 2
        offset = (box[0] + box[2]) / 2 - centre
        bottom = box[3]
        model_labels = []
        for n in content:
            if (
                n["type"] == "StaticText"
                and outside_widget(n)
                and re.search(r"\d", audit.label(n))
                and not is_instruction(audit.label(n))
                and not re.match(r"Inspect |Taken away:", audit.label(n))
            ):
                b = bounds(n)
                bottom = max(bottom, b[3])
                model_labels.append(audit.label(n))
        gap = dock[1] - bottom
        rules["centering"] = audit.result(
            [f"Model offset {offset:+.3f} pt"] if audit.off_center(offset) else [],
            offsetPt=round(offset, 4),
            modelBounds=box,
            source=method,
        )
        rules["clearance"] = audit.result(
            [f"{gap:.1f} pt above dock"] if gap < 7.99 else [],
            gapPt=round(gap, 2),
            dockTopPt=round(dock[1], 2),
            modelBottomPt=round(bottom, 2),
            labels=list(dict.fromkeys(model_labels)),
        )
    return rules, content, box


def inspect(folder, case, config, size="large"):
    path = folder / size / case["variant"]
    nodes = list(audit.walk(audit.load(path / "entry.json")))
    screen = bounds(nodes[0])
    dock = bounds(audit.landmarks(nodes, "play-answer-dock")[0])
    lines = audit.ocr(path / "entry.png.ocr.json", screen)
    image = cv2.imread(str(path / "entry.png"))
    rules, content, box = board_geometry(nodes, lines, image, size=size)
    prices = []
    if case["variant"] in ("multiple_choice_money_change", "multiple_choice_money_discount", "multiple_choice_money_total"):
        prices = read_prices(path / "entry.png", nodes, screen, dock, image, config["locale"])
        config = {**config, "entryPrices": prices}
    if case.get("puzzle", {}).get("type") in ("place_value", "decimal_place_value"):
        config = {**config, "compactPlacePuzzle": case["puzzle"]}
    control_nodes = [n for n in nodes if audit.bounded_control_label(n, config)]
    if control_nodes:
        lines = audit.regional_words(path / "entry.png", control_nodes, screen, lines, config)
    glyphs = audit.grid_label_evidence(nodes, screen, config.get("locale"), image=image)
    rules["text"] = score_text(nodes, content, lines + glyphs, screen, dock, config, compact_check=size == "accessibility-extra-large")
    if prices:
        rules["text"]["currencyGivens"] = prices
    rules["instruction"] = instructional(content, lines, dock, audit.claim_text_in_model(nodes, config))
    return rules, {
        "arrivalAnimation": audit.arrival(path, config, [box] if box else None),
        "hairlineFrame": hairline(image, screen, content, box),
    }


def main():
    folder = Path(sys.argv[1])
    vision = sys.argv[2]
    config = audit.load(folder / "capture.json")
    rows = []
    print("Variant", *RULES, "arrival (info)", "hairline (info)", sep=" | ")
    for case in config["cases"]:
        directory = folder / "large" / case["variant"]
        image = directory / "entry.png"
        ocr = directory / "entry.png.ocr.json"
        try:
            if image.exists() and (
                not ocr.exists() or ocr.stat().st_mtime < image.stat().st_mtime
            ):
                subprocess.run(
                    [vision, config["locale"], str(image)], check=True, timeout=60
                )
            rules, info = inspect(folder, case, config)
        except (
            IndexError,
            KeyError,
            TypeError,
            OSError,
            ValueError,
            cv2.error,
            subprocess.SubprocessError,
        ) as err:
            rules = {k: audit.result([f"Missing evidence: {err}"]) for k in RULES}
            info = {
                k: {"status": "UNKNOWN", "reason": str(err)}
                for k in ("arrivalAnimation", "hairlineFrame")
            }
        rows.append(
            dict(
                variant=case["variant"],
                id=case["id"],
                size="large",
                rules=rules,
                info=info,
            )
        )
        print(
            case["variant"],
            *(rules[k]["status"] for k in RULES),
            info["arrivalAnimation"]["status"],
            info["hairlineFrame"]["status"],
            flush=True,
        )
    data = dict(
        udid=config["udid"],
        locale=config["locale"],
        size="large",
        minimumGapPt=8,
        maximumCentreOffsetPt=4,
        runs=rows,
    )
    (folder / "report.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    )
    return int(any(r["rules"][k]["status"] == "FAIL" for r in rows for k in RULES))


if __name__ == "__main__":
    sys.exit(main())
