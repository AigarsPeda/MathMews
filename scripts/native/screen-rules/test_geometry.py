"""Offline geometry regressions. Run with the screen-rules Python environment."""

import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np

from analyze import bounded_reading, early_answer, editor_questions, ocr, off_center, proof_centering, text_check, walk
from precheck import board_geometry
from tile_edges import measure


class ModelGeometryTest(unittest.TestCase):
    def test_wrapped_rectangle_dimension_requires_name_separator_and_full_width(self):
        for rows in (["A•12"], ["A •", "12"], ["A", "· 12"]):
            self.assertTrue(bounded_reading("A · 12", rows))
        for rows in (["A•"], ["12"], ["B •", "12"], ["A", "12"], ["A •", "1"],
                     ["A • 1", "2"], ["A •", "12…"], ["A • 12", "= A"]):
            self.assertFalse(bounded_reading("A · 12", rows))

    def test_compare_figure_name_is_a_given_only_in_its_dimension_label(self):
        def frame(x, width):
            return dict(x=x, y=0, width=width, height=70)
        def score(reading, *, solution="A", caption="A · 1", x=5, mode="compare", other_label=False):
            labels = [dict(type="StaticText", AXLabel=caption, frame=frame(0, 70))]
            if other_label:
                labels.append(dict(type="StaticText", AXLabel=solution, frame=frame(90, 30)))
            model = dict(type="Group", AXUniqueId="play-entry-model", frame=frame(0, 200), children=labels)
            area = dict(type="Group", AXUniqueId="play-proof-area", frame=frame(0, 200), children=[model])
            row = dict(text=reading, box=(x, 5, x+22, 25))
            puzzle = dict(type="geometry_measure", payload=dict(mode=mode, width=1, other=dict(width=2)))
            return early_answer(list(walk([area])), [row], [dict(frame=frame(200, 40))],
                                solution, puzzle, {"locale": "en", "verdict": {}})["status"]
        for caption in ("A · 1", "A · 1 unit"):
            for reading in ("A", "A•", "A ·"):
                self.assertEqual("PASS", score(reading, caption=caption))
        self.assertEqual("PASS", score("B•", solution="B", caption="B · 2"))
        for options in (dict(x=95), dict(caption="A · 2"), dict(caption="B · 2"),
                        dict(mode="area"), dict(other_label=True)):
            self.assertEqual("FAIL", score("A•", **options))
        self.assertEqual("FAIL", score("= A"))

    def test_xl_measures_from_full_question_before_model(self):
        def group(ident, top, height, children=()):
            return dict(type="Group", AXUniqueId=ident, frame=dict(x=0, y=top, width=100, height=height),
                        children=children)
        model = group("play-entry-model", 120, 40)
        full = group("play-full-question", 50, 60)
        shortcut = group("puzzle-question", 230, 35)
        nodes = list(walk([group("screen", 0, 300, [
            group("play-model-scroll", 40, 150, [full, model]),
            group("play-answer-dock", 195, 100, [shortcut])
        ])]))
        self.assertEqual("puzzle-question", editor_questions(nodes, "large")[0]["AXUniqueId"])
        rules, _, _ = board_geometry(nodes, [], np.full((300, 100, 3), 255, np.uint8),
                                     size="accessibility-extra-large")
        self.assertEqual(35, rules["clearance"]["gapPt"])
        legacy = [n for n in nodes if n.get("AXUniqueId") != "play-full-question"]
        self.assertEqual("puzzle-question", editor_questions(legacy, "accessibility-extra-large")[0]["AXUniqueId"])

    def test_only_top_refresh_banner_is_excluded(self):
        lines = [("Refreshing...", .08), ("Refreshing…", .081), ("Refresh...", .085),
                 ("Refreshing…", .5), ("Model…", .08)]
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "rows.json"
            path.write_text(json.dumps([dict(text=t, box=[.4, y, .6, y+.02], confidence=1) for t,y in lines]))
            kept = ocr(path, (0, 0, 100, 300))
        self.assertEqual(["Refresh...", "Refreshing…", "Model…"], [r["text"] for r in kept])
        nodes = list(walk([dict(type="StaticText", AXLabel=t, frame=dict(x=0,y=y,width=100,height=10))
                           for t,y in [("Refreshing...", 24), ("Model", 120)]]))
        visible = [dict(text="Model", box=(5, 120, 80, 130), confidence=1)]
        self.assertEqual("PASS", text_check([("entry", nodes, visible, (0,0,100,300))], {})["status"])

    def test_offset_is_measured_against_the_content_viewport(self):
        for offset in (-4.001, -4, 0, 4, 4.001):
            with self.subTest(offset=offset):
                frames = [
                    {
                        "boxes": {
                            "play-proof-scroll": [[20, 0, 140, 180]],
                            "play-proof-model": [[60 + offset, 20, 100 + offset, 60]],
                        }
                    }
                ]
                expected = abs(offset) > 4
                self.assertEqual(expected, off_center(offset))
                self.assertEqual(
                    "FAIL" if expected else "PASS",
                    proof_centering(frames, [])["status"],
                )
        self.assertEqual(
            "FAIL",
            proof_centering([{"boxes": {"play-proof-model": [[0, 0, 8, 8]]}}], [])[
                "status"
            ],
        )

    def test_lines_and_outlines_at_native_scale(self):
        for scale in (1, 2, 3):
            for distance, thickness, step, expected in (
                (1, 1, 1, "YES"),
                (3 * scale, 1, 1, "YES"),
                (3 * scale + 1, 1, 1, "NO"),
                (2, 2, 1, "NO"),
                (2, 1, 2, "NO"),
            ):
                for light in (False, True):
                    with self.subTest(
                        scale=scale,
                        distance=distance,
                        thickness=thickness,
                        step=step,
                        light=light,
                    ):
                        image = np.full(
                            (60 * scale, 80 * scale, 3), 20 if light else 230, np.uint8
                        )
                        ink = 230 if light else 20
                        l, t, r, b = [value * scale for value in (20, 15, 60, 45)]
                        image[
                            t - distance - thickness + 1 : t - distance + 1, l:r:step
                        ] = ink
                        image[
                            b + distance - 1 : b + distance - 1 + thickness, l:r:step
                        ] = ink
                        image[
                            t:b:step, l - distance - thickness + 1 : l - distance + 1
                        ] = ink
                        image[
                            t:b:step, r + distance - 1 : r + distance - 1 + thickness
                        ] = ink
                        out = measure(image, (0, 0, 80, 60), [(20, 15, 60, 45)])
                        self.assertEqual(expected, out["status"])
                        if expected == "YES":
                            self.assertEqual(
                                {"top", "left", "bottom", "right"},
                                {x["edge"] for x in out["lines"]},
                            )

    def test_single_canvas_grid_without_native_tile_ids(self):
        image = np.full((170, 180, 3), 255, np.uint8)
        for top in (40, 65, 90):
            for left in (40, 65, 90, 115):
                image[top : top + 22, left : left + 22] = (188, 116, 66)
        region = (34, 34, 144, 119)
        self.assertEqual("NO", measure(image, (0, 0, 180, 170), [], region)["status"])
        image[37, 40:137] = 0
        out = measure(image, (0, 0, 180, 170), [], region)
        self.assertEqual("YES", out["status"])
        self.assertEqual(["top"], [hit["edge"] for hit in out["lines"]])

    def test_unmeasurable_perimeter_stays_unknown(self):
        image = np.full((60, 80, 3), 250, np.uint8)
        self.assertEqual(
            "UNKNOWN", measure(image, (0, 0, 80, 60), [], (0, 0, 80, 60))["status"]
        )
        self.assertEqual(
            "UNKNOWN", measure(image, (0, 0, 80, 60), [(0, 0, 20, 20)])["status"]
        )


if __name__ == "__main__":
    unittest.main()
