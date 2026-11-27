import unittest

from analyze import partial_short_reading, text_check, verified_merged_labels, walk
from precheck import score_text


class ShortLabelTest(unittest.TestCase):
    screen = (0, 0, 200, 200)
    config = dict(answerTemplate="Answer {{answer}}", checkLabel="Check", retryLabel="Retry",
                  verdict={"correct": "Correct"})

    def score(self, text, reading=None, *, button=False, x=10, partial=None, editor=False):
        frame = dict(x=x, y=10, width=40, height=20)
        if button:
            child = dict(type="Button", AXLabel=f"Answer {text}", AXValue="Correct", frame=frame)
            nodes = list(walk([dict(type="Group", AXUniqueId="play-submitted-response",
                                    frame=frame, children=[child])]))
        else:
            nodes = list(walk([dict(type="StaticText", AXLabel=text, frame=frame)]))
        # Other screen text distinguishes a missing label from a failed OCR capture.
        lines = [dict(text="Next", box=(100, 90, 150, 110), confidence=1)]
        box = (x, 10, x + 40, 30)
        if reading is not None:
            lines.append(dict(text=reading, box=box, confidence=1))
        if partial:
            lines.append(dict(text=text, box=box, partialReading=partial))
        if editor:
            return score_text(nodes, nodes, lines, self.screen, (0, 180, 200, 200), self.config)
        return text_check([("checked", nodes, lines, self.screen)], self.config)

    def test_only_unread_short_labels_warn(self):
        for text in ("2", "+1", "−1", "x", "123"):
            for editor in (False, True):
                with self.subTest(text=text, editor=editor):
                    result = self.score(text, editor=editor)
                    self.assertEqual("WARNING", result["status"])
                    self.assertEqual([], result["reasons"])
                    self.assertIn(repr(text), result["warnings"][0])
                    self.assertEqual("PASS", self.score(text, text, editor=editor)["status"])
        self.assertEqual("WARNING", self.score("2", button=True)["status"])
        for text in ("", "    ", "1234"):
            self.assertEqual("FAIL", self.score(text)["status"])

    def test_clipping_partial_digits_and_truncation_fail(self):
        for editor in (False, True):
            for x in (-12, -60):
                self.assertEqual("FAIL", self.score("2", x=x, editor=editor)["status"])
            for text, seen in (("12", "1"), ("123", "13"), ("12", "12…"), ("+1", "+"), ("−1", "1")):
                self.assertEqual("FAIL", self.score(text, seen, editor=editor)["status"])
            self.assertEqual("FAIL", self.score("12", partial="1", editor=editor)["status"])
        self.assertEqual("FAIL", self.score("12", "1✓", button=True)["status"])

    def test_unreadable_ocr_warns_but_contradictory_or_partial_readings_fail(self):
        for editor in (False, True):
            for text, reading in (("2", "|"), ("+1", "•"), ("−1", "I"), ("x", "»"), ("−", "•")):
                self.assertEqual("WARNING", self.score(text, reading, editor=editor)["status"])
            for text, reading in (("2", "3"), ("+1", "+"), ("−1", "-"), ("cat", "ca"), ("−", "+")):
                self.assertEqual("FAIL", self.score(text, reading, editor=editor)["status"])
            self.assertEqual("FAIL", self.score("12", "•", partial="1", editor=editor)["status"])
            self.assertEqual("FAIL", self.score("x", "»", x=-12, editor=editor)["status"])
        self.assertEqual("WARNING", self.score("2", "|", button=True)["status"])

    def test_plain_button_miss_and_dock_clipping(self):
        frame = dict(x=10, y=90, width=40, height=20)
        button = dict(type="Button", AXLabel="x", frame=frame)
        model = dict(type="Group", AXUniqueId="play-model-scroll", frame=frame, children=[button])
        dock = dict(type="Group", AXUniqueId="play-answer-dock", frame=dict(x=0, y=100, width=200, height=100))
        rows = [dict(text="Next", box=(100, 90, 150, 110))]
        for elements, status in (([model], "WARNING"), ([model, dock], "FAIL")):
            states = [("entry", list(walk(elements)), rows, self.screen)]
            self.assertEqual(status, text_check(states, self.config)["status"])

    def test_native_crop_preserves_evidence_of_truncation(self):
        for expected, seen in (("123", "13"), ("12", "1✓"), ("cat", "ca"), ("x", "…")):
            self.assertTrue(partial_short_reading(expected, seen, "✓"))
        for seen in ("", "✓", "12✓"):
            self.assertFalse(partial_short_reading("12", seen, "✓"))

    def test_merged_glyph_needs_a_neighbor_on_the_matching_side(self):
        def score(glyph, neighbor, reading, neighbor_x=4):
            def label(text, x):
                return dict(type="StaticText", AXLabel=text, frame=dict(x=x, y=10, width=20, height=20))
            nodes = list(walk([label(glyph, 30), label(neighbor, neighbor_x)]))
            rows = [dict(text=reading, box=(18, 10, 46, 30), confidence=1)]
            return text_check([("entry", nodes, rows, self.screen)], self.config)
        for glyph, neighbor, reading in (("7", "5", "57"), ("→", "3", "3 →"), ("7", "7", "77")):
            result = score(glyph, neighbor, reading)
            self.assertEqual("PASS", result["status"])
        for reading in ("5", "75", "57…"):
            self.assertEqual("FAIL", score("7", "5", reading)["status"])
        self.assertEqual("FAIL", score("7", "5", "57", neighbor_x=100)["status"])

    def test_whole_merged_row_and_run_position(self):
        def match(left, right, reading, row_right=60):
            nodes = list(walk([dict(type="StaticText", AXLabel=text,
                                    frame=dict(x=x, y=0, width=30, height=20))
                               for text, x in ((left, 0), (right, 30))]))
            rows = [dict(text=reading, box=(0, 0, row_right, 20), confidence=1)]
            return verified_merged_labels(nodes, rows, self.screen, [])
        for a, b, row in (("5", "17", "517"), ("Count", "x", "Count x"), ("x", "→", "x→")):
            self.assertEqual(2, len(match(a, b, row)))
        for a, b, row in (("5", "17", "57"), ("5", "7", "X57"), ("5", "7", "57…"),
                          ("5", "7", "75"), ("Count", "x", "Countx"), ("5", "17", "51 7")):
            self.assertFalse(match(a, b, row))
        self.assertFalse(match("5", "7", "57", row_right=32))
