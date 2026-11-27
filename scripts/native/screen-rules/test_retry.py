import unittest

from analyze import claim_text_in_model, retry_without_playback, text_check, walk


class SubmittedTextTest(unittest.TestCase):
    def score(self, pixels, verdict='Incorrect', stage='checked', text='2 each, 1 left'):
        frame = dict(x=20, y=20, width=250, height=50)
        nodes = list(walk([dict(type='Button', AXValue=verdict, AXLabel='Answer ' + text,
                                frame=frame, children=[dict(type='StaticText', AXLabel=text, frame=frame)])]))
        lines = [dict(text=pixels, box=[30, 30, 160, 55], confidence=1)]
        config = dict(verdict=dict(wrong='Incorrect'), answerTemplate='Answer {{answer}}',
                      checkLabel='Check', retryLabel='Try again')
        return text_check([(stage, nodes, lines, [0, 0, 390, 800])], config)['status']

    def test_joined_verdict_mark(self):
        for mark in ('x', '×', 'х'):
            self.assertEqual('PASS', self.score('2 each, 1 left' + mark))

    def test_verdict_mark_does_not_hide_missing_or_clipped_text(self):
        for pixels in ('2 each, 1 lefx', '2 each, 1 left…', '2 ea ch, 1 leftx'):
            self.assertEqual('FAIL', self.score(pixels))
        self.assertEqual('FAIL', self.score('2 each, 1 leftx', verdict='Correct'))
        self.assertEqual('FAIL', self.score('2 each, 1 leftx', stage='entry'))


class RetryProofTest(unittest.TestCase):
    def test_only_complete_retry_screens_skip_proof_rules(self):
        retry = dict(type='Button', AXLabel='Try again')
        verdict = dict(type='Button', AXValue='Incorrect')
        model = dict(AXUniqueId='play-proof-model')
        events = [dict(phase=p, landed=0) for p in ('check', 'painted', 'ready', 'settled', 'completed')]

        def accepted(trace, nodes, mode='wrong', frames=(), variant='place_value_build'):
            return retry_without_playback(variant, mode, trace, nodes, dict(retryLabel='Try again', verdict=dict(wrong='Incorrect')), frames)

        self.assertTrue(accepted(events[:1], [retry, verdict]))
        self.assertTrue(accepted(events, [retry, verdict, model]))
        self.assertFalse(accepted(events, [retry, verdict, model], mode='correct'))
        self.assertFalse(accepted(events[:1], [retry]))
        self.assertFalse(accepted(events[:1], [verdict]))
        self.assertFalse(accepted(events[:1], [retry, verdict, model]))
        self.assertFalse(accepted(events[:3], [retry, verdict, model]))
        self.assertFalse(accepted(events + [dict(phase='playing')], [retry, verdict, model]))
        sampled = dict(boxes={'play-proof-model': [[22, 453, 371, 597]]})
        self.assertTrue(accepted(events, [retry, verdict], frames=[sampled]))
        self.assertFalse(accepted(events[:1], [retry, verdict], frames=[sampled]))
        self.assertTrue(accepted(events[:1], [retry, verdict, model], frames=[sampled]))
        playback = dict(boxes={**sampled['boxes'], 'play-proof-controls': [[22, 620, 371, 664]]})
        self.assertFalse(accepted(events[:1], [retry, verdict, model], frames=[playback]))
        self.assertFalse(accepted(events[:3], [retry, verdict], frames=[sampled]))
        self.assertFalse(accepted(events, [retry, verdict], frames=[sampled, dict(boxes={})]))
        self.assertFalse(accepted(events, [retry, verdict], frames=[dict(boxes={'play-proof-model': [[22, 453, 371, 453]]})]))
        editor = [retry, verdict, dict(AXUniqueId='play-entry-model')]
        for variant in ('multiple_choice_array', 'multiple_choice_join', 'multiple_choice_take_away', 'multiple_choice_share'):
            with self.subTest(variant=variant):
                self.assertTrue(accepted(events[:1], editor, variant=variant))
                self.assertFalse(accepted(events[:1], [retry, verdict], variant=variant))
                self.assertFalse(accepted(events, editor + [model], variant=variant))
                self.assertFalse(accepted(events[:1], editor, variant=variant, frames=[playback]))
        for variant in ('compare', 'fair_share'):
            with self.subTest(variant=variant):
                self.assertFalse(accepted(events[:1], editor, variant=variant))
                self.assertFalse(accepted(events, [retry, verdict, model], variant=variant))
        events[3]['landed'] = 1
        self.assertFalse(accepted(events, [retry, verdict, model]))


class ModelClaimTest(unittest.TestCase):
    def test_signed_card_excludes_only_signature_and_statement(self):
        def text(value, y):
            return dict(type='StaticText', AXLabel=value, frame=dict(x=0, y=y, width=150, height=20))
        def group(children, ident=''):
            return dict(type='Group', AXUniqueId=ident, frame=dict(x=0, y=0, width=200, height=300), children=children)
        nodes = list(walk([group([text('Minka saka:', 0), text('Use four tens.', 26), text('Count each block.', 52),
                                  group([text('Minka saka:', 84)]), group([text('Choose the answer.', 109)])], 'play-proof-area'),
                           group([text('Minka saka: outside', 180)])]))
        excluded = claim_text_in_model(nodes, dict(locale='lv'))
        self.assertEqual({('Minka saka:', (0,0,150,20)), ('Use four tens.', (0,26,150,46)),
                          ('Minka saka:', (0,84,150,104))}, excluded)
