import importlib.util
from pathlib import Path
import struct
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('pages', Path(__file__).with_name('check-android-pages.py'))
pages = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pages)


def elf(alignment=16384, relro_end=32768, virtual=0):
    header = bytearray(64 + 2 * 56)
    header[:6] = b'\x7fELF\x02\x01'
    struct.pack_into('<Q', header, 32, 64)
    struct.pack_into('<HH', header, 54, 56, 2)
    struct.pack_into('<IIQQQQQQ', header, 64, 1, 6, 0, virtual, 0, len(header), 65536, alignment)
    struct.pack_into('<IIQQQQQQ', header, 120, 0x6474e552, 4, 0, 16384, 0, 4096, relro_end - 16384, 1)
    return header


class AndroidPageTests(unittest.TestCase):
    def test_load_and_relro(self):
        self.assertEqual(pages.inspect_elf(elf())['errors'], [])
        self.assertTrue(pages.inspect_elf(elf(alignment=4096))['errors'])
        self.assertTrue(pages.inspect_elf(elf(relro_end=20480))['errors'])
        self.assertTrue(pages.inspect_elf(elf(virtual=4096))['errors'])

    def test_truncated_headers(self):
        for data in [b'garbage', elf()[:70]]:
            with self.assertRaises(ValueError):
                pages.inspect_elf(data)

    def test_unaligned_relro_with_a_separate_load_gap(self):
        data = elf(relro_end=20480)
        # The writable LOAD ends exactly at RELRO; its next bytes are a gap.
        struct.pack_into('<Q', data, 64 + 40, 20480)
        self.assertEqual(pages.inspect_elf(data)['errors'], [])
        self.assertEqual(pages.inspect_elf(data)['nonaligned_relro_ends'], 1)

    def test_apk_zip_alignment_and_aab_difference(self):
        with tempfile.TemporaryDirectory() as directory:
            apk = Path(directory) / 'app.apk'
            with zipfile.ZipFile(apk, 'w') as archive:
                archive.writestr('lib/arm64-v8a/libtest.so', elf(), compress_type=zipfile.ZIP_STORED)
            self.assertFalse(pages.audit(apk)['passed'], 'A valid ELF alone does not establish APK ZIP alignment')
            aab = apk.with_suffix('.aab')
            apk.rename(aab)
            self.assertTrue(pages.audit(aab)['passed'], 'AAB ZIP offsets are not installed APK offsets')

    def test_missing_native_payload_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            aab = Path(directory) / 'empty.aab'
            with zipfile.ZipFile(aab, 'w') as archive:
                archive.writestr('assets/test.txt', 'fixture')
            self.assertFalse(pages.audit(aab)['passed'])


if __name__ == '__main__':
    unittest.main()
