import unittest

from analyze import early_answer, inputs, walk


class BudgetEditorTest(unittest.TestCase):
    screen = (0, 0, 390, 800)
    config = dict(locale='en', checkLabel='Check answer', answerTemplate='Answer {{answer}}',
                  verdict=dict(correct='Correct', wrong='Wrong'))
    names = ('Book', 'Plant', 'Chair', 'Toy mouse')
    puzzle = dict(type='budget_plan', payload=dict(pickCount=2, items=[{'label': {'en': name}} for name in names]))

    def setUp(self):
        self.goods = [dict(type='Button', enabled=True, AXLabel=f'{name}, 280 pretend coins, 20% off',
                           frame=dict(x=20 + 165*(i % 2), y=240 + 100*(i // 2), width=155, height=90))
                      for i, name in enumerate(self.names)]
        self.area = dict(type='Group', AXUniqueId='play-proof-area', children=self.goods,
                         frame=dict(x=15, y=150, width=360, height=580))
        self.check = dict(type='Button', AXLabel='Check answer', enabled=False,
                          frame=dict(x=20, y=740, width=350, height=44))
        self.dock = dict(type='Group', AXUniqueId='play-answer-dock', children=[self.check],
                         frame=dict(x=0, y=720, width=390, height=80))

    def score(self, *lines):
        nodes = list(walk([self.area, self.dock]))
        input_rule, goods = inputs(nodes, self.screen, self.config, {}, self.puzzle)
        early = early_answer(nodes, list(lines) or [dict(text='Shop', box=(20, 155, 100, 180))], goods,
                             'Book + Toy mouse', self.puzzle, self.config, 'budget')
        return input_rule['status'], early['status']

    def test_initial_goods_and_check(self):
        self.assertEqual(('PASS', 'PASS'), self.score())
        self.goods[0]['enabled'] = False
        self.assertEqual(('FAIL', 'FAIL'), self.score())
        self.goods.pop(0)
        self.assertEqual(('FAIL', 'FAIL'), self.score())

    def test_duplicate_wrong_role_and_wrong_name(self):
        for field, value in [('AXLabel', self.goods[1]['AXLabel']), ('type', 'StaticText'), ('AXLabel', 'Bookcase')]:
            with self.subTest(field=field, value=value):
                original = self.goods[0][field]
                self.goods[0][field] = value
                self.assertEqual(('FAIL', 'FAIL'), self.score())
                self.goods[0][field] = original

    def test_good_must_be_visible_above_dock(self):
        self.goods[0]['frame']['y'] = 690
        self.assertEqual('FAIL', self.score()[0])

    def test_preselected_or_exposed_solution_fails(self):
        line = dict(text='Book + Toy mouse', box=(30, 241, 150, 260))
        self.assertEqual(('PASS', 'PASS'), self.score(dict(line, text='Book')))
        self.assertEqual(('PASS', 'FAIL'), self.score(line))
        self.assertEqual(('PASS', 'FAIL'), self.score(dict(line, box=(30, 180, 150, 200))))
        self.goods[0]['traits'] = ['Selected']
        self.assertEqual(('PASS', 'FAIL'), self.score())
