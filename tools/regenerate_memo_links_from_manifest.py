#!/usr/bin/env python3
"""
Regenerate resources/pdfs/memo-links.json from
resources/pdfs/examiners_manifest_for_merge.json

This script deterministically copies the `general`/paper keys found in the
merge-friendly examiners manifest into the memo-links shape the frontend expects.
It backups the existing memo-links.json before writing.
"""
from pathlib import Path
import json
import datetime

ROOT = Path(__file__).resolve().parents[1]
# Use the list-shaped examiners manifest as the single source of truth.
MAN = ROOT / 'resources' / 'pdfs' / 'examiners_manifest.json'
OUT = ROOT / 'resources' / 'pdfs' / 'memo-links.json'


def load_json(p: Path):
    with p.open('r', encoding='utf-8') as f:
        return json.load(f)


def write_json(p: Path, data):
    with p.open('w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def backup(p: Path):
    if p.exists():
        ts = datetime.datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
        bak = p.with_suffix('.bak.' + ts + p.suffix)
        p.replace(bak)
        return bak
    return None


def main():
    if not MAN.exists():
        print(f'Manifest not found: {MAN}')
        return 1

    manifest_list = load_json(MAN)

    # Convert the expected list-shaped manifest into merge-friendly shape:
    # subject -> session -> year -> paper -> url
    def convert_list_to_merge(m: dict) -> dict:
        out = {}
        for subj, years in m.items():
            for year, sessions in years.items():
                for session, reports in sessions.items():
                    subj_map = out.setdefault(subj, {})
                    sess_map = subj_map.setdefault(session, {})
                    year_map = sess_map.setdefault(str(year), {})
                    # reports expected to be a list of dicts {'paper':..., 'url':...}
                    if not isinstance(reports, list):
                        continue
                    for rep in reports:
                        paper = rep.get('paper', 'General')
                        url = rep.get('url')
                        if not url:
                            continue
                        key = str(paper)
                        if isinstance(key, str) and key.strip().lower() == 'general':
                            key = 'general'
                        if key not in year_map:
                            year_map[key] = url
        return out

    manifest = convert_list_to_merge(manifest_list)

    # Normalize subject keys in manifest (many manifests use trailing dashes)
    def normalize_subj_key(k: str) -> str:
        return k.rstrip('-')

    normalized_manifest = {}
    for subj, sessions in manifest.items():
        nk = normalize_subj_key(subj)
        normalized_manifest[nk] = sessions

    manifest = normalized_manifest

    # Load existing memo (if present) so we can merge instead of overwrite
    existing = {}
    if OUT.exists():
        try:
            existing = load_json(OUT)
        except Exception:
            print(f'Warning: failed to parse existing {OUT}; starting fresh')

    # Deep-merge manifest into existing. Manifest entries take precedence.
    def ensure(d, k, default):
        if k not in d:
            d[k] = default
        return d[k]

    # Helper: convert a subject node from session-first to year-first
    def convert_session_first_to_year_first(node: dict) -> dict:
        # If node keys are years already (4-digit), assume year-first and return copy
        keys = list(node.keys())
        if all(k.isdigit() for k in keys):
            return dict(node)

        out = {}
        for session, years in node.items():
            # session is like 'JUNE' or 'NOVEMBER'
            if not isinstance(years, dict):
                continue
            for year, papers in years.items():
                out.setdefault(str(year), {})
                # papers is dict of keys (general/1/2 etc.)
                out[str(year)].setdefault(session, {})
                # Copy keys across
                for k, v in papers.items():
                    out[str(year)][session][k] = v
        return out

    merged = dict(existing)  # start from existing

    # Normalize existing structure: convert any session-first entries into year-first
    for subj in list(merged.keys()):
        subj_node = merged[subj]
        # If any top-level key under subject is non-year, convert
        if any(not k.isdigit() for k in subj_node.keys()):
            merged[subj] = convert_session_first_to_year_first(subj_node)

    # Ensure manifest subject keys are normalized and convert their shape
    for subj, sessions in manifest.items():
        manifest_node = convert_session_first_to_year_first(sessions)
        subj_node = ensure(merged, subj, {})
        for year, sess_map in manifest_node.items():
            year_node = ensure(subj_node, year, {})
            for session, papers in sess_map.items():
                session_node = ensure(year_node, session, {})
                for k, v in papers.items():
                    # Manifest overrides existing
                    session_node[k] = v

    # Final normalization: ensure every subject node is year -> session -> papers
    def normalize_subject_node(node: dict) -> dict:
        out = {}
        if not isinstance(node, dict):
            return out

        for top_key, top_val in node.items():
            # If top_key is a year (digits)
            if isinstance(top_key, str) and top_key.isdigit():
                year = top_key
                if isinstance(top_val, dict):
                    # If top_val contains session keys (non-digit), copy them
                    if any(not k.isdigit() for k in top_val.keys()):
                        for sess, papers in top_val.items():
                            if not isinstance(papers, dict):
                                continue
                            out.setdefault(year, {})[sess] = papers
                    else:
                        # top_val looks like paper mapping directly -> place under 'GENERAL'
                        out.setdefault(year, {})['GENERAL'] = top_val
                else:
                    # Non-dict year value, skip
                    continue
            else:
                # top_key is likely a session name (e.g., 'JUNE') with years underneath
                session = top_key
                if isinstance(top_val, dict):
                    for year, papers in top_val.items():
                        if not isinstance(papers, dict):
                            continue
                        out.setdefault(str(year), {})[session] = papers
        return out

    for subj in list(merged.keys()):
        merged[subj] = normalize_subject_node(merged[subj])

    bak = backup(OUT)
    if bak:
        print(f'Backed up existing memo file to {bak}')
    write_json(OUT, merged)
    print(f'Wrote memo-links.json with {len(merged)} subjects (merged)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
