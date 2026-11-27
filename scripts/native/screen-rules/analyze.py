"""Evaluate evidence from check-screen-rules.mjs. An unobservable rule fails closed."""

import importlib.util
import json
import re
import subprocess
import sys
import tempfile
import unicodedata
from functools import lru_cache
from pathlib import Path

import cv2
import grid_glyphs
import numpy as np

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location(
    "recordings", HERE.parent / "check-play-proof-recordings.py"
)
recordings = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recordings)
RULES = [
    "preAnswer",
    "input",
    "oneModel",
    "text",
    "firstPaint",
    "clearance",
    "motion",
    "noEarlyAnswer",
    "instruction",
    "centering",
]


def load(file):
    return json.loads(file.read_text())


@lru_cache(maxsize=3)
def locale_strings(locale):
    return load(HERE.parents[2] / "locales" / (locale + ".json"))


def off_center(offset):
    # AX may report fractional point coordinates with floating-point rounding.
    return abs(offset) > 4.0 + 1e-6


def result(errors, *, warnings=(), **facts):
    return dict(
        status="FAIL" if errors else "WARNING" if warnings else "PASS",
        reasons=list(dict.fromkeys(errors)),
        **({"warnings": list(dict.fromkeys(warnings))} if warnings else {}),
        **facts,
    )


def walk(nodes, ancestors=()):
    for node in nodes:
        yield dict(node, ancestors=ancestors)
        yield from walk(
            node.get("children", []),
            ancestors
            + ((node.get("type"), node.get("AXUniqueId"), node.get("frame")),),
        )


def within(node, outer):
    return recordings.inside(recordings.bounds(node), outer)


def landmarks(nodes, name):
    return [n for n in nodes if n.get("AXUniqueId") == name]


def label(n):
    return n.get("AXLabel") or ""


def editor_questions(nodes, size):
    if size == "accessibility-extra-large":
        full = landmarks(nodes, "play-full-question")
        if full:
            return full
    return landmarks(nodes, "puzzle-question")


def question_labels(nodes):
    labels = set()
    for question in landmarks(nodes, "puzzle-question"):
        if label(question):
            labels.add(label(question))
        else:
            # AX can expose the story prompt as a sibling of its empty Group.
            box = recordings.bounds(question)
            labels.update(label(n) for n in nodes if n.get("type") in ("Heading", "StaticText")
                          and label(n) and within(n, box))
    return labels


def words(text):
    return re.findall(r"[^\W_]+", unicodedata.normalize("NFKC", text).casefold())


def normalized(text):
    return " ".join(words(text))


def lines_in(lines, box):
    return [
        line["text"]
        for line in lines
        if box[0] - 2 <= sum(line["box"][::2]) / 2 <= box[2] + 2
        and box[1] - 2 <= sum(line["box"][1::2]) / 2 <= box[3] + 2
    ]


def refresh_banner(text, top_fraction):
    return 0 <= top_fraction < .12 and text.strip() in ("Refreshing…", "Refreshing...")


def ocr(file, screen):
    return [
        dict(
            line,
            box=[
                v * (screen[2] if i % 2 == 0 else screen[3])
                for i, v in enumerate(line["box"])
            ],
        )
        for line in load(file) if not refresh_banner(line["text"], line["box"][1])
    ]


def visible_box(node, screen):
    original = recordings.bounds(node)
    boxes = [
        original,
        screen,
        *[
            recordings.bounds({"frame": f})
            for typ, _, f in node["ancestors"]
            if typ == "ScrollArea" and f
        ],
    ]
    clipped = (
        max(b[0] for b in boxes),
        max(b[1] for b in boxes),
        min(b[2] for b in boxes),
        min(b[3] for b in boxes),
    )
    return clipped if clipped[2] > clipped[0] and clipped[3] > clipped[1] else None


def deal_targets(nodes, puzzle, locale):
    payload = puzzle["payload"]
    strings = locale_strings(locale)
    supply = strings["friendlyQ"]["supply"]
    item = strings["taskObjects"][payload["object"]]
    expected = [f"{item} {i}, {supply}" for i in range(1, payload["items"] + 1)]
    for i in range(1, payload["people"] + 1):
        plate = strings["friendlyQ"]["plate"].replace("{{n}}", str(i))
        expected.append(f"{plate}, 0")
    controls = [n for n in nodes if n["type"] == "Button" and label(n) in expected
                and n.get("enabled", True) and any(a[1] == "play-proof-area" for a in n["ancestors"])]
    labels = [label(n) for n in controls]
    errors = [f"Expected one initial deal target {name!r}, found {labels.count(name)}"
              for name in expected if labels.count(name) != 1]
    return controls, errors


def budget_targets(nodes, puzzle, locale):
    """Goods on the shop board are the answer controls. Match each authored item once."""
    items = puzzle["payload"]["items"]
    controls, errors = [], []
    for item in items:
        name = item["label"][locale] if isinstance(item["label"], dict) else item["label"]
        matches = [node for node in nodes if node.get("type") == "Button"
                   and any(ident in ("play-entry-model", "play-proof-area") for _, ident, _ in node["ancestors"])
                   and (label(node) == name or label(node).startswith(name + ", "))]
        if len(matches) != 1:
            errors.append(f"Expected one budget good {name!r}, found {len(matches)}")
        elif matches[0].get("enabled") is not True:
            errors.append(f"Budget good {name!r} is disabled or has no enabled state")
        else:
            controls.append(matches[0])
    if not items:
        errors.append("Budget payload has no goods")
    return controls, errors


def inputs(nodes, screen, config, check, puzzle):
    check_nodes = [
        n
        for n in nodes
        if n.get("type") == "Button" and label(n) == config["checkLabel"]
    ]
    errors = []
    if len(check_nodes) != 1:
        errors.append(f"Expected one Check button, found {len(check_nodes)}")
    template = config["answerTemplate"].split("{{answer}}")[0]

    def is_input(n):
        ident = n.get("AXUniqueId") or ""
        in_dock = any(a[1] == "play-answer-dock" for a in n["ancestors"])
        return (
            n.get("type") == "Button"
            and label(n) != config["checkLabel"]
            and (
                in_dock
                or (template and label(n).startswith(template))
                or re.search(r"(?:key-|digit-|choice-)", ident)
                or (
                    puzzle.get("type") in ("compare", "place_value", "decimal_place_value")
                    and ident not in ("puzzle-picture-help", "place-value-reset", "decimal-place-reset")
                    and any(a[1] == "play-proof-area" for a in n["ancestors"])
                )
            )
        )

    controls = [n for n in nodes if is_input(n)]
    expected = check.get("choiceCount") or len(
        puzzle.get("choices", puzzle.get("payload", {}).get("choices", []))
    )
    if puzzle.get("type") == "compare":
        expected = 2
    if puzzle.get("type") == "fair_share" and check.get("answerKind") == "distribution":
        controls, deal_errors = deal_targets(nodes, puzzle, config["locale"])
        errors.extend(deal_errors)
    elif puzzle.get("type") == "budget_plan":
        controls, goods_errors = budget_targets(nodes, puzzle, config["locale"])
        errors.extend(goods_errors)
    elif not controls or len(controls) < expected:
        errors.append(
            f"Found {len(controls)} answer controls, expected {expected or 'at least one'}"
        )
    if landmarks(nodes, "compact-keypad") and not set("0123456789").issubset(
        label(n) for n in controls
    ):
        errors.append("Incomplete numeric keypad")
    docks = landmarks(nodes, "play-answer-dock")
    budget = puzzle.get("type") == "budget_plan"
    if budget and len(docks) != 1:
        errors.append(f"Expected one budget answer dock, found {len(docks)}")
    for n in controls + check_nodes:
        clips = [
            recordings.bounds({"frame": f}) for typ, ident, f in n["ancestors"]
            if f and (typ == "ScrollArea" or ident == "play-model-scroll")
        ]
        if docks and ((budget and n in controls) or any(ident == "play-model-scroll" for _, ident, _ in n["ancestors"])):
            clips.append((*screen[:3], recordings.bounds(docks[0])[1]))
        if not all(within(n, b) for b in [screen, *clips]):
            errors.append(f"Clipped {label(n)} at {recordings.bounds(n)}")
    return result(errors, controls=[label(n) for n in controls]), controls


def locale_crop_matches(text, rows, locale, wrong_fraction=False):
    """Compare complete OCR lines read from this label's visible native pixels."""
    if locale not in ("lv", "ru") or not rows or any(r.get("confidence", 0) < .5 for r in rows):
        return False
    actual = " ".join(r["text"].strip() for r in rows)
    if "…" in actual or "..." in actual:
        return False
    expected = text.strip()
    if expected.startswith("↻"):
        expected = expected[1:].strip()
        actual = re.sub(r"^[↻•]\s*", "", actual)
        if locale == "ru":
            # Russian Vision sometimes reads the standalone replay arrow as Cyrillic с.
            actual = re.sub(r"^с\s+", "", actual)
    if wrong_fraction and re.fullmatch(r"\d+/\d+", expected):
        actual = re.sub(r"\s*×$", "", actual)
    expected = " ".join(unicodedata.normalize("NFC", expected).split())
    actual = " ".join(unicodedata.normalize("NFC", actual).split())
    if len(expected) != len(actual):
        return False
    for pos, (want, read) in enumerate(zip(expected, actual)):
        if want == read:
            continue
        if locale == "ru" and want.lower() == "ё" and read.lower() == "е":
            continue
        if locale == "lv":
            if want == "I" and read == "l" and (pos == 0 or not expected[pos - 1].isalpha()):
                continue
            if want == "ļ" and read == "ț":
                continue
            if want.lower() in "āčēģīķļņšūž" and (
                unicodedata.normalize("NFD", want)[0] == unicodedata.normalize("NFD", read)[0]
            ):
                continue
        return False
    return True


def locale_midword(text, rows, locale):
    if locale not in ("lv", "ru") or len(rows) < 2:
        return False
    ordered = sorted(rows, key=lambda r: (r["box"][1], r["box"][0]))
    for i, (first, second) in enumerate(zip(ordered, ordered[1:])):
        if second["box"][1] < first["box"][3] - 1:
            continue
        # A match that requires joining two distinct baselines is a visible mid-word break.
        merged = {"text": first["text"].rstrip() + second["text"].lstrip(),
                  "confidence": min(first.get("confidence", 0), second.get("confidence", 0))}
        if locale_crop_matches(text, [*ordered[:i], merged, *ordered[i + 2:]], locale):
            return True
    return False


def heading_line_crops(image):
    # A very short final line may disappear from Vision's paragraph observation.
    ink = image.max(axis=2) < 150
    ys = np.flatnonzero(ink.any(axis=1))
    if not len(ys):
        return []
    bands = np.split(ys, np.flatnonzero(np.diff(ys) > 1) + 1)
    crops = []
    for band in bands:
        top, bottom = band[0], band[-1] + 1
        xs = np.flatnonzero(ink[top:bottom].any(axis=0))
        crop = image[top:bottom, xs[0]:xs[-1] + 1]
        crops.append(cv2.copyMakeBorder(crop, 12, 12, 16, 16, cv2.BORDER_CONSTANT,
                                        value=[255, 255, 255]))
    return crops


def compact_check_label(node, config, enabled):
    if (enabled and node["type"] == "Button" and label(node) == config.get("checkLabel")
            and any(ident == "play-answer-dock" for _, ident, _ in node["ancestors"])):
        return locale_strings(config["locale"])["play"]["shortCheck"]
    return None


PLAIN_EUROS = re.compile(r"€[0-9]{1,3}")


LITRE_AMOUNT = re.compile(r"[0-9]+(?:[.,][0-9]+)? ?[Llл]")
MONEY_CONTROL = re.compile(r"(?:€[0-9]{1,3}(?:[.,][0-9]{2})?|[0-9]{1,3} c)")
RECTANGLE_DIMENSION = re.compile(r"[AB] · [0-9]+")


def bounded_control_label(node, config):
    """Printed text and an optional adjacent mark, scoped to the native control that owns them."""
    text = label(node)
    ancestors = node["ancestors"]
    if (node["type"] == "StaticText" and RECTANGLE_DIMENSION.fullmatch(text)
            and any(ident in ("play-entry-model", "play-proof-model") for _, ident, _ in ancestors)):
        return text, ""
    if node["type"] == "StaticText" and (node.get("AXUniqueId") == "response-value" or
                                          any(ident == "response-value" for _, ident, _ in ancestors)):
        prefix = locale_strings(config["locale"])["activityMix"]["answer"] + ": "
        if text.startswith(prefix):
            return text.removeprefix(prefix), ""
    if node["type"] == "Button":
        prefix = config.get("answerTemplate", "").partition("{{answer}}")[0]
        if prefix and text.startswith(prefix):
            text = text.removeprefix(prefix)
            if node.get("AXValue"):
                if ((re.fullmatch(r"[0-9]+", text) or LITRE_AMOUNT.fullmatch(text)) and node["AXValue"] == config.get("verdict", {}).get("correct")
                        and any(ident in ("play-submitted-response", "play-proof-answer") for _, ident, _ in ancestors)):
                    return text, "✓✔~v-" if LITRE_AMOUNT.fullmatch(text) else "✓✔~v"
                return None
    elif node["type"] != "StaticText" or not any(kind == "Button" for kind, _, _ in ancestors):
        return None
    if MONEY_CONTROL.fullmatch(text):
        return text, ""
    return None


def bounded_reading(expected, seen, marks=""):
    if RECTANGLE_DIMENSION.fullmatch(expected):
        reading = re.sub(r"\s*[·•]\s*", " · ", " ".join(seen).strip())
        return reading == expected
    if len(seen) != 1:
        return False
    actual = seen[0].strip()
    if actual and actual[-1] in marks:
        actual = actual[:-1].rstrip()
    if LITRE_AMOUNT.fullmatch(expected) and LITRE_AMOUNT.fullmatch(actual):
        return actual.replace(" ", "") == expected.replace(" ", "")
    return actual == expected


def partial_short_reading(expected, reading, marks):
    if "…" in reading or "..." in reading:
        return True
    if reading and reading[-1] in marks:
        reading = reading[:-1].rstrip()
    # A surviving subsequence also catches a missing middle digit (123 read as 13).
    remaining = iter(expected)
    return 0 < len(reading) < len(expected) and all(char in remaining for char in reading)


def short_label_ocr_miss(expected, seen, partial, marks=""):
    """Distinguish unreadable OCR from evidence of a partial or conflicting label."""
    reading = " ".join(seen).strip().replace("−", "-")
    expected = expected.replace("−", "-")
    if partial or partial_short_reading(expected, reading, marks):
        return False
    if len(seen) > 1:
        joined = reading.replace(" ", "")
        if joined == expected or partial_short_reading(expected, joined, marks):
            return False
    if not reading:
        return True
    if MONEY_CONTROL.fullmatch(expected) or LITRE_AMOUNT.fullmatch(expected):
        return False  # Denominations and units have their own exact comparison.
    if re.search(r"\d", expected) and re.search(r"\d", reading):
        return False
    operators = {"+", "-", "×", "÷", "="}
    return not (expected in operators and reading in operators)


def merged_glyph_reading(glyph, box, lines, nodes):
    if len(glyph) != 1:
        return False
    for row in lines:
        reading = row["text"].strip()
        if (reading == glyph or glyph not in reading or "…" in reading or "..." in reading
                or not lines_in([row], box)):
            continue
        for n in nodes:
            other = label(n).strip()
            if n["type"] != "StaticText" or not other:
                continue
            neighbor = recordings.bounds(n)
            if not rectangles_overlap(neighbor, row["box"]) or max(neighbor[1], box[1]) >= min(neighbor[3], box[3]):
                continue
            if neighbor[2] <= box[0] and other in reading.partition(glyph)[0]:
                return True
            if neighbor[0] >= box[2] and other in reading.rpartition(glyph)[2]:
                return True
    return False


def under_answer_dock(node, box, docks):
    return (any(ident in ("play-model-scroll", "play-proof-scroll") for _, ident, _ in node["ancestors"])
            and any(box[3] > top + 1 and box[1] < bottom and box[0] < right and box[2] > left
                    for left, top, right, bottom in docks))


def digit_runs_align(reading, line_box, parts):
    # Vision supplies one box for fused digits. Locate each AX run within that box.
    advance = (line_box[2] - line_box[0]) / len(reading)
    x = line_box[0]
    for digits, box in parts:
        width = len(digits) * advance
        if not box[0] - 1 <= x + width / 2 <= box[2] + 1:
            return False
        x += width
    return True


def verified_merged_labels(nodes, lines, screen, docks):
    labels = set()
    for n in nodes:
        text = label(n).strip()
        if n["type"] not in ("StaticText", "Heading", "Button") or not text:
            continue
        box = visible_box(n, screen)
        if box and within(n, box) and not under_answer_dock(n, box, docks):
            labels.add((text, recordings.bounds(n)))

    verified = set()
    for row in lines:
        reading = row["text"].strip()
        if row.get("regionVerified") or "…" in reading or "..." in reading:
            continue
        line_box = row["box"]
        y = (line_box[1] + line_box[3]) / 2
        parts = sorted(
            ((text, box) for text, box in labels if box[1] <= y <= box[3] and rectangles_overlap(box, line_box)),
            key=lambda part: part[1][0],
        )
        if len(parts) < 2:
            continue
        pattern = re.escape(parts[0][0])
        for (left, left_box), (right, right_box) in zip(parts, parts[1:]):
            if left_box[2] > right_box[0] + 1:
                break  # Overlapping AX bounds cannot establish the character order.
            # A word needs a boundary. Neighboring numeric labels may form a single OCR digit run.
            word_join = left[-1].isalnum() and right[0].isalnum()
            both_digits = left[-1].isdigit() and right[0].isdigit()
            separator = r"\s+" if word_join and not both_digits else r"\s*"
            pattern += separator + re.escape(right)
        else:
            if re.fullmatch(pattern, reading) and (not reading.isdecimal() or digit_runs_align(reading, line_box, parts)):
                verified.update(parts)
    return verified


def plot_axis(node):
    return (node["type"] == "StaticText" and label(node) in ("x", "y")
            and any(ident == "bridge-plot-frame" for _, ident, _ in node["ancestors"]))


@lru_cache(maxsize=3)
def grid_location_label(locale):
    strings = locale_strings(locale)
    spoken = strings["play"]["answerLabel"] + ", " + strings["everyday"]["gridLocation"]
    pattern = re.escape(spoken).replace(re.escape("{{answer}}"), "([A-Z])")
    for field in ("{{row}}", "{{column}}"):
        pattern = pattern.replace(re.escape(field), r"[1-9][0-9]*")
    return re.compile(pattern)


def grid_label_evidence(nodes, screen, locale, *, path=None, image=None):
    cells = []
    targets = {}
    for node in nodes:
        text = label(node)
        if plot_axis(node):
            targets[text, recordings.bounds(node)] = (text, node)
        elif node["type"] in ("Button", "GenericElement") and ", " in text and locale:
            match = grid_location_label(locale).fullmatch(text)
            if match and (str(node.get("AXUniqueId")).startswith("grid-choice-")
                          or any(i in ("play-entry-model", "play-proof-model") for _, i, _ in node["ancestors"])):
                box = recordings.bounds(node)
                targets[text, box] = (match[1], node)
                cells.append((match[1], box))
    for node in nodes:
        text = label(node)
        if node["type"] == "StaticText" and any(text == letter and within(node, box) for letter, box in cells):
            targets[text, recordings.bounds(node)] = (text, node)
    if targets and image is None and path is not None:
        image = cv2.imread(str(path))
    evidence = []
    for (text, box), (letter, node) in targets.items():
        visible = visible_box(node, screen)
        score = 0
        if visible and within(node, visible) and image is not None:
            score = grid_glyphs.similarity(recordings.crop(image, box, screen), letter)
        evidence.append(dict(gridLetter=letter, text=text, box=box, verified=score >= .85, inkOverlap=round(score, 3)))
    return evidence


def regional_labels(path, nodes, screen, lines, config, compact_check=False):
    glyphs = grid_label_evidence(nodes, screen, config.get("locale"), path=path)
    return [*regional_words(path, nodes, screen, lines, config, compact_check), *glyphs]


def regional_words(path, nodes, screen, lines, config, compact_check=False):
    """Re-read ambiguous labels within their native text bounds."""
    locale = locale_strings(config["locale"])
    navigation = {locale["common"]["back"], locale["play"]["backToPath"]}
    localized = config["locale"] in ("lv", "ru")
    answer_prefix = config["answerTemplate"].split("{{answer}}")[0]
    targets = {}
    english_headings = set()
    exact_labels = set()
    docks = [recordings.bounds(n) for n in landmarks(nodes, "play-answer-dock")]
    bounded_targets = {}
    for n in nodes:
        text = label(n)
        if not text:
            continue
        english_heading = n["type"] == "Heading" and config["locale"] == "en"
        exact_label = False
        wrong_fraction = False
        bounded = bounded_control_label(n, config)
        if bounded:
            text = bounded[0]
        elif localized and n["type"] == "Button" and answer_prefix and text.startswith(answer_prefix):
            text = text.removeprefix(answer_prefix)
            wrong_fraction = n.get("AXValue") == config["verdict"]["wrong"]
        elif n["type"] == "StaticText":
            navigation_child = text in navigation and any(kind == "Button" for kind, _, _ in n["ancestors"])
            equation = any(a[1] == "play-proof-equation" for a in n["ancestors"])
            exact_label = text == config.get("budgetReserveLabel") and any(a[1] == "play-proof-area" for a in n["ancestors"])
            if (not localized and len(text) > 3 and re.fullmatch(r"(?:\d+ )?[A-Za-z]+", text)
                    and any(ident in ("play-proof-model", "play-submitted-response") for _, ident, _ in n["ancestors"])):
                native_box = recordings.bounds(n)
                if not lines_in(lines, native_box) and not under_answer_dock(n, native_box, docks):
                    exact_label = True
            if not localized and not navigation_child and not equation and not exact_label and not re.fullmatch(r"\d{2,3}", text) and not PLAIN_EUROS.fullmatch(text):
                continue
        elif not english_heading and not (localized and (n["type"] == "Heading" or
                (n["type"] == "Button" and text in (config["checkLabel"], config["retryLabel"])))):
            continue
        box = visible_box(n, screen)
        if not box or ((english_heading or exact_label or bounded) and not within(n, box)):
            continue
        recognized = normalized(" ".join(lines_in(lines, box)))
        needs_crop = f" {normalized(text)} " not in f" {recognized} "
        if bounded:
            needs_crop = not bounded_reading(text, lines_in(lines, box), bounded[1])
            bounded_targets[text, tuple(box)] = bounded[1]
        if needs_crop:
            if exact_label:
                exact_labels.add((text, tuple(box)))
            if english_heading:
                english_headings.add((text, tuple(box)))
            targets[text, tuple(box)] = wrong_fraction or targets.get((text, tuple(box)), False)
            short_label = compact_check_label(n, config, compact_check)
            if short_label and localized and recognized != normalized(short_label):
                targets[short_label, tuple(box)] = False
    if not targets:
        return lines
    image = cv2.imread(str(path))
    vision = path.parents[2] / "recognize"
    if image is None or not vision.is_file():
        return lines
    extra = []
    with tempfile.TemporaryDirectory() as temp:
        files = {}
        heading_files = {}
        for i, (text, box) in enumerate(targets):
            roi = recordings.crop(image, box, screen)
            if not roi.size:
                continue
            if (text, box) in english_headings:
                group = []
                for index, crop in enumerate(heading_line_crops(roi)):
                    file = Path(temp) / f"{i}-row-{index}.png"
                    cv2.imwrite(str(file), crop)
                    group.append(file)
                if group:
                    heading_files[text, box] = group
                continue
            # Preserve original glyph edges before trying the resized, padded fallback.
            original = Path(temp) / f"{i}-native.png"
            cv2.imwrite(str(original), roi)
            files[original] = (text, box)
            scale = 96 / roi.shape[0]
            roi = cv2.resize(
                roi, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC
            )
            border = np.median(roi[0], axis=0).tolist()
            roi = cv2.copyMakeBorder(
                roi, 18, 18, 24, 24, cv2.BORDER_CONSTANT, value=border
            )
            file = Path(temp) / f"{i}.png"
            cv2.imwrite(str(file), roi)
            files[file] = (text, box)
        images = [*files, *(file for group in heading_files.values() for file in group)]
        if images:
            try:
                subprocess.run(
                    [str(vision), config["locale"], *map(str, images)],
                    timeout=40,
                    check=True,
                    capture_output=True,
                )
            except (OSError, subprocess.SubprocessError):
                return lines
        for (text, box), group in heading_files.items():
            rows = [load(Path(str(file) + ".ocr.json")) for file in group]
            if (all(len(row) == 1 and row[0]["confidence"] >= .5 for row in rows)
                    and " ".join(row[0]["text"].strip() for row in rows) == text):
                extra.append({"text": text, "box": box, "regionVerified": True, "labelBound": True})
        verified = set()
        partial_reads = {}
        for file, (text, box) in files.items():
            if (text, box) in verified:
                continue
            rows = load(Path(str(file) + ".ocr.json"))
            if len(text) <= 3:
                for row in rows:
                    reading = row["text"].strip()
                    if row["confidence"] >= .8 and partial_short_reading(text, reading, bounded_targets.get((text, box), "")):
                        partial_reads[text, box] = reading
            exact_label = (text, box) in exact_labels
            currency = bool(PLAIN_EUROS.fullmatch(text))
            if (text, box) in bounded_targets:
                matches = (rows and all(row["confidence"] >= .8 for row in rows) and
                           bounded_reading(text, [row["text"] for row in rows], bounded_targets[text, box]))
            elif exact_label or currency:
                matches = len(rows) == 1 and rows[0]["text"].strip() == text and rows[0]["confidence"] >= .8
            elif localized:
                matches = locale_crop_matches(text, rows, config["locale"], targets[text, box])
            else:
                matches = any(line["text"].strip() == text and line["confidence"] >= .5 for line in rows)
            if matches:
                verified.add((text, box))
                extra.append({"text": text, "box": box, "confidence": 1, "regionVerified": True,
                              "labelBound": localized or exact_label or currency or (text, box) in bounded_targets})
        for (text, box), reading in partial_reads.items():
            if (text, box) not in verified:
                extra.append({"text": text, "box": box, "partialReading": reading})
    return [*lines, *extra]


def english_cm_reading(expected, seen):
    # Vision can switch scripts within cm and transcribe the raised exponent as a baseline digit.
    powers = str.maketrans("²³", "23")
    expected = " ".join(expected.translate(powers).split())
    if not re.search(r"(?<!\w)cm[23]?(?!\w)", expected):
        return False
    actual = " ".join(" ".join(seen).translate(powers).split())
    actual, substitutions = re.subn(r"(?<!\w)[cс]т([23]?)(?!\w)", r"cm\1", actual)
    return substitutions > 0 and actual == expected


def visible_text_words(text):
    # Vision can render a multiplication sign as a lowercase x, including without spaces.
    return words(re.sub(r"(?<=\d)\s*[×x]\s*(?=\d)", " x ", text))


PRICE_INEQUALITY = re.compile(r"\d+ × €\d+[.,]\d{2} ≠ €\d+[.,]\d{2}")


def price_inequality_ink(line_image, wrapped):
    """A printed ≠ has two broad bars crossed by a rising diagonal stroke."""
    if line_image is None or not line_image.size:
        return False
    ink = line_image.max(axis=2) < 150
    xs = np.flatnonzero(ink.any(axis=0))
    if not len(xs):
        return False
    gaps = np.diff(xs) - 1
    if wrapped:
        columns = np.split(xs, np.flatnonzero(gaps > 0) + 1)[-1]
    else:
        # On a single line, the five space-separated tokens put ≠ fourth.
        separators = np.sort(np.argsort(gaps)[-4:])
        if len(separators) != 4 or min(gaps[separators]) < .15 * ink.shape[0]:
            return False
        columns = np.split(xs, separators + 1)[3]
    glyph = ink[:, columns[0]:columns[-1] + 1]
    ys = np.flatnonzero(glyph.any(axis=1))
    glyph = glyph[ys[0]:ys[-1] + 1]
    height, width = glyph.shape
    if min(height, width) < 12 or not glyph.any(axis=1).all():
        return False
    wide = np.flatnonzero(glyph.sum(axis=1) >= .75 * width)
    bars = np.split(wide, np.flatnonzero(np.diff(wide) > 1) + 1)
    if len(bars) != 2:
        return False
    upper, lower = bars
    # Check the slash above, between and below the bars. A double dagger stays vertical.
    gaps = (glyph[:upper[0]], glyph[upper[-1] + 1:lower[0]], glyph[lower[-1] + 1:])
    if any(len(gap) < 2 or gap.sum(axis=1).max() > .55 * width for gap in gaps):
        return False
    top, middle, bottom = (np.nonzero(gap)[1].mean() for gap in gaps)
    return top - middle > .08 * width and middle - bottom > .08 * width


def price_inequality_matches(text, rows, screen, screenshot):
    rows = sorted(rows, key=lambda row: (row["box"][1], row["box"][0]))
    expected = text.split()
    tokens = " ".join(row["text"] for row in rows).split()
    if len(tokens) != len(expected) or tokens[1] not in ("x", "×"):
        return False
    tokens[1] = "×"
    if tokens == expected:
        return True
    # The captured equation fits one line at Large and wraps after the operator at XL.
    wrapped = len(rows) == 2
    if (tokens != [*expected[:3], "‡", expected[4]] or len(rows) not in (1, 2)
            or (wrapped and rows[1]["text"].strip() != expected[4])
            or min(r.get("confidence", 0) for r in rows) < .8 or screenshot is None):
        return False
    image = cv2.imread(str(screenshot))
    return image is not None and price_inequality_ink(recordings.crop(image, rows[0]["box"], screen), wrapped)


def compact_place_label(text, node, stage, config):
    puzzle = config.get("compactPlacePuzzle")
    if not puzzle:
        return None
    response = puzzle.get("response") or {}
    is_proposal = stage == "entry" and node["type"] == "StaticText" and response.get("kind") == "judge"
    if node["type"] != "Button" and not is_proposal:
        return None
    locale = config["locale"]
    strings = locale_strings(locale)
    spoken, separator, verdict = text.partition(" · ")
    if separator and (stage != "checked" or response.get("kind") != "judge" or verdict not in {
        strings["puzzleTypes"][key].rstrip(" ✓✔✗✘") for key in ("trueLabel", "falseLabel")
    }):
        return None
    # Each spoken unit maps back to its printed place. Keep unbundled counts intact.
    units = {}
    for section, key, value in (("placeValue", "countTens", "10"), ("placeValue", "countOnes", "1"),
                                ("decimalModels", "countTenths", "0.1"), ("decimalModels", "countHundredths", "0.01")):
        for name, form in strings[section].items():
            if name.startswith(key + "_"):
                units[form.removeprefix("{{count}} ")] = value
    join = strings["placeValue"]["join"].removeprefix("{{first}}").removesuffix("{{last}}")
    terms = []
    for part in spoken.replace(join, ", ").split(", "):
        count, _, unit = part.partition(" ")
        if not count.isdecimal() or unit not in units:
            return None
        terms.append((count, units[unit]))
    if response.get("kind") in ("choose", "judge"):
        choices = response["options"] if response["kind"] == "choose" else [response["proposed"]]
        for choice in choices:
            raw = choice[locale] if isinstance(choice, dict) else choice
            pairs = re.fullmatch(r"\d+×\d+(?:\.\d+)?(?:\+\d+×\d+(?:\.\d+)?)*", "".join(raw.split()).replace(",", "."))
            if pairs:
                authored = [tuple(term.split("×")) for term in pairs[0].split("+")]
                if terms == ([term for term in authored if int(term[0])] or authored[-1:]):
                    break
        else:
            return None
    elif stage != "checked" or text != config.get("submittedPlace"):
        return None
    expression = " + ".join(n if unit == "1" else f"{n}×{unit}" for n, unit in terms)
    return (expression if locale == "en" else expression.replace(".", ",")) + separator + verdict


def compact_place_matches(expected, seen, verdict, config):
    # Compare every operand and operator. A line break can separate terms, never digits of one number.
    def tokens(value):
        return re.findall(r"\d+(?:[.,]\d+)?|[^\W\d_]+|[^\w\s]", value.replace("×", "x").replace("•", "·"))
    observed = tokens(" ".join(seen))
    if verdict and observed and observed[-1] in (
        {"✓", "✔", "-"} if verdict == config["verdict"].get("correct") else {"×", "x", "✗", "✘"}
    ):
        observed.pop()
    return tokens(expected) == observed


def text_check(states, config, *, compact_check=False, checked_screenshot=None):
    errors = []
    warnings = []
    tested = 0
    for stage, nodes, lines, screen in states:
        docks = [recordings.bounds(n) for n in landmarks(nodes, "play-answer-dock")]
        prices = config.get("entryPrices", ()) if stage == "entry" else ()
        price_labels = {(item["text"], tuple(item["box"])) for item in prices if item["source"] == "label"}
        errors.extend(f"entry: currency given {item['text']!r}: {item['reason']}" for item in prices if not item["verified"])
        glyphs = {(r["text"], tuple(r["box"])) for r in lines if "gridLetter" in r}
        for row in lines:
            if "gridLetter" in row:
                tested += 1
                if not row["verified"]:
                    errors.append(f"{stage}: grid letter {row['gridLetter']!r} clipped or unreadable in native bounds {row['box']}")
        lines = [r for r in lines if "gridLetter" not in r]
        partial_reads = {(r["text"], tuple(r["box"])): r["partialReading"] for r in lines if "partialReading" in r}
        verified_crops = {(r["text"], tuple(r["box"])) for r in lines if r.get("labelBound")}
        lines = [r for r in lines if not r.get("labelBound") and "partialReading" not in r]
        if not lines:
            errors.append(f"{stage}: no visible text recognized")
            continue
        merged_labels = verified_merged_labels(nodes, lines, screen, docks)
        def full_text_button(line):
            # The XL collapsed question (Play, after Check) is a one-line button whose label carries the full question:
            # its ellipsis is intentional because the full text is one tap (and one screen-reader swipe) away.
            shown = " ".join(line["text"].replace("…", "").replace("...", "").split()).lower()
            return len(shown) >= 8 and any(
                n["type"] == "Button" and label(n) and lines_in([line], recordings.bounds(n))
                and " ".join(label(n).split()).lower().startswith(shown[:-2]) and len(label(n)) > len(shown)
                for n in nodes)
        for line in lines:
            if (
                ("…" in line["text"] or "..." in line["text"])
                and not full_text_button(line)
                and line.get("confidence", 0) >= 0.65
                and any(
                    n["type"] in ("StaticText", "Heading", "Button")
                    and label(n)
                    and lines_in([line], recordings.bounds(n))
                    for n in nodes
                )
            ):
                errors.append(f"{stage}: visible ellipsis in {line['text']}")
        wrong_buttons = [n for n in nodes if stage == "checked" and n.get("type") == "Button"
                         and n.get("AXValue") and n["AXValue"] == config.get("verdict", {}).get("wrong")]
        unique = set()
        for n in nodes:
            text = label(n)
            box = visible_box(n, screen)
            native_box = recordings.bounds(n)
            if not text.strip() or (text, native_box, box) in unique or refresh_banner(text, native_box[1] / screen[3]):
                continue
            if (text, native_box) in glyphs:
                continue
            bounded = bounded_control_label(n, config)
            if bounded:
                text = bounded[0]
            elif n.get("type") in ("StaticText", "Heading"):
                pass
            elif n.get("type") == "Button" and config.get("answerTemplate") and text.startswith(
                config["answerTemplate"].split("{{answer}}")[0]
            ):
                text = text.removeprefix(
                    config["answerTemplate"].split("{{answer}}")[0]
                )
            elif n.get("type") == "Button" and (
                len(text.strip()) <= 3 or text in (config.get("checkLabel"), config.get("retryLabel"))
            ):
                pass
            else:
                continue
            unique.add((label(n), native_box, box))
            short = 0 < len(text.strip()) <= 3
            if short:
                if not box or not within(n, box) or under_answer_dock(n, native_box, docks):
                    tested += 1
                    errors.append(f"{stage}: short label {text!r} is clipped")
                    continue
            if not box:
                continue
            # Integer mat headers paint the unit and announce its count through VoiceOver.
            if n.get("type") == "StaticText" and any(a[1] in ("play-proof-area", "play-proof-model") for a in n["ancestors"]):
                unit, separator, count = text.rpartition(": ")
                if separator and count.isdecimal() and unit in config.get("matUnits", ()):
                    text = unit
            compact = compact_place_label(text, n, stage, config) if compact_check else None
            if compact is not None:
                seen = lines_in(lines, box)
                tested += 1
                verdict = n.get("AXValue") if stage == "checked" else None
                if not within(n, box) or not compact_place_matches(compact, seen, verdict, config):
                    errors.append(f"{stage}: compact place-value text clipped or differs: {compact!r}; image lines {seen!r}")
                continue
            expected = visible_text_words(text)
            if not bounded and not short and not expected:
                continue
            seen = lines_in(lines, box)
            tested += 1
            if (stage == "checked" and n["type"] == "StaticText" and PRICE_INEQUALITY.fullmatch(text)
                    and any(ident == "play-proof-equation" for _, ident, _ in n["ancestors"])):
                rows = [r for r in lines if not r.get("regionVerified") and lines_in([r], box)]
                if not within(n, box) or not price_inequality_matches(text, rows, screen, checked_screenshot):
                    errors.append(f"{stage}: could not verify price inequality {text!r}; image lines {seen!r}")
                continue
            if (text, tuple(recordings.bounds(n))) in price_labels and n["type"] == "StaticText":
                continue  # The native price crop supplies this label's result, including clipping failures.
            partial = partial_reads.get((text, native_box))
            if (text, native_box) in merged_labels and within(n, box):
                if partial and (text, native_box) not in verified_crops:
                    errors.append(f"{stage}: short label {text!r} truncated in native crop: {partial!r}")
                continue
            if short and not seen and (text, tuple(box)) not in verified_crops:
                if partial:
                    errors.append(f"{stage}: short label {text!r} truncated in native crop: {partial!r}")
                else:
                    warnings.append(f"{stage}: OCR missed short label {text!r} at {native_box}")
                continue
            if bounded:
                if not within(n, box) or (not bounded_reading(text, seen, bounded[1]) and (text, tuple(box)) not in verified_crops):
                    if short and short_label_ocr_miss(text, seen, partial, bounded[1]):
                        warnings.append(f"{stage}: OCR missed short label {text!r}; image lines {seen!r}")
                    else:
                        errors.append(f"{stage}: control label {text!r} clipped or unreadable; image lines {seen!r}")
                continue
            short_label = compact_check_label(n, config, stage == "entry" and compact_check)
            if short_label and within(n, box) and (seen == [short_label] or (short_label, tuple(box)) in verified_crops):
                continue
            if len(seen) > 1 and config.get("locale") in ("lv", "ru"):
                matched_rows = [r for r in lines if lines_in([r], box)]
                if locale_midword(text, matched_rows, config["locale"]):
                    errors.append(f"{stage}: mid-word break: {text!r}; image lines {seen!r}")
                    continue
            if (text, tuple(box)) in verified_crops and within(n, box):
                continue
            if len(seen) == 1 and text != seen[0] and merged_glyph_reading(text, box, lines, nodes):
                warnings.append(f"{stage}: OCR grouped short label {text!r} with a neighboring label; image lines {seen!r}")
                continue
            if short and (not expected or re.fullmatch(r"[+−-]\d+", text)):
                if text.replace("−", "-") not in [reading.strip().replace("−", "-") for reading in seen]:
                    issues = warnings if short_label_ocr_miss(text, seen, partial) else errors
                    issues.append(f"{stage}: short label {text!r} differs; image lines {seen!r}")
                continue
            if "cm" in text and config.get("locale") == "en" and within(n, box) and english_cm_reading(text, seen):
                continue
            reading = " ".join(seen)
            if (re.search("[Зз]", reading) and "=" in text
                    and re.fullmatch(r"[0-9\s.,+×÷−*/=()-]+", text)):
                # Correct Vision's Cyrillic ze before tokenizing the adjacent multiplication sign.
                corrected = re.sub("[Зз]", "3", reading)
                exact_crop = any(row.get("regionVerified") and row["text"] == text
                                 and tuple(row["box"]) == native_box for row in lines)
                if not within(n, box) or (not exact_crop and math_tokens(corrected) != math_tokens(text)):
                    errors.append(f"{stage}: numeric equation clipped or differs: {text!r}; image lines {seen!r}")
                continue
            # OCR can include an inline icon next to a string. Require all original words in order.
            actual = " " + " ".join(visible_text_words(reading)) + " "
            wanted = " " + " ".join(expected) + " "
            # Vision confuses isolated O/З with numbers on math boards. Match only against expected digits.
            actual = (
                " "
                + " ".join(
                    (
                        {"o": "0", "о": "0", "з": "3"}.get(token, token)
                        if {"o": "0", "о": "0", "з": "3"}.get(token) in expected
                        else token
                    )
                    for token in actual.split()
                )
                + " "
            )
            # A scroll viewport can show a contiguous portion of a longer paragraph.
            if not within(n, box) and seen and actual.strip() and actual in wanted:
                continue
            # Vision can join the trailing verdict cross to the last word of an answer.
            if (actual.strip() in {wanted.strip() + mark for mark in ("x", "х")}
                and any(label(b) == config["answerTemplate"].replace("{{answer}}", text)
                        and within(n, recordings.bounds(b)) for b in wrong_buttons)):
                continue
            if wanted not in actual and len(seen) > 1:
                # Vision sometimes emits the last line of a paragraph first.
                ordered = lines_in(sorted(lines, key=lambda row: (row["box"][1], row["box"][0])), box)
                if visible_text_words(" ".join(ordered)) == expected:
                    continue
            if wanted not in actual:
                if short:
                    issues = warnings if short_label_ocr_miss(text, seen, partial) else errors
                    issues.append(f"{stage}: short label {text!r} differs; image lines {seen!r}")
                    continue
                kind = (
                    "mid-word break"
                    if len(seen) > 1
                    and wanted.replace(" ", "") == actual.replace(" ", "")
                    else "visible text differs from AX or is unreadable"
                )
                errors.append(f"{stage}: {kind}: {text!r}; image lines {seen!r}")
    if not tested:
        errors.append("No text matched to a native label")
    return result(errors, warnings=warnings, verifiedOrComparedLabels=tested)


def contains_point(box, point):
    return box[0] <= point[0] <= box[2] and box[1] <= point[1] <= box[3]


# Compare math token by token. Only equivalent operator glyphs and spacing may differ.
OPERATOR_GLYPHS = str.maketrans({"−": "-", "×": "*", "x": "*", "÷": "/"})


def math_tokens(text):
    text = unicodedata.normalize("NFKC", text).translate(OPERATOR_GLYPHS)
    return re.findall(r"\d+(?:[.,]\d+)?|[^\s]", text)


def compare_dimension_labels(nodes, puzzle, locale):
    payload = puzzle.get("payload", {})
    if puzzle.get("type") != "geometry_measure" or payload.get("mode") != "compare":
        return []
    units = locale_strings(locale)["geometryModels"]
    expected = {}
    for name, shape in (("A", payload), ("B", payload.get("other") or {})):
        width = shape.get("width")
        if width is None:
            continue
        dimension = units["oneUnit"] if width == 1 else units["manyUnits"].replace("{{value}}", str(width))
        expected[f"{name} · {width}"] = expected[f"{name} · {dimension}"] = name
    return [(expected[label(n)], recordings.bounds(n)) for n in nodes
            if n.get("type") == "StaticText" and label(n) in expected
            and any(ident == "play-entry-model" for _, ident, _ in n["ancestors"])]


def early_answer(nodes, lines, inputs_, solution, puzzle, config, answer_kind=None):
    errors = []
    if solution is None or solution == "":
        return result(
            ["Missing verified correct submission to compare against the editor"]
        )
    if not lines or not nodes:
        return result(["Missing editor pixels or native tree"])
    if puzzle.get("type") == "fair_share" and answer_kind == "distribution":
        _, deal_errors = deal_targets(nodes, puzzle, config["locale"])
        errors.extend(deal_errors)
    if puzzle.get("type") == "budget_plan":
        goods, goods_errors = budget_targets(nodes, puzzle, config["locale"])
        errors.extend(goods_errors)
        basket = locale_strings(config["locale"])["everyday"]["basket"]
        for good in goods:
            if (good.get("selected") or "selected" in [str(t).lower() for t in good.get("traits", [])]
                    or label(good).endswith(", " + basket)):
                errors.append(f"Budget editor already selects {label(good)!r}")
    values = list(config["verdict"].values())
    if any(
        n.get("AXValue") in values
        or n.get("AXUniqueId") in ("play-submitted-response", "play-proof-equation")
        for n in nodes
    ):
        errors.append("Editor already shows a verdict or solution")
    # Choices may include the correct value. Exclude the choice buttons from the model's visual text.
    if not inputs_:
        errors.append("Cannot separate the answer options from the model")
    # A multi-item budget solution is a combination, so individual good labels are safe
    # to compare. A complete solution printed on a good must still be detected.
    masks = [] if puzzle.get("type") == "budget_plan" and puzzle["payload"]["pickCount"] > 1 else inputs_
    area = landmarks(nodes, "play-proof-area")
    box = recordings.bounds(area[0]) if area else None
    givens = puzzle.get("taskVisual", {})
    permitted = {
        str(givens[k])
        for k in ("left", "right", "rows", "columns", "items", "groups")
        if k in givens
    }
    if puzzle.get("type") == "compare":
        permitted.update(str(x) for x in puzzle["payload"].values())
    math_answer = (re.fullmatch(r"[0-9\s.,+×÷−*/=x()-]+", solution)
                   and re.search(r"[+×÷−*/=x-]", solution))
    sol = math_tokens(solution) if math_answer else normalized(solution)

    def check_text(text):
        if math_answer:
            tokens = math_tokens(text)
            lhs, equals, rhs = text.rpartition("=")
            explicit_result = bool(equals) and not lhs.rstrip().endswith(("!", "<", ">")) and math_tokens(rhs) == sol
            exposed = (tokens == sol and solution not in permitted) or explicit_result
        else:
            exposed = (normalized(text) == sol and solution not in permitted) or re.search(
                r"=\s*" + re.escape(solution) + r"(?!\w)", text, re.IGNORECASE
            )
        if exposed:
            errors.append(
                f"Model displays solution {solution!r} before Check: {text!r}"
            )

    if not box:
        errors.append("Missing pre-Check play-proof-area")
    if box:
        dimensions = compare_dimension_labels(nodes, puzzle, config.get("locale", "en"))
        for row in lines:
            center = (
                (row["box"][0] + row["box"][2]) / 2,
                (row["box"][1] + row["box"][3]) / 2,
            )

            if contains_point(box, center) and not any(
                contains_point(recordings.bounds(n), center) for n in masks
            ):
                # Vision can split "A · 1" into a figure name and a width.
                fragment = re.fullmatch(r"([AB])\s*[·•]?", row["text"].strip())
                if fragment and any(name == fragment[1] and contains_point(rect, center)
                                    for name, rect in dimensions):
                    continue
                check_text(row["text"])
        for n in nodes:
            if (
                n.get("type") in ("StaticText", "Heading")
                and within(n, box)
                and not any(within(n, recordings.bounds(b)) for b in masks)
            ):
                check_text(label(n))
    return result(
        errors,
        checkedAnswer=solution,
        coverage="Pre-Check AX verdicts, solution landmarks, explicit result equations and unmasked answer text in model pixels",
    )


def rectangles_overlap(first, second):
    return (max(first[0], second[0]) < min(first[2], second[2])
            and max(first[1], second[1]) < min(first[3], second[3]))


def stacked_fraction_equality(nodes, box):
    fractions = [(label(n), recordings.bounds(n)) for n in nodes if n.get("type") == "GenericElement"
                 and re.fullmatch(r"\d+/\d+", label(n)) and within(n, box)]
    if len(fractions) != 2:
        return None
    (left, lhs), (right, rhs) = sorted(fractions, key=lambda item: item[1][0])
    equals = set()
    for n in nodes:
        if n.get("type") not in ("Heading", "StaticText") or not label(n) or not within(n, box):
            continue
        rect = recordings.bounds(n)
        if label(n) == "=" and lhs[2] <= rect[0] < rect[2] <= rhs[0] and max(lhs[1], rhs[1]) <= (rect[1] + rect[3])/2 <= min(lhs[3], rhs[3]):
            equals.add(rect)
        elif not any(within(n, bounds) and label(n) in value.split("/") for value, bounds in fractions):
            return None
    return f"{left} = {right}" if len(equals) == 1 else None


def structure(boxes, nodes, lines):
    def located(key):
        return boxes.get(key) or [recordings.bounds(n) for n in landmarks(nodes, key)]

    models = located("play-proof-model")
    details = located("play-proof-detail")
    caps = located("play-proof-caption")
    eqs = located("play-proof-equation")
    errors = []
    if len(models) != 1 or details:
        errors.append(f"{len(models)} models and {len(details)} details")
    if len(caps) > 1 or len(eqs) > 1:
        errors.append(f"{len(caps)} caption slots and {len(eqs)} equation slots")
    # A wrapped equation is still one mathematical statement. A prose caption occupies at most one line.
    cap_lines = [t for box in caps for t in lines_in(lines, box)]
    prose = []
    equations = []
    for box in caps + eqs:
        if box in eqs and (equality := stacked_fraction_equality(nodes, box)):
            equations.append((equality, tuple(box)))
            continue
        counted_frames = {}
        seen = set()
        for n in nodes:
            if (
                n.get("type") not in ("StaticText", "Heading")
                or not within(n, box)
                or not label(n)
            ):
                continue
            rect = recordings.bounds(n)
            text = label(n)
            # walk retains each native frame object in its descendants' ancestry.
            # A scaling text child can extend beyond its parent during ProofFinale.
            repeated_ancestor = any(
                rectangles_overlap(rect, prior)
                for _, _, frame in n["ancestors"]
                if (prior := counted_frames.get((id(frame), text))) is not None
            )
            counted_frames[id(n["frame"]), text] = rect
            if repeated_ancestor or (text, rect) in seen:
                continue
            seen.add((text, rect))
            if box in eqs or re.search(r"[=≈≠÷×<>−+]|\d\s*[:/]\s*\d", text):
                equations.append((text, rect))
            else:
                prose.extend(lines_in(lines, rect))
    equation_source = None
    if not equations and not prose and len(eqs) == 1 and len(cap_lines) == 1:
        # AX can describe the in-progress frame while the screenshot and measured slot are settled.
        region = eqs[0]
        text = cap_lines[0]
        if re.search(r"\d.*[=≈≠].*\d", text) and any(
            line["text"] == text and line.get("confidence", 0) >= .8
            and recordings.inside(line["box"], region) for line in lines
        ):
            equations.append((text, tuple(region)))
            equation_source = "settled equation slot OCR"
    equations = list(dict.fromkeys(equations))
    if len(prose) > 1 or len(equations) > 1:
        errors.append(f"Extra caption lines or equations: {cap_lines}")
    if cap_lines and not prose and not equations:
        errors.append(
            "Caption has visible content without an identifiable text element"
        )
    return result(
        errors,
        models=models,
        details=details,
        captionLines=cap_lines,
        equations=[text for text, _ in equations],
        **({"equationSource": equation_source} if equation_source else {}),
    )


def editor_geometry(nodes, screen, config, size="large"):
    questions = editor_questions(nodes, size)
    docks = landmarks(nodes, "play-answer-dock")
    if len(questions) != 1 or len(docks) != 1:
        raise ValueError("Missing unique editor question or dock bounds")
    question = recordings.bounds(questions[0])
    dock = recordings.bounds(docks[0])
    models = []
    answer_prefix = config["answerTemplate"].split("{{answer}}")[0]
    for node in nodes:
        ident = node.get("AXUniqueId")
        role = node.get("type")
        ancestry = [a[1] for a in node["ancestors"]]
        # play-proof-area includes both the drawing and any hints next to it.
        explicit = ident in (
            "play-proof-model",
            "practice-board",
            "play-entry-model",
            "response-model",
            "bridge-plot",
            "bridge-ratio-model",
            "fraction-line-track",
            "fraction-strip-board",
        )
        drawable = "play-proof-area" in ancestry and role in (
            "Image",
            "Button",
            "Slider",
            "Adjustable",
        )
        if (
            not (explicit or drawable)
            or ident == "puzzle-picture-help"
            or (answer_prefix and label(node).startswith(answer_prefix))
        ):
            continue
        if (
            "scroll bar" in (node.get("role_description") or "").lower()
            or "scroll bar" in label(node).lower()
        ):
            continue
        box = visible_box(node, screen)
        if box:
            box = (box[0], max(box[1], question[3]), box[2], min(box[3], dock[1]))
            if box[2] > box[0] and box[3] > box[1]:
                models.append(box)
    return question, dock, list(dict.fromkeys(models))


def claim_text_in_model(nodes, config):
    """Identify the localized signature and its adjacent statement on the same model card."""
    signature = locale_strings(config["locale"])["puzzleTypes"]["minkaSays"]
    ignored = set()
    pending = None
    for node in nodes:
        if node.get("type") != "StaticText" or not label(node):
            continue
        ancestors = node["ancestors"]
        if not any(ident in ("play-proof-area", "play-entry-model", "play-proof-model")
                   for _, ident, _ in ancestors):
            continue
        if any(role in ("Button", "Heading") for role, _, _ in ancestors):
            continue
        text, box = label(node), recordings.bounds(node)
        if (text, box) in ignored:
            continue
        group = next((id(frame) for role, _, frame in reversed(ancestors) if role == "Group"), None)
        if text == signature or text.startswith(signature + " "):
            ignored.add((text, box))
            pending = (group, box[3]) if text == signature else None
        elif pending:
            parent, bottom = pending
            if group == parent and -1 <= box[1] - bottom <= 24:
                ignored.add((text, box))
            pending = None
    return ignored


def instruction(nodes, lines, screen, config, size="large"):
    question, dock, models = editor_geometry(nodes, screen, config, size)
    claims = claim_text_in_model(nodes, config)
    found = {}
    painted = {}
    errors = []
    for node in nodes:
        if node.get("type") != "StaticText" or not label(node) or plot_axis(node):
            continue
        if any(
            role in ("Button", "Heading", "Image", "Slider", "Adjustable", "TextField")
            or ident
            in (
                "play-proof-model",
                "play-entry-model",
                "play-answer-dock",
                "puzzle-question",
            )
            for role, ident, _ in node["ancestors"]
        ):
            continue
        box = visible_box(node, screen)
        if not box:
            continue
        center = ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)
        if not question[3] <= center[1] < dock[1] or any(
            contains_point(model, center) for model in models
        ):
            continue
        text = label(node)
        if any(a[1] == "play-proof-area" for a in node["ancestors"]):
            unit, _, _ = text.partition(": ")
            if unit in config.get("matUnits", ()) or text == config.get("matTotalLabel"):
                continue
        if (text, recordings.bounds(node)) in claims:
            continue
        key = (text, box)
        # Equations and numeric givens next to a board are part of the mathematical model.
        if key in found or not any(char.isalpha() for char in text):
            continue
        matches = [
            row
            for row in lines
            if contains_point(
                box,
                (
                    (row["box"][0] + row["box"][2]) / 2,
                    (row["box"][1] + row["box"][3]) / 2,
                ),
            )
        ]
        found[key] = [r["text"] for r in matches]
        if not matches:
            errors.append(f"Instruction unreadable: {text}")
        for row in matches:
            painted[tuple(row["box"])] = row["text"]
    # AX and OCR may each split one visual line into separate elements or fragments.
    baselines = []
    for box in sorted(painted, key=lambda b: (b[1] + b[3]) / 2):
        mid = (box[1] + box[3]) / 2
        height = box[3] - box[1]
        if not baselines or mid - baselines[-1][0] > 0.45 * min(
            height, baselines[-1][1]
        ):
            baselines.append((mid, height))
    if len(baselines) > 1:
        errors.append("More than one visible instruction line")
    return result(
        errors, instructions=list(found.values()), visibleLineCount=len(baselines)
    )


def movie_duration_ms(path):
    """Read the movie clock when a VFR recording ends on a long held frame."""
    with path.open("rb") as stream:
        end = path.stat().st_size
        while stream.tell() + 8 <= end:
            start = stream.tell()
            size = int.from_bytes(stream.read(4), "big")
            kind = stream.read(4)
            if size == 1:
                size = int.from_bytes(stream.read(8), "big")
            atom_end = end if size == 0 else start + size
            if not stream.tell() <= atom_end <= end:
                break
            if kind == b"moov":
                end = atom_end
                continue
            if kind == b"mvhd":
                version = stream.read(1)
                if version not in (b"\x00", b"\x01"):
                    break
                wide = version == b"\x01"
                stream.seek(3 + (16 if wide else 8), 1)
                scale = int.from_bytes(stream.read(4), "big")
                duration = int.from_bytes(stream.read(8 if wide else 4), "big")
                if scale and stream.tell() <= atom_end:
                    return 1000 * duration / scale
                break
            stream.seek(atom_end)
    raise ValueError("Missing recording duration")


def arrival(directory, config, model_bounds=None):
    window = 700

    def info(status, reason, **facts):
        return dict(status=status, windowMs=window, reason=reason, **facts)

    video = directory / "entry.mp4"
    if not video.is_file():
        return info("UNKNOWN", "No unsubmitted entry recording")
    nodes = list(walk(load(directory / "entry.json")))
    screen = recordings.bounds(nodes[0])
    models = model_bounds or editor_geometry(nodes, screen, config, directory.parent.name)[2]
    if not models:
        return info("UNKNOWN", "No visible native model bounds at entry")
    image = cv2.imread(str(directory / "entry.png"))
    if image is None:
        return info("UNKNOWN", "No editor reference image")
    size = (round(screen[2] - screen[0]), round(screen[3] - screen[1]))
    reference = cv2.resize(image, size, interpolation=cv2.INTER_AREA)

    def mask_for(boxes):
        mask = np.zeros(reference.shape[:2], np.uint8)
        for box in boxes:
            recordings.crop(mask, box, screen)[:] = 1
        return mask.astype(bool)

    model = mask_for(models)
    # Both question and Check must match the target editor before measuring. This excludes navigation transitions and previous fixtures.
    anchors = landmarks(nodes, "puzzle-question") + [
        n
        for n in nodes
        if n.get("type") == "Button" and label(n) == config["checkLabel"]
    ]
    if len(anchors) != 2:
        return info("UNKNOWN", "Missing editor anchors")
    edges = cv2.Canny(reference, 58, 135) > 0
    anchor_masks = [
        mask_for([box]) & edges for n in anchors if (box := visible_box(n, screen))
    ]
    if len(anchor_masks) != 2 or any(m.sum() < 12 for m in anchor_masks):
        return info("UNKNOWN", "Insufficient visible anchor pixels")
    ref = reference.astype(np.int16)
    baseline = None
    start = None
    previous_editor = False
    sampled = 0
    last = None
    cap = cv2.VideoCapture(str(video))
    try:
        while True:
            ok, image = cap.read()
            if not ok:
                break
            pts = cap.get(cv2.CAP_PROP_POS_MSEC)
            if start is not None and pts - start > window:
                break
            small = cv2.resize(image, size, interpolation=cv2.INTER_AREA)
            delta = np.abs(small.astype(np.int16) - ref).max(axis=2)
            aligned = all(np.mean(delta[m] <= 32) >= 0.84 for m in anchor_masks)
            if not aligned:
                if start is not None:
                    return info(
                        "UNKNOWN", "Editor moved or lost alignment during arrival"
                    )
                previous_editor = True
                continue
            if start is None and not previous_editor:
                return info("UNKNOWN", "Recording begins with editor already visible")
            frame = cv2.GaussianBlur(small, (3, 3), 0)[model].astype(np.int16)
            if baseline is None:
                baseline = frame
                start = pts
            last = pts
            sampled += 1
            changed = np.count_nonzero(np.abs(frame - baseline).max(axis=1) > 18)
            if changed >= max(9, np.ceil(len(frame) * 0.0005)):
                return info(
                    "YES",
                    "Distinct model pixels",
                    startPtsMs=round(start),
                    changeMs=round(pts - start),
                    sampledFrames=sampled,
                    changedPixels=int(changed),
                )
        if start is None:
            return info("UNKNOWN", "The editor could not be aligned to the recording")
        # Simulator MP4s are variable frame rate; a held frame lasts until the next PTS or the end of the stream.
        if pts - start < window and movie_duration_ms(video) - start < window:
            return info(
                "UNKNOWN",
                "Recording ended within the arrival window",
                sampledFrames=sampled,
            )
        return info(
            "NO",
            "No distinct model pixels in the recorded window",
            startPtsMs=round(start),
            sampledFrames=sampled,
            lastSampleMs=round(last - start),
        )
    finally:
        cap.release()


def clearance(frames, nodes, screen):
    errors = []
    gaps = []
    dock_nodes = landmarks(nodes, "play-answer-dock")
    final_dock = recordings.bounds(dock_nodes[0]) if dock_nodes else None
    for i, frame in enumerate(frames):
        b = frame["boxes"]
        answer = b.get("play-proof-answer")
        models = b.get("play-proof-model", [])
        if not answer:
            errors.append(f"Frame {i}: missing measured answer dock")
            continue
        if not models and i == len(frames) - 1:
            models = [
                recordings.bounds(n) for n in landmarks(nodes, "play-proof-model")
            ]
        if not models:
            errors.append(f"Frame {i}: missing measured model")
            continue
        rows = [
            r
            for name in ("caption", "answer", "controls", "result")
            for r in b.get("play-proof-" + name, [])
        ]
        top = min(r[1] for r in rows)
        if final_dock and i == len(frames) - 1:
            top = min(top, final_dock[1])
        for model in models:
            gap = top - model[3]
            gaps.append(round(gap, 2))
            if gap < 7.99:
                errors.append(f"Frame {i}: {gap:.2f} pt above dock")
            clips = b.get("play-proof-scroll", [])
            if not all(recordings.inside(model, r) for r in [screen, *clips]):
                errors.append(f"Frame {i}: model clipped")
    if not gaps:
        errors.append("No measured model/dock pair")
    return result(errors, minGapPt=min(gaps, default=None), frames=len(gaps))


def paint(video, audit, screen, nodes):
    events = audit["events"]
    phases = [e["phase"] for e in events]
    frames = audit.get("frames", [])
    failures = []
    if not all(p in phases for p in ("check", "painted", "ready", "landing")):
        return result(
            ["Missing Check, renderer paint, ready or first landing event"],
            phases=phases,
        )
    ready = next(e for e in events if e["phase"] == "ready")
    landing = next(e for e in events if e["phase"] == "landing")
    if (
        not phases.index("check") < phases.index("painted") < phases.index("landing")
        or phases.index("check") >= phases.index("ready")
        or phases.index("ready") >= phases.index("landing")
        or ready["time"] > landing["time"]
    ):
        failures.append("Invalid Check/ready/landing order")
    if not frames or not audit.get("videoFrames"):
        return result(failures + ["Missing native frame timecode"])
    capture = cv2.VideoCapture(str(video))
    seen_entry = False
    inspected = 0
    blank = []
    start = None
    end = None
    model = next(
        (
            f["boxes"]["play-proof-model"][0]
            for f in frames
            if f["boxes"].get("play-proof-model")
        ),
        None,
    )
    if not model:
        measured = landmarks(nodes, "play-proof-model")
        model = recordings.bounds(measured[0]) if measured else None
    if not model:
        capture.release()
        return result(failures + ["Missing model bounds for pixel checks"])
    # Use the verdict chip to include the native commit before the first numbered strip update.
    answer = next(
        (
            f["boxes"]["play-proof-answer"][0]
            for f in frames
            if f["boxes"].get("play-proof-answer")
        ),
        None,
    )
    if not answer:
        capture.release()
        return result(failures + ["Missing verdict bounds for pixel checks"])
    # The verdict face color in the settled screenshot distinguishes the red verdict from warm editor surfaces.
    final_model_frames = [
        frame["boxes"]["play-proof-answer"][0]
        for frame in frames
        if frame["boxes"].get("play-proof-answer")
    ]
    screenshot = cv2.imread(str(video.with_suffix(".png")))
    face = (
        recordings.crop(screenshot, final_model_frames[-1], screen)
        if screenshot is not None
        else None
    )
    if face is None or not face.size:
        capture.release()
        return result(["Missing verdict-face reference pixels"])
    color = np.median(face.reshape(-1, 3), axis=0).astype(np.int16)
    final_pts = landing.get("frame")
    checked = False
    before_landing = 0
    # An empty secondary button can share the wrong verdict's face colour at XL.
    # Match the actual unsubmitted Check button's ink before accepting the colour transition.
    entry_png = cv2.imread(str(video.parent / "entry.png"))
    editor = (
        list(walk(load(video.parent / "entry.json")))
        if (video.parent / "entry.json").exists()
        else []
    )
    dock_buttons = [
        n
        for n in editor
        if n["type"] == "Button"
        and any(ident == "play-answer-dock" for _, ident, _ in n["ancestors"])
    ]
    check_box = (
        recordings.bounds(max(dock_buttons, key=lambda n: recordings.bounds(n)[3]))
        if dock_buttons
        else None
    )
    reference_ink = None
    if check_box and entry_png is not None:
        native_ref = cv2.resize(entry_png, (280, round(280 * screen[3] / screen[2])))
        check_ref = recordings.crop(native_ref, check_box, screen)
        if check_ref.size:
            reference_ink = (
                cv2.Canny(cv2.cvtColor(check_ref, cv2.COLOR_BGR2GRAY), 50, 120) > 0
            )
    while True:
        ok, image = capture.read()
        if not ok:
            break
        pts = round(capture.get(cv2.CAP_PROP_POS_MSEC))
        serial = recordings.frame_number(image, screen)
        # Entry has several choices or a keypad. A checked chip has a wide green/red tinted face.
        small = cv2.resize(image, (280, round(280 * screen[3] / screen[2])))
        tinted_row = False
        for box in {tuple(answer), tuple(final_model_frames[-1])}:
            roi = recordings.crop(
                small, (box[0] + 5, box[1] + 2, box[2] - 5, box[3] - 2), screen
            )
            if (
                roi.size
                and np.count_nonzero(
                    (np.abs(roi.astype(np.int16) - color).max(axis=2) < 5).mean(axis=1)
                    > 0.78
                )
                >= 2
            ):
                tinted_row = True
                break
        editor_match = False
        if (
            serial == 0
            and reference_ink is not None
            and np.count_nonzero(reference_ink) >= 16
        ):
            candidate = recordings.crop(small, check_box, screen)
            candidate_edges = cv2.Canny(
                cv2.cvtColor(candidate, cv2.COLOR_BGR2GRAY), 50, 120
            )
            candidate_edges = cv2.dilate(candidate_edges, np.ones((3, 3), np.uint8))
            # Enablement swaps the face and glyph colors while preserving the Check label's shape.
            editor_match = np.mean(candidate_edges[reference_ink] > 0) >= 0.76
        if serial == 0 and (editor_match or not tinted_row):
            seen_entry = True
        if (
            seen_entry
            and not editor_match
            and (tinted_row or (serial is not None and serial > 0))
        ):
            checked = True
        if not checked:
            continue
        start = pts if start is None else start
        geometry = (
            frames[serial - 1]["boxes"] if serial and serial <= len(frames) else {}
        )
        region = next(iter(geometry.get("play-proof-model", [])), model)
        pixels = recordings.crop(small, region, screen)
        inspected += 1
        if serial is not None and final_pts is not None and serial <= final_pts:
            before_landing += 1
        if pixels.size == 0:
            blank.append(pts)
        else:
            gray = cv2.cvtColor(pixels, cv2.COLOR_BGR2GRAY)
            # A smooth tray fill or vertical background gradient is not foreground ink.
            if np.count_nonzero(cv2.Canny(gray, 35, 90)) < max(6, gray.size * 0.0008):
                blank.append(pts)
        if serial and final_pts is not None and serial >= final_pts + 1:
            end = pts
            break
    capture.release()
    if start is None or end is None or not before_landing:
        failures.append("Video did not cover editor through first landing")
    if blank:
        failures.append(
            f"Blank model pixels in {len(blank)} frames, first at {blank[0]} ms"
        )
    return result(
        failures,
        checkPtsMs=start,
        firstLandingPtsMs=end,
        checkedFrames=inspected,
        blankPtsMs=blank,
    )


def proof_centering(frames, nodes):
    def native_boxes(name):
        return [recordings.bounds(n) for n in landmarks(nodes, name)]

    viewport = native_boxes("play-model-scroll") or native_boxes("play-proof-scroll")
    offsets = []
    errors = []
    for index, f in enumerate(frames or [{"boxes": {}}]):
        boxes = f["boxes"]
        models = boxes.get("play-proof-model", [])
        if not models and index == max(0, len(frames) - 1):
            models = native_boxes("play-proof-model")
        if not models:
            continue
        area = boxes.get("play-proof-scroll") or viewport
        if len(area) != 1:
            errors.append(f"Frame {index}: missing unique content viewport")
            continue
        for model in models:
            offset = (model[0] + model[2] - area[0][0] - area[0][2]) / 2
            offsets.append(offset)
            if off_center(offset):
                errors.append(f"Frame {index}: model offset {offset:+.3f} pt")
    if not offsets:
        errors.append("No measured proof-model and content viewport pair")
    return result(errors, offsetsPt=[round(v, 4) for v in offsets], maximumOffsetPt=4)


def proof_hairline(directory, mode):
    import precheck

    try:
        data = load(directory / (mode + ".json"))
        nodes = list(walk(data["native"]))
        screen = recordings.bounds(nodes[0])
        frames = data["audit"].get("frames", [])
        models = [
            recordings.bounds(n) for n in landmarks(nodes, "play-proof-model")
        ] or (frames[-1]["boxes"].get("play-proof-model", []) if frames else [])
        if len(models) != 1:
            return {"status": "UNKNOWN", "reason": "No unique checked model perimeter"}
        content = [n for n in nodes if within(n, models[0])]
        return precheck.hairline(
            cv2.imread(str(directory / (mode + ".png"))), screen, content, models[0]
        )
    except (OSError, KeyError, ValueError, IndexError, TypeError, cv2.error) as err:
        return {"status": "UNKNOWN", "reason": str(err)}


RETAINED_QUANTITY_EDITORS = {
    "multiple_choice_array", "multiple_choice_join", "multiple_choice_share", "multiple_choice_take_away",
}


def retry_without_playback(variant, mode, events, nodes, config, frames):
    if mode != "wrong" or variant in {"compare", "fair_share"}:
        return False
    buttons = [n for n in nodes if n.get("type") == "Button"]
    if not (any(n.get("AXValue") == config["verdict"]["wrong"] for n in buttons)
            and any(label(n) == config["retryLabel"] for n in buttons)):
        return False
    phases = [event["phase"] for event in events]
    if variant in RETAINED_QUANTITY_EDITORS:
        return (phases == ["check"] and len(landmarks(nodes, "play-entry-model")) == 1
                and not any(landmarks(nodes, key) or any(f["boxes"].get(key) for f in frames)
                            for key in ("play-proof-model", "play-proof-controls")))
    ax_models = landmarks(nodes, "play-proof-model")
    final_models = frames[-1]["boxes"].get("play-proof-model", []) if frames else []
    sampled_model = any(right > left and bottom > top for left, top, right, bottom in final_models)
    if phases == ["check"]:
        # A submitted diagram can be a static comparison with a measured model and no playback UI.
        return (not ax_models and not final_models) or (len(ax_models) == len(final_models) == 1
                and sampled_model and not any(f["boxes"].get("play-proof-controls") for f in frames)
                and not landmarks(nodes, "play-proof-controls"))
    # A static submitted board can still acknowledge paint and settlement at zero landings.
    return (phases == ["check", "painted", "ready", "settled", "completed"]
            and all(e.get("landed") == 0 for e in events if e["phase"] in ("ready", "settled"))
            and (bool(ax_models) or sampled_model))


def inspect(folder, case, size, mode, config):
    directory = folder / size / case["variant"]
    prefix = directory / mode
    captured = load(prefix.with_suffix(".json"))
    audit = captured["audit"]
    check = audit.get("check") or {}
    nodes = list(walk(captured["native"]))
    screen = recordings.bounds(nodes[0])
    events = audit.get("events", [])
    phases = [e["phase"] for e in events]
    frames = audit.get("frames", [])
    scale = check.get("fontScale", 0)
    if (
        audit.get("puzzleId") != case["id"]
        or phases.count("check") != 1
        or check.get("locale") != config["locale"]
        or not (scale == 1 if size == "large" else scale > 1)
    ):
        raise ValueError(
            "Fixture, locale, text size or Check did not match the request"
        )
    if not any(
        n.get("type") == "Button" and n.get("AXValue") == config["verdict"][mode]
        for n in nodes
    ):
        raise ValueError("Wrong verdict on captured screen")
    checks = {}
    puzzle = case["puzzle"]
    if puzzle.get("type") == "budget_plan" and config["locale"] == "en":
        keep = locale_strings("en")["challenges"]["budgetKeep"]
        config = {**config, "budgetReserveLabel": f"{keep} {puzzle['payload']['remaining']:g}"}
    if puzzle.get("type") in ("place_value", "decimal_place_value"):
        locale = locale_strings(config["locale"])
        units = [locale["placeValue"][unit] for unit in ("tens", "ones")]
        units.extend(locale["decimalModels"][unit] for unit in ("ones", "tenths", "hundredths"))
        config = {**config, "matUnits": units, "matTotalLabel": locale["placeValue"]["totalLabel"],
                  "compactPlacePuzzle": puzzle, "submittedPlace": check.get("submitted")}
    retry_only = retry_without_playback(case["variant"], mode, events, nodes, config, frames)
    if retry_only:
        for key in ("oneModel", "motion", "firstPaint"):
            checks[key] = {"status": "N/A", "reasons": ["First miss offers retry without proof playback"], "phases": phases}
    else:
        start = next((e["time"] for e in events if e["phase"] == "playing"), None)
        end = next((e["time"] for e in events if e["phase"] == "settled"), None)
        span = end - start if end is not None and start is not None else None
        checks["motion"] = result(
            (
                []
                if span is not None and 0 <= span <= 4500
                else [f"Unverified or out-of-budget active span: {span}"]
            ),
            activeMs=span,
        )
        if mode == "wrong" and case["variant"] in RETAINED_QUANTITY_EDITORS:
            checks["motion"] = result(["Expected the submitted editor with Try again and only the Check event"], phases=phases)
        checks["firstPaint"] = paint(prefix.with_suffix(".mp4"), audit, screen, nodes)
    checks["clearance"] = clearance(frames, nodes, screen)
    checks["centering"] = proof_centering(frames, nodes)

    def read_ocr(path):
        return ocr(path, screen) if path.exists() else []

    after = read_ocr(prefix.with_suffix(".png.ocr.json"))
    if not retry_only:
        if "settled" in phases and frames and after:
            checks["oneModel"] = structure(frames[-1]["boxes"], nodes, after)
        else:
            checks["oneModel"] = result(
                ["Missing settled proof frame or readable screenshot"]
            )
    try:
        entry = list(walk(load(directory / "entry.json")))
        question = question_labels(entry)
        authored = puzzle.get("question")
        if isinstance(authored, dict):
            authored = authored.get(config["locale"])
        # XL can condense the checked question. The editor must agree with the checked heading or authored prompt.
        checked_question = question_labels(nodes)
        if not checked_question and size != "large":
            reference = load(folder / "large" / case["variant"] / "correct.json")
            if reference["audit"].get("puzzleId") == case["id"]:
                checked_question.update(question_labels(list(walk(reference["native"]))))
        if not question or not question.intersection(checked_question | {authored}):
            raise ValueError("Editor fixture question could not be verified")
        before = read_ocr(directory / "entry.png.ocr.json")
        checks["input"], controls = inputs(entry, screen, config, check, puzzle)
        checks["instruction"] = (
            instruction(entry, before, screen, config, size)
            if before
            else result(["Missing editor OCR"])
        )
        checks["text"] = text_check(
            [
                (
                    "entry",
                    entry,
                    regional_labels(
                        directory / "entry.png", entry, screen, before, config, compact_check=scale >= 2
                    ),
                    screen,
                ),
                (
                    "checked",
                    nodes,
                    regional_labels(
                        prefix.with_suffix(".png"), nodes, screen, after, config
                    ),
                    screen,
                ),
            ],
            config,
            compact_check=scale >= 2,
            checked_screenshot=prefix.with_suffix(".png"),
        )
        correct = load(directory / "correct.json")
        valid = correct["audit"].get("puzzleId") == case["id"] and any(
            n.get("AXValue") == config["verdict"]["correct"]
            for n in walk(correct["native"])
        )
        solution = correct["audit"].get("check", {}).get("submitted") if valid else None
        checks["noEarlyAnswer"] = early_answer(
            entry, before, controls, solution, puzzle, config, check.get("answerKind")
        )
    except (OSError, ValueError, KeyError, IndexError) as err:
        for rule in ["input", "instruction", "text", "noEarlyAnswer"]:
            checks.setdefault(rule, result([str(err)]))
    if retry_only and phases == ["check"] and not any(f["boxes"].get("play-proof-model") for f in frames):
        # Retained editors have no proof frames. Zero-landing submissions keep their measured layout above.
        import precheck
        try:
            geometry, _, _ = precheck.board_geometry(
                nodes, after, cv2.imread(str(prefix.with_suffix(".png"))),
                retained_take_away=case["variant"] == "multiple_choice_take_away", size=size,
            )
            checks.update(geometry)
        except (ValueError, IndexError, KeyError, cv2.error) as err:
            checks["clearance"] = checks["centering"] = result([f"Missing retained board geometry: {err}"])
    return checks


def main():
    folder = Path(sys.argv[1])
    vision = sys.argv[2]
    config = load(folder / "capture.json")
    root = HERE.parents[2]
    db = {}
    for file in (root / "assets/puzzles").glob("*.json"):
        data = load(file)
        if isinstance(data, list):
            db.update({p["id"]: p for p in data if isinstance(p, dict) and "id" in p})
    import precheck

    results = []
    for case in config["cases"]:
        case = {**case, "puzzle": db.get(case["id"], {})}
        for size in ["large", "accessibility-extra-large"]:
            directory = folder / size / case["variant"]
            images = sorted(directory.glob("*.png"))
            # Captures are immutable. Reuse recognized pixels unless the image or recognizer source changed.
            images = [
                image
                for image in images
                if not image.with_suffix(".png.ocr.json").exists()
                or image.with_suffix(".png.ocr.json").stat().st_mtime
                < max(image.stat().st_mtime, (HERE / "recognize.swift").stat().st_mtime)
            ]
            if images:
                try:
                    subprocess.run(
                        [vision, config["locale"], *map(str, images)],
                        check=True,
                        timeout=90,
                    )
                except (subprocess.SubprocessError, OSError) as err:
                    print(f"OCR failed: {err}", file=sys.stderr)
            try:
                entry_rules, entry_info = precheck.inspect(folder, case, config, size)
                entry_screen = result(
                    [f"{name}: {reason}" for name, rule in entry_rules.items()
                     for reason in rule["reasons"]],
                    warnings=entry_rules["text"].get("warnings", ()),
                    rules=entry_rules,
                )
                case_config = {**config, "entryPrices": entry_rules["text"].get("currencyGivens", [])}
                entry_centre = entry_rules["centering"]
                arrival_info = entry_info["arrivalAnimation"]
                hairline_info = entry_info["hairlineFrame"]
            except (
                ValueError,
                TypeError,
                OSError,
                KeyError,
                IndexError,
                cv2.error,
                subprocess.SubprocessError,
            ) as err:
                case_config = config
                entry_screen = entry_centre = result([str(err)])
                hairline_info = {"status": "UNKNOWN", "reason": str(err)}
                arrival_info = {
                    "status": "UNKNOWN",
                    "windowMs": 700,
                    "reason": str(err),
                }
            for mode in ["correct", "wrong"]:
                try:
                    rules = inspect(folder, case, size, mode, case_config)
                except (
                    ValueError,
                    OSError,
                    TypeError,
                    IndexError,
                    KeyError,
                    cv2.error,
                ) as err:
                    rules = {rule: result([str(err)]) for rule in RULES}
                rules["preAnswer"] = entry_screen
                proof_centre = rules.get("centering", result(["Missing proof bounds"]))
                rules["centering"] = result(
                    entry_centre["reasons"] + proof_centre["reasons"],
                    entry=entry_centre,
                    proof=proof_centre,
                )
                if size != "large":
                    measured_input = rules["input"]
                    rules["input"] = {"status": "N/A", "reasons": ["Default-size rule"]}
                    if case["puzzle"].get("type") == "budget_plan":
                        rules["input"]["measurement"] = measured_input
                results.append(
                    {
                        "variant": case["variant"],
                        "id": case["id"],
                        "size": size,
                        "outcome": mode,
                        "rules": rules,
                        "info": {
                            "arrivalAnimation": arrival_info,
                            "hairlineFrame": hairline_info,
                            "proofHairlineFrame": proof_hairline(directory, mode),
                        },
                        "evidence": str(directory / mode),
                    }
                )
        durations = [
            folder / size / case["variant"] / "duration.json"
            for size in ["large", "accessibility-extra-large"]
        ]
        if all(record.exists() for record in durations):
            ms = sum(load(record)["captureMs"] for record in durations)
            for row in results[-4:]:
                row["variantCaptureMs"] = ms
        (folder / "report.json").write_text(
            json.dumps(
                {
                    "locale": config["locale"],
                    "udid": config["udid"],
                    "family": config.get("family"),
                    "runs": results,
                },
                indent=2,
                ensure_ascii=False,
            )
            + "\n"
        )
    print(
        "Variant | Size | Outcome | "
        + " | ".join(RULES)
        + " | arrival (info) | hairline entry / proof (info)"
    )
    for r in results:
        print(
            " | ".join(
                [
                    r["variant"],
                    r["size"],
                    r["outcome"],
                    *(r["rules"][k]["status"] for k in RULES),
                    r["info"]["arrivalAnimation"]["status"],
                    r["info"]["hairlineFrame"]["status"]
                    + " / "
                    + r["info"]["proofHairlineFrame"]["status"],
                ]
            )
        )
    return int(
        any(rule["status"] == "FAIL" for r in results for rule in r["rules"].values())
    )


if __name__ == "__main__":
    sys.exit(main())
