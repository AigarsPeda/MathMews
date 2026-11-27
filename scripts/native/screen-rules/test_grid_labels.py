import unittest
from unittest.mock import patch

import cv2
import numpy as np

import grid_glyphs
from analyze import grid_label_evidence, instruction, locale_strings, walk


class GridLabelsTest(unittest.TestCase):
    def test_button_prints_its_letter_in_every_locale(self):
        frame = dict(x=0, y=0, width=80, height=60)
        for locale in ("en", "lv", "ru"):
            strings = locale_strings(locale)
            name = strings["play"]["answerLabel"].replace("{{answer}}", "B")
            location = strings["everyday"]["gridLocation"].replace("{{row}}", "2").replace("{{column}}", "3")
            node = dict(type="Button", AXLabel=f"{name}, {location}", AXUniqueId="grid-choice-8", frame=frame)
            nodes = list(walk([node]))
            for painted, clipped, expected in (("B", False, True), ("A", False, False), ("B", True, False)):
                image = np.full((60, 80, 3), 240, np.uint8)
                ink = cv2.resize(grid_glyphs.reference(painted), (26, 36)) > .5
                image[10:46, 20:46][ink] = (75, 49, 36)
                if clipped:
                    image[:, 35:] = 240
                result, = grid_label_evidence(nodes, (0, 0, 80, 60), locale, image=image)
                self.assertEqual(expected, result["verified"], (locale, painted, clipped))
            node["AXUniqueId"] = "unrelated-button"
            self.assertEqual([], grid_label_evidence(list(walk([node])), (0, 0, 80, 60), locale, image=image))

    def test_axis_and_two_real_instruction_lines(self):
        def node(text, y, container):
            frame = dict(x=0, y=y, width=80, height=18)
            return dict(type="Group", AXUniqueId=container, frame=frame,
                        children=[dict(type="StaticText", AXLabel=text, frame=frame)])
        nodes = list(walk([node("x", 40, "bridge-plot-frame"), node("Move x", 60, "editor")]))
        geometry = ((0, 0, 100, 20), (0, 200, 100, 300), [])
        lines = [dict(text="Move x", box=[0, 60, 75, 78])]
        with patch("analyze.editor_geometry", return_value=geometry):
            self.assertEqual("PASS", instruction(nodes, lines, (0, 0, 100, 300), {"locale": "en"})["status"])
            nodes.extend(walk([node("Tap a square", 90, "editor")]))
            lines.append(dict(text="Tap a square", box=[0, 90, 75, 108]))
            checked = instruction(nodes, lines, (0, 0, 100, 300), {"locale": "en"})
            self.assertEqual(("FAIL", 2), (checked["status"], checked["visibleLineCount"]))
