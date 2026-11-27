import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

import cv2
import numpy as np

from analyze import bounded_control_label, bounded_reading, early_answer, text_check, walk


class MultiplicationTextTest(unittest.TestCase):
    def test_cyrillic_three_in_numeric_equation(self):
        equation = "3 × 10 + 6 = 36"
        frame = dict(x=0, y=0, width=240, height=40)
        native = list(walk([dict(type="StaticText", AXLabel=equation, frame=frame)]))
        def score(reading, width=240):
            line = dict(text=reading, box=(0, 0, 200, 35), confidence=1)
            return text_check([("checked", native, [line], (0, 0, width, 40))], {})["status"]
        for reading in ("З × 10 + 6 = 36", "зx10+6=36"):
            self.assertEqual("PASS", score(reading))
        for reading in ("З × 1 + 6 = 36", "З × 10 − 6 = 36", "З x 10 6 = 36",
                        "З × 10 + 6 = 3", "З × 10 + 6 = 36…"):
            self.assertEqual("FAIL", score(reading))
        self.assertEqual("FAIL", score("З × 10 + 6 = 36", width=220))

    def test_numeric_multiplication_in_visible_equation(self):
        equation = '1375\xa0ml = 5 × 250\xa0ml + 125\xa0ml'
        native = list(walk([dict(type='StaticText', AXLabel=equation,
                                 frame=dict(x=0, y=0, width=300, height=40))]))
        for product, status in [('5 x 250', 'PASS'), ('5×250', 'PASS'), ('5x250', 'PASS'),
                                ('5 250', 'FAIL'), ('5 + 250', 'FAIL'), ('5 x 25', 'FAIL'),
                                ('5x 250…', 'FAIL')]:
            with self.subTest(product=product):
                line = dict(text=f'1375 ml = {product} ml + 125 ml', box=[0, 0, 300, 40], confidence=1)
                state = ('checked', native, [line], (0, 0, 300, 40))
                self.assertEqual(status, text_check([state], {})['status'])


class WrappedPriceTest(unittest.TestCase):
    equation = '4 × €2.00 ≠ €10.00'

    def score(self, first, second='€10.00', screenshot=None, landmark='play-proof-equation'):
        frame = dict(x=0, y=0, width=250, height=100)
        child = dict(type='StaticText', AXLabel=self.equation, frame=frame)
        native = list(walk([dict(type='Group', AXUniqueId=landmark, frame=frame, children=[child])]))
        rows = [dict(text=first, box=[10, 5, 210, 62], confidence=1),
                dict(text=second, box=[80, 65, 170, 100], confidence=1)]
        return text_check([('checked', native, rows, (0, 0, 250, 100))], {},
                          checked_screenshot=screenshot)['status']

    def test_exact_digits_currency_and_both_operators(self):
        for first in ['4 × €2.00 ≠', '4 x €2.00 ≠']:
            self.assertEqual('PASS', self.score(first))
        for first in ['4 + €2.00 ≠', '4 x €2.00 =', '4 x €2.00', '4 x €2.01 ≠',
                      '4 x 2.00 ≠', '4 x €2.00 ‡']:
            self.assertEqual('FAIL', self.score(first))
        for second in ['€1.00', '10.00', '€10.0…']:
            self.assertEqual('FAIL', self.score('4 × €2.00 ≠', second))

    def test_double_dagger_requires_diagonal_ink(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / 'price.png'
            for stroke, status in [(None, 'FAIL'), ((180, 180), 'FAIL'), ((170, 191), 'FAIL'),
                                   ((191, 170), 'PASS')]:
                image = np.full((100, 250, 3), 255, dtype=np.uint8)
                for y in (23, 43):
                    cv2.line(image, (159, y), (202, y), (0, 0, 0), thickness=6)
                if stroke:
                    cv2.line(image, (stroke[0], 11), (stroke[1], 55), (0, 0, 0), thickness=6)
                cv2.imwrite(str(path), image)
                self.assertEqual(status, self.score('4 x €2.00 ‡', screenshot=path))
                self.assertEqual('FAIL', self.score('4 x €2.00 ‡', screenshot=path, landmark='other'))

    def test_single_line_checks_the_operator_between_the_prices(self):
        from analyze import price_inequality_matches

        rows = [dict(text='4 × €2.00 ‡ €10.00', box=[0, 0, 260, 60], confidence=1)]
        with TemporaryDirectory() as directory:
            path = Path(directory) / 'single-line.png'
            for end, expected in [(154, True), (174, False)]:
                image = np.full((60, 260, 3), 255, dtype=np.uint8)
                for left, right in [(7, 20), (42, 56), (78, 125), (203, 251)]:
                    cv2.rectangle(image, (left, 12), (right, 46), (0, 0, 0), -1)
                for y in (20, 38):
                    cv2.line(image, (148, y), (182, y), (0, 0, 0), thickness=5)
                cv2.line(image, (174, 8), (end, 50), (0, 0, 0), thickness=5)
                cv2.imwrite(str(path), image)
                self.assertEqual(expected, price_inequality_matches(self.equation, rows, [0, 0, 260, 60], path))

class OperatorAnswerTest(unittest.TestCase):
    def score(self, solution, shown, *, masked=False, ax=False):
        def frame(x, width):
            return dict(x=x, y=0, width=width, height=40)
        area = dict(type="Group", AXUniqueId="play-proof-area", frame=frame(0, 200))
        control = dict(type="Button", frame=frame(0 if masked else 140, 50))
        nodes = [area, control]
        if ax:
            nodes.append(dict(type="StaticText", AXLabel=shown, frame=frame(2, 40)))
        line = dict(text="?" if ax else shown, box=[2, 2, 42, 30])
        return early_answer(nodes, [line], [control], solution, {}, {"verdict": {}})["status"]

    def test_operators_and_operands_retain_their_meaning(self):
        for solution, distractors in [("+  ×", ["?", "→", "=", "+", "×", "× +"]),
                                      ("÷ +", ["+", "÷", "÷ −", "÷ ×"]),
                                      ("×4", ["+4", "4", "×40", "× 4 0", "? != ×4", "? = ×4 + 1"])]:
            for shown in distractors:
                self.assertEqual("PASS", self.score(solution, shown), (solution, shown))
        for solution, shown in [("+  ×", "+×"), ("÷ +", "/ +"), ("×4", "x 4"), ("−4", "-4"),
                                ("+ ×", "result = + *"), ("4 + 11, 3 + 12", "4 + 11, 3 + 12")]:
            for ax in [False, True]:
                self.assertEqual("FAIL", self.score(solution, shown, ax=ax), (solution, shown, ax))
                self.assertEqual("PASS", self.score(solution, shown, ax=ax, masked=True), (solution, shown, ax))

    def test_correct_litre_chip_keeps_the_unit_and_all_digits(self):
        node = dict(type="Button", AXLabel="Answer 6 L", AXValue="Correct",
                    ancestors=[("Group", "play-submitted-response", None)])
        config = dict(answerTemplate="Answer {{answer}}", verdict={"correct": "Correct"})
        expected, marks = bounded_control_label(node, config)
        for reading in ("6 L", "6L~", "6 L-", "6 L ✓"):
            self.assertTrue(bounded_reading(expected, [reading], marks))
        for reading in ("6", "L~", "6 ml", "16L~", "6.1L~", "6L…", "6L~~"):
            self.assertFalse(bounded_reading(expected, [reading], marks))
        self.assertIsNone(bounded_control_label({**node, "AXValue": "Incorrect"}, config))


class CentimetreTextTest(unittest.TestCase):
    def score(self, expected, seen, locale="en"):
        frame = dict(x=5, y=5, width=240, height=40)
        native = list(walk([dict(type="Heading", AXLabel=expected, frame=frame)]))
        lines = [dict(text=seen, box=[10, 10, 200, 36], confidence=1)]
        return text_check([("entry", native, lines, (0, 0, 300, 150))], {"locale": locale})["status"]

    def test_complete_unit_in_english_only(self):
        label = "Volume in cm³?"
        for read in ("Volume in cт3?", "Volume in ст³?"):
            self.assertEqual("PASS", self.score(label, read))
            self.assertEqual("FAIL", self.score(label, read, "ru"))
        for read in ("Volume in cт?", "Volume in cт2?", "Volume in cт30?", "Volume in cт3…",
                     "Volume in c т3?", "Volume in mm3?", "Volume in cт3"):
            self.assertEqual("FAIL", self.score(label, read))
        label = "8 cm × 4 cm × 4 cm"
        self.assertEqual("PASS", self.score(label, "8 cт × 4 cm × 4 cm"))
        for read in ("8 cт + 4 cm × 4 cm", "8 cт × 4 cm × cm", "8 cт × 4 cm × 4 cт2"):
            self.assertEqual("FAIL", self.score(label, read))
