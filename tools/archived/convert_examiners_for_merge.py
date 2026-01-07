#!/usr/bin/env python3
"""Convert examiners_manifest.json (lists) into a manifest shaped subject->year->session->paper->url

Wrote here as an archived copy of the converter; the regeneration script now accepts both shapes.
"""
import json
from pathlib import Path

in_path = Path('resources/pdfs/examiners_manifest.json')
out_path = Path('resources/pdfs/examiners_manifest_for_merge.json')

if not in_path.exists():
    print('Input manifest not found:', in_path)
    raise SystemExit(2)

data = json.loads(in_path.read_text(encoding='utf-8'))

out = {}
for subj, years in data.items():
    for year, sessions in years.items():
        for session, reports in sessions.items():
            subj_map = out.setdefault(subj, {})
            sess_map = subj_map.setdefault(session, {})
            year_map = sess_map.setdefault(str(year), {})
            # reports is expected to be a list of dicts {'paper':..., 'url':...}
            for rep in reports:
                paper = rep.get('paper', 'General')
                url = rep.get('url')
                if not url:
                    continue
                key = str(paper).lower() if isinstance(paper, str) else str(paper)
                # normalize 'general' key to 'general' (merge tool will trim/decide)
                if key == 'general' or key == 'general':
                    key = 'general'
                # only set if not already present (prefer first found)
                if key not in year_map:
                    year_map[key] = url

out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding='utf-8')
print('Wrote converted manifest to', out_path)
