import unittest

from analyze import locale_crop_matches, locale_midword


def matches(locale, expected, *lines, wrong_fraction=False):
    rows = [dict(text=line, confidence=1) for line in lines]
    return locale_crop_matches(expected, rows, locale, wrong_fraction)


class LocaleCropTest(unittest.TestCase):
    def test_latvian_requires_complete_words_in_order(self):
        self.assertTrue(matches('lv', 'Iekrāso uz skaitļu taisnes.', 'lekrāso uz', 'skaitlu taisnes.'))
        self.assertTrue(matches('lv', 'Pārbaudīt atbildi', 'Pärbaudit', 'atbildi'))
        for lines in [('Pärbaudi', 'atbildi'), ('Pär', 'baudit atbildi'), ('Pärbaudit…', 'atbildi'),
                      ('atbildi', 'Pärbaudit')]:
            self.assertFalse(matches('lv', 'Pārbaudīt atbildi', *lines))
        self.assertFalse(matches('en', 'Pārbaudīt', 'Parbaudit'))

    def test_accent_error_does_not_hide_a_break_between_baselines(self):
        rows = [dict(text='lek', confidence=1, box=[0, 0, 40, 12]),
                dict(text='rãso 1/3 no joslas.', confidence=1, box=[0, 20, 150, 32])]
        self.assertTrue(locale_midword('Iekrāso 1/3 no joslas.', rows, 'lv'))
        rows[1]['box'] = [42, 0, 150, 12]
        self.assertFalse(locale_midword('Iekrāso 1/3 no joslas.', rows, 'lv'))

    def test_russian_requires_digits_and_scopes_the_verdict_mark(self):
        self.assertTrue(matches('ru', '↻  Посмотреть ещё раз', '• Посмотреть еще раз'))
        self.assertTrue(matches('ru', '↻  Посмотреть ещё раз', 'с Посмотреть ещё раз'))
        self.assertFalse(matches('ru', 'Посмотреть ещё раз', 'с Посмотреть ещё раз'))
        self.assertTrue(matches('ru', '4/6', '4/6×', wrong_fraction=True))
        for value in ['4/б×', '4/5×', '4/×', '4/6…']:
            self.assertFalse(matches('ru', '4/6', value, wrong_fraction=True))
        self.assertFalse(matches('ru', '4/6', '4/6×'))
        self.assertFalse(matches('ru', 'ещё', 'ещ'))
