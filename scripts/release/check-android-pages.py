#!/usr/bin/env python3
"""Inspect ELF LOAD/RELRO and APK native-library ZIP alignment without installing tools.

This reads an existing APK/AAB; it never signs, rewrites or uploads the artifact.
A passing result still needs testing on a 16 KB device and a final signed build.
Reference: https://developer.android.com/guide/practices/page-sizes
"""
import argparse
import json
from pathlib import Path
import struct
import sys
import zipfile

PAGE = 16384
MAX_HEADERS = 1024 * 1024


def inspect_elf(data):
    if len(data) < 64 or data[:4] != b'\x7fELF' or data[4] != 2 or data[5] not in (1, 2):
        raise ValueError('Expected a 64-bit ELF header')
    endian = '<' if data[5] == 1 else '>'
    offset = struct.unpack_from(endian + 'Q', data, 32)[0]
    entry_size, count = struct.unpack_from(endian + 'HH', data, 54)
    if entry_size < 56 or not count or offset + count * entry_size > len(data):
        raise ValueError('Invalid or truncated ELF program headers')
    loads, relro, errors = 0, 0, []
    writable_ranges, relro_ranges = [], []
    for index in range(count):
        kind, flags, file_offset, address, physical, file_size, memory_size, alignment = struct.unpack_from(endian + 'IIQQQQQQ', data, offset + index * entry_size)
        if kind == 1:
            loads += 1
            if flags & 2:
                writable_ranges.append((address, address + memory_size))
            if alignment < PAGE or alignment & (alignment - 1) or address % PAGE != file_offset % PAGE:
                errors.append('LOAD segment is not 16 KB aligned')
        elif kind == 0x6474e552:
            relro += 1
            relro_ranges.append((address, address + memory_size))
    # Android rounds RELRO protection to page boundaries. Non-aligned ends
    # followed only by a segment gap do not establish a writable-data overlap.
    # See AOSP bionic/linker/linker_phdr.cpp, _phdr_table_set_gnu_relro_prot.
    for start, end in relro_ranges:
        protected_start, protected_end = start // PAGE * PAGE, (end + PAGE - 1) // PAGE * PAGE
        for writable_start, writable_end in writable_ranges:
            lo, hi = max(writable_start, protected_start), min(writable_end, protected_end)
            if lo < hi and (lo < start or hi > end):
                errors.append('GNU_RELRO page rounding overlaps writable LOAD bytes outside RELRO')
    if not loads:
        errors.append('No LOAD segments')
    return {'load_segments': loads, 'relro_segments': relro,
            'nonaligned_relro_ends': sum(end % PAGE != 0 for start, end in relro_ranges), 'errors': errors}


def audit(artifact):
    failures, checked, nonaligned_relro = [], [], 0
    is_apk = artifact.suffix.lower() == '.apk'
    with zipfile.ZipFile(artifact) as archive, artifact.open('rb') as raw:
        names = archive.namelist()
        if len(names) != len(set(names)):
            failures.append('Duplicate ZIP paths make artifact interpretation ambiguous')
        for entry in archive.infolist():
            parts = entry.filename.split('/')
            if not entry.filename.endswith('.so') or not any(abi in parts for abi in ('arm64-v8a', 'x86_64')):
                continue
            errors = []
            try:
                with archive.open(entry) as stream:
                    header = stream.read(64)
                    if len(header) < 64:
                        raise ValueError('Truncated ELF header')
                    endian = '<' if header[5] == 1 else '>'
                    offset = struct.unpack_from(endian + 'Q', header, 32)[0]
                    entry_size, count = struct.unpack_from(endian + 'HH', header, 54)
                    end = offset + count * entry_size
                    if end > MAX_HEADERS or end > entry.file_size or end < 64:
                        raise ValueError('Invalid ELF header range')
                    result = inspect_elf(header + stream.read(end - 64))
                    errors.extend(result['errors'])
                    nonaligned_relro += result['nonaligned_relro_ends']
                if is_apk and entry.compress_type == zipfile.ZIP_STORED:
                    raw.seek(entry.header_offset)
                    local_header = raw.read(30)
                    if len(local_header) != 30 or local_header[:4] != b'PK\x03\x04':
                        raise ValueError('Invalid ZIP local header')
                    name_length, extra_length = struct.unpack_from('<HH', local_header, 26)
                    start = entry.header_offset + 30 + name_length + extra_length
                    if start % PAGE:
                        errors.append('Uncompressed APK library is not ZIP aligned to 16 KB')
            except (ValueError, struct.error, OSError, zipfile.BadZipFile) as error:
                errors.append(str(error))
            checked.append(entry.filename)
            for error in errors:
                failures.append(f'{entry.filename}: {error}')
    if not checked:
        failures.append('No arm64-v8a or x86_64 native libraries found')
    return {'artifact': str(artifact.resolve()), 'libraries_checked': len(checked), 'passed': not failures,
            'nonaligned_relro_ends': nonaligned_relro,
            'failures': failures, 'scope': '64-bit LOAD alignment, RELRO writable-range overlap, and uncompressed APK native ZIP alignment only',
            'remaining': 'Verify a final signed artifact, bundle-to-APK packaging, and runtime on a 16 KB device.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('artifact', type=Path, help='Existing .apk or .aab')
    parser.add_argument('--json', action='store_true', help='Print a machine-readable report')
    args = parser.parse_args()
    if args.artifact.suffix.lower() not in ('.apk', '.aab'):
        parser.error('Expected an APK or AAB')
    try:
        report = audit(args.artifact)
    except (OSError, zipfile.BadZipFile) as error:
        parser.error(str(error))
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"{'PASS' if report['passed'] else 'FAIL'}: checked {report['libraries_checked']} 64-bit libraries")
        for failure in report['failures']:
            print(failure)
        print(report['remaining'])
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    sys.exit(main())
