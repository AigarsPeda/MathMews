import unittest

from analyze import bounded_control_label, bounded_reading, locale_strings, text_check, walk


class CompactCheckTest(unittest.TestCase):
    def score(self, lines, locale='en', compact=True, stage='entry',
              landmark='play-answer-dock', role='Button', label=None):
        play = locale_strings(locale)['play']
        frame = dict(x=30, y=600, width=310, height=60)
        button = dict(type=role, AXLabel=label or play['checkAnswer'], frame=frame)
        nodes = list(walk([dict(type='Group', AXUniqueId=landmark, frame=frame, children=[button])]))
        observed = [dict(text=text, box=[120, 608 + 20*i, 240, 623 + 20*i], confidence=1)
                    for i, text in enumerate(lines)]
        config = dict(locale=locale, checkLabel=play['checkAnswer'], retryLabel=play['tryAgain'],
                      answerTemplate='Answer {{answer}}')
        return text_check([(stage, nodes, observed, [0, 0, 390, 800])], config,
                          compact_check=compact)['status']

    def test_visible_translation_per_locale(self):
        for locale in ('en', 'lv', 'ru'):
            with self.subTest(locale=locale):
                play = locale_strings(locale)['play']
                self.assertEqual('PASS', self.score([play['shortCheck']], locale))
                self.assertEqual('PASS', self.score([play['checkAnswer']], locale, compact=False))

    def test_only_the_compact_entry_dock_submit_button(self):
        for options in [dict(compact=False), dict(stage='checked'), dict(role='StaticText'),
                        dict(landmark='another-dock'), dict(label='Try again')]:
            with self.subTest(options=options):
                self.assertEqual('FAIL', self.score(['Check'], **options))

    def test_partial_split_and_extra_text(self):
        for lines in [['Chec'], ['Check…'], ['Che', 'ck'], ['Check extra'], ['Check', 'extra']]:
            with self.subTest(lines=lines):
                self.assertEqual('FAIL', self.score(lines))


class BoundedControlTest(unittest.TestCase):
    def test_only_numeric_correct_chip_allows_trailing_checkmark(self):
        config = dict(answerTemplate="Answer {{answer}}", verdict={"correct": "Correct"})
        node = dict(type="Button", AXLabel="Answer 34", AXValue="Correct",
                    ancestors=[("Group", "play-submitted-response", None)])
        expected, marks = bounded_control_label(node, config)
        for reading in ("34", "34 ✓", "34~", "34 v"):
            self.assertTrue(bounded_reading(expected, [reading], marks))
        for seen in (["З4~"], ["4~"], ["3~"], ["43~"], ["34…"], ["34 ~ extra"], ["3", "4~"]):
            self.assertFalse(bounded_reading(expected, seen, marks))
        for changes in (dict(AXValue="Incorrect"), dict(ancestors=[]), dict(AXLabel="Answer red")):
            self.assertIsNone(bounded_control_label({**node, **changes}, config))

    def test_written_value_keeps_placeholder_and_unit_in_each_locale(self):
        for locale in ("en", "lv", "ru"):
            spoken = locale_strings(locale)["activityMix"]["answer"] + ": ? g"
            node = dict(type="StaticText", AXUniqueId="response-value", AXLabel=spoken, ancestors=[])
            expected, marks = bounded_control_label(node, dict(locale=locale))
            self.assertTrue(bounded_reading(expected, ["? g"], marks))
            for seen in (["g"], ["?"], ["? kg"], ["? g…"]):
                self.assertFalse(bounded_reading(expected, seen, marks))
            self.assertIsNone(bounded_control_label({**node, "AXUniqueId": ""}, dict(locale=locale)))
