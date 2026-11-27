import unittest

import numpy as np

from analyze import deal_targets, structure, walk
from precheck import take_away_trays


class DealTargetsTest(unittest.TestCase):
    def test_each_initial_cookie_and_empty_plate_has_its_own_enabled_target(self):
        puzzle = {'payload': {'items': 4, 'people': 2, 'object': 'cookie'}}
        labels = [f'cookies {i}, Supply' for i in range(1, 5)] + ['Plate 1, 0', 'Plate 2, 0']
        for names, valid in [(labels, True), (labels[:-1], False), (labels + labels[:1], False),
                             ([*labels[:-1], 'Plate 2, 2'], False)]:
            nodes = list(walk([dict(type='Group', AXUniqueId='play-proof-area', children=[
                dict(type='Button', AXLabel=name, enabled=True) for name in names])]))
            controls, errors = deal_targets(nodes, puzzle, 'en')
            self.assertEqual(valid, not errors)
            if valid:
                self.assertEqual(6, len(controls))
                nodes[1]['enabled'] = False
                self.assertTrue(deal_targets(nodes, puzzle, 'en')[1])


class RetainedTraysTest(unittest.TestCase):
    def test_requires_both_painted_trays_and_measures_their_union(self):
        image = np.zeros((160, 240, 3), dtype=np.uint8)
        image[30:120, 15:145] = [247, 244, 227]
        area = (10, 20, 230, 150)
        screen = (0, 0, 240, 160)
        self.assertIsNone(take_away_trays(image, area, screen))
        image[45:105, 165:225] = [220, 243, 255]
        self.assertEqual((15, 30, 225, 120), take_away_trays(image, area, screen))


class SettledEquationTest(unittest.TestCase):
    def test_requires_one_equation_within_its_native_slot(self):
        boxes = {'play-proof-model': [[0, 0, 200, 40]], 'play-proof-equation': [[0, 50, 200, 80]],
                 'play-proof-caption': [[0, 50, 200, 80]]}
        eq = dict(text='2/3 of 18 = 12', confidence=1, box=[20, 55, 180, 70])
        self.assertEqual(['2/3 of 18 = 12'], structure(boxes, [], [eq])['equations'])
        for rows in [[dict(eq, confidence=.4)], [eq, dict(eq, text='Second line')],
                     [dict(eq, box=[20, 40, 180, 70])], [dict(eq, text='Answer')]]:
            self.assertEqual('FAIL', structure(boxes, [], rows)['status'])
