import unittest

from analyze import inputs, text_check, walk
from precheck import model_bounds


def node(role, frame, label='', ident='', children=()):
    return dict(type=role, frame=dict(zip(('x', 'y', 'width', 'height'), frame)),
                AXUniqueId=ident, AXLabel=label, children=children)


class PlaceValueEvidenceTest(unittest.TestCase):
    def test_column_title_is_visible_and_count_is_spoken(self):
        native = list(walk([node('Group', (0, 0, 200, 110), ident='play-proof-area', children=[
            node('StaticText', (0, 0, 80, 40), label='Tens: 3'),
        ])]))
        config = dict(answerTemplate='Answer {{answer}}', retryLabel='Try again', checkLabel='Check', matUnits=['Tens'])
        for visible, status in [('Tens', 'PASS'), ('Ten', 'FAIL')]:
            lines = [dict(text=visible, box=[2, 2, 50, 30])]
            self.assertEqual(status, text_check([('entry', native, lines, (0, 0, 200, 400))], config)['status'])

    def test_xl_compact_choice_compares_entire_authored_expression(self):
        puzzle = {"response": {"kind": "choose", "options": ["2 × 10 + 12 × 1"]}}
        config = dict(locale="en", answerTemplate="Answer {{answer}}", retryLabel="Try again",
                      checkLabel="Check", compactPlacePuzzle=puzzle, verdict={"wrong": "Incorrect"})
        native = list(walk([node("Button", (0, 0, 170, 70), "Answer 2 tens and 12 ones")]))
        def score(parts, screen=(0, 0, 200, 80), xl=True):
            lines = [dict(text=part, box=[2, 2 + i*25, 67, 24 + i*25], confidence=1)
                     for i, part in enumerate(parts)]
            return text_check([("entry", native, lines, screen)], config, compact_check=xl)["status"]
        for lines in (["2×10 + 12"], ["2 x 10 +", "12"]):
            self.assertEqual("PASS", score(lines))
        for lines in (["2×10 + 1"], ["2×1 + 12"], ["2×10 12"], ["2×10 + 12…"],
                      ["2×10 + 1", "2"], ["2×10 + 12×"]):
            self.assertEqual("FAIL", score(lines))
        self.assertEqual("FAIL", score(["2×10 + 12"], (0, 0, 100, 60)))
        self.assertEqual("FAIL", score(["2×10 + 12"], xl=False))
        puzzle["response"]["options"] = ["1 × 10 + 22 × 1"]
        self.assertEqual("FAIL", score(["2×10 + 12"]))

    def test_actionable_column_contributes_to_model_bounds(self):
        content = list(walk([node('Button', (5, 40, 90, 100), ident='decimal-exchange'),
                             node('Image', (105, 40, 90, 100))]))
        box, _ = model_bounds(content, None, None, [], None, None)
        self.assertEqual((5, 40, 195, 140), box)

    def test_inline_answer_must_be_visible_above_dock(self):
        for y, expected in [(50, 'PASS'), (130, 'FAIL')]:
            native = list(walk([node('Group', (0, 0, 200, 160), ident='play-model-scroll', children=[
                node('Group', (0, 0, 200, 180), ident='play-proof-area', children=[
                    node('Button', (0, y, 80, 48), 'Add 28', 'place-value-addOperand'),
                    node('Button', (0, 0, 80, 48), 'Reset', 'place-value-reset')])]),
                node('Group', (0, 150, 200, 80), ident='play-answer-dock', children=[
                    node('Button', (0, 160, 100, 44), 'Check')])]))
            result, controls = inputs(native, (0, 0, 200, 300), dict(checkLabel='Check', answerTemplate='Answer {{answer}}'),
                                      {}, dict(type='place_value'))
            self.assertEqual(expected, result['status'])
            self.assertEqual(['Add 28'], [c['AXLabel'] for c in controls])
