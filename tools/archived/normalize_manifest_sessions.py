#!/usr/bin/env python3
"""
Normalize session keys in resources/pdfs/papers_manifest.json to canonical sessions
(MAY -> JUNE, OCTOBER -> NOVEMBER). Optionally detect duplicate URLs for a subject/year/session.

Usage:
  python tools/normalize_manifest_sessions.py --apply
"""
from pathlib import Path
import json
from datetime import datetime
import shutil

MANIFEST = Path('resources/pdfs/papers_manifest.json')

def load_manifest():
    return json.loads(MANIFEST.read_text(encoding='utf-8')) if MANIFEST.exists() else {}

def save_manifest(data):
    ts = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    bak = MANIFEST.with_suffix('.json.bak.' + ts)
    shutil.copy2(MANIFEST, bak)
    MANIFEST.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f'Wrote normalized manifest and backed up original to {bak}')

def normalize_session_name(s):
    if s in ('MAY', 'JUNE'):
        return 'JUNE'
    if s in ('OCTOBER', 'NOVEMBER'):
        return 'NOVEMBER'
    return s

def normalize(manifest):
    out = {}
    for subject, years in manifest.items():
        out.setdefault(subject, {})
        for year, sessions in years.items():
            out[subject].setdefault(year, {})
            for session, papers in sessions.items():
                canon = normalize_session_name(session)
                out[subject][year].setdefault(canon, {})
                for paper, url in (papers or {}).items():
                    if url in (None, ''):
                        continue
                    out[subject][year][canon][str(paper)] = url
    return out

def find_duplicates(manifest):
    dups = []
    for subject, years in manifest.items():
        for year, sessions in years.items():
            for session, papers in sessions.items():
                urls = list(papers.values())
                if len(urls) != len(set(urls)):
                    dups.append((subject, year, session))
    return dups

def main():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument('--apply', action='store_true')
    args = p.parse_args()

    if not MANIFEST.exists():
        print('Manifest not found:', MANIFEST)
        return 2

    manifest = load_manifest()
    normalized = normalize(manifest)
    dups = find_duplicates(normalized)
    print('Normalization preview:')
    for subj in sorted(normalized.keys()):
        print(' ', subj, 'years:', sorted(normalized[subj].keys()))

    if dups:
        print('\nDuplicate identical URLs found in:')
        for subj, year, session in dups:
            print(f'  {subj} {year} {session}')
    else:
        print('\nNo duplicate identical URLs detected.')

    if args.apply:
        save_manifest(normalized)
    else:
        print('\nDry-run: no file written. Re-run with --apply to write changes.')

if __name__ == "__main__":
    raise SystemExit(main())
