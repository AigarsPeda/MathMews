import unittest

from analyze import text_check, walk
from currency_givens import matches_price, read_prices


class CurrencyGivensTest(unittest.TestCase):
    def test_requires_the_entire_currency_amount_in_its_crop(self):
        def match(*lines, grouped=False, confidence=1):
            rows = [dict(text=t, confidence=confidence) for t in lines]
            return matches_price('€20', rows, grouped=grouped)

        self.assertTrue(match('€20'))
        self.assertTrue(match(')€20', '€2', grouped=True))
        self.assertFalse(match(')€20'))
        self.assertTrue(match('€20 •€4', grouped=True))
        self.assertTrue(match('€20 •€', grouped=True))
        for text in ('€200 •€4', '€20 0', '€20 .50', '€20… •€4'):
            self.assertFalse(match(text, grouped=True))
        self.assertFalse(match('€20', confidence=.6))
        for lines in [('€2',), ('€Z0',), ('€20…',), ('€20.00',), ('€2', '0'), ('20',), ('€200',)]:
            self.assertFalse(match(*lines, grouped=True))

    def test_coin_requires_full_visible_denomination_or_its_own_crop(self):
        config = dict(answerTemplate="Answer {{answer}}", retryLabel="Retry", checkLabel="Check")
        frame = dict(x=10, y=10, width=40, height=20)
        native = list(walk([dict(type="Button", AXLabel="€10", frame=frame)]))
        box = (10, 10, 50, 30)
        def score(reading, *, screen=(0, 0, 100, 100), crop=None):
            lines = [dict(text=reading, box=box, confidence=1)]
            if crop:
                lines.append(dict(text="€10", box=crop, labelBound=True))
            return text_check([("entry", native, lines, screen)], config)["status"]
        self.assertEqual("PASS", score("€10"))
        self.assertEqual("PASS", score("OLE", crop=box))
        for reading in ("€1", "€100", "10", "€10…", "€10.00", "OLE"):
            self.assertEqual("FAIL", score(reading))
        self.assertEqual("FAIL", score("OLE", crop=(60, 10, 100, 30)))
        self.assertEqual("FAIL", score("€10", screen=(0, 0, 39, 100)))

    def test_neighboring_price_cannot_override_failed_crop(self):
        frame = dict(x=10, y=10, width=40, height=20)
        nodes = list(walk([dict(type='StaticText', AXLabel='€20', frame=frame)]))
        row = dict(text='€20', box=[10, 10, 50, 30], confidence=1)
        item = dict(text='€20', box=row['box'], source='label', verified=False, reason="crop read ['€2']")
        state = ('entry', nodes, [row], (0, 0, 150, 150))
        self.assertEqual('FAIL', text_check([state], {'entryPrices': [item]})['status'])
        item['verified'] = True
        row['text'] = '€Z0'
        self.assertEqual('PASS', text_check([state], {'entryPrices': [item]})['status'])
        item['box'] = [60, 10, 100, 30]
        self.assertEqual('FAIL', text_check([state], {'entryPrices': [item]})['status'])

    def test_cropped_target_fails_before_ocr(self):
        frame = dict(x=10, y=100, width=100, height=50)
        leaf = dict(type='StaticText', AXLabel='€11', frame=frame)
        group = dict(type='Image', AXLabel='Apple: €11', frame=frame, children=[leaf])
        nodes = list(walk([dict(type='Group', AXUniqueId='play-entry-model', children=[group])]))
        rows = read_prices(None, nodes, (0, 0, 300, 300), (0, 140, 300, 300), None, 'en')
        self.assertEqual(1, len(rows))
        self.assertFalse(rows[0]['verified'])
        self.assertIn('outside', rows[0]['reason'])
