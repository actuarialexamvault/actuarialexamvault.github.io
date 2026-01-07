#!/usr/bin/env python3
"""Convert resources/chapter-question-mapping/F102_question_papers_melted.csv
into resources/practice/chapter_map_F102.json

Output shape:
{
  "Chapter Name": [ {"session":"Jun","year":2010,"paper":"1","question":"Q1","part":3}, ... ]
}
"""
import csv
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / 'resources' / 'chapter-question-mapping' / 'F102_question_papers_melted.csv'
OUT_DIR = ROOT / 'resources' / 'practice'
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT_FILE = OUT_DIR / 'chapter_map_F102.json'


def parse_exam(exam_str):
    # exam_str like 'Jun-10' or 'Nov-11'
    if '-' in exam_str:
        session, yy = exam_str.split('-', 1)
        yy = yy.strip()
        try:
            year = int(yy)
            if year < 100:
                year += 2000
        except ValueError:
            year = None
        return session, year
    return exam_str, None


def main():
    mapping = {}
    if not CSV_PATH.exists():
        print('CSV mapping not found:', CSV_PATH)
        return 2

    with open(CSV_PATH, newline='', encoding='utf-8') as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            exam = row.get('Exam', '').strip()
            question = row.get('Question', '').strip()
            part = row.get('Part', '').strip()
            chapter = row.get('Chapter', '').strip()

            if not chapter:
                continue

            session, year = parse_exam(exam)
            entry = {
                'session': session,
                'year': year,
                # F102 historically had one paper per session in this dataset; default to '1'
                'paper': '1',
                'question': question,
            }
            try:
                entry['part'] = int(part)
            except Exception:
                entry['part'] = None

            mapping.setdefault(chapter, []).append(entry)

    # Sort entries for each chapter by year desc then session
    for ch, items in mapping.items():
        items.sort(key=lambda x: ((x['year'] or 0), x['session']), reverse=True)

    with open(OUT_FILE, 'w', encoding='utf-8') as out:
        json.dump(mapping, out, indent=2, ensure_ascii=False)

    print('Wrote', OUT_FILE)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
