"""
Step 2: Load exam question files from resources/markdown_questions/questions/F102/.

Parses YAML frontmatter (year, session, paper, question, chapters, time_allocated_minutes)
and extracts clean question body text. Also joins the paired examiner's report solution
so embeddings are based on QUESTION + SOLUTION, giving a richer semantic signal.

Output: results/questions_data.json
"""

import re
import json
import yaml
from pathlib import Path
from collections import Counter

QUESTIONS_DIR = (
    Path(__file__).parent.parent
    / "resources"
    / "markdown_questions"
    / "questions"
    / "F102"
)
SOLUTIONS_DIR = (
    Path(__file__).parent.parent
    / "resources"
    / "markdown_questions"
    / "solutions"
    / "F102"
)
OUTPUT = Path(__file__).parent / "results" / "questions_data.json"

FRONTMATTER_RE = re.compile(r'^---\s*\n(.*?)\n---\s*\n', re.DOTALL)


def parse_frontmatter(text: str) -> tuple:
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}, text
    try:
        meta = yaml.safe_load(m.group(1)) or {}
    except Exception:
        meta = {}
    body = text[m.end():]
    return meta, body


def clean_body(text: str) -> str:
    """Strip mark brackets and tidy markdown from question/solution body."""
    # Remove mark totals: [Total 8]
    text = re.sub(r'\[Total\s+\d+\]', '', text, flags=re.IGNORECASE)
    # Remove part mark brackets: [4]
    text = re.sub(r'\[\d+\]', '', text)
    # Strip bold/italic
    text = re.sub(r'\*{3}(.+?)\*{3}', r'\1', text)
    text = re.sub(r'\*{2}(.+?)\*{2}', r'\1', text)
    text = re.sub(r'\*(.+?)\*', r'\1', text)
    # Collapse whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def load_solutions() -> dict:
    """
    Build a lookup: (session.upper(), year_str, question_str) -> clean solution text.
    Scans the full solutions directory regardless of year/session filters.
    """
    lookup = {}
    if not SOLUTIONS_DIR.exists():
        return lookup

    for sol_file in sorted(SOLUTIONS_DIR.rglob("*.md")):
        raw = sol_file.read_text(encoding="utf-8", errors="ignore")
        meta, body = parse_frontmatter(raw)
        if not meta:
            continue
        session = str(meta.get("session") or "").strip().upper()
        year = str(meta.get("year") or "").strip()
        question = str(meta.get("question") or "").strip()
        if session and year and question:
            clean = clean_body(body)
            if clean:
                lookup[(session, year, question)] = clean

    return lookup


def load_solutions() -> dict:
    """
    Build a lookup: (session.upper(), year_str, question_str) -> clean solution text.
    Scans the full solutions directory regardless of year/session filters.
    """
    lookup = {}
    if not SOLUTIONS_DIR.exists():
        return lookup

    for sol_file in sorted(SOLUTIONS_DIR.rglob("*.md")):
        raw = sol_file.read_text(encoding="utf-8", errors="ignore")
        meta, body = parse_frontmatter(raw)
        if not meta:
            continue
        session = str(meta.get("session") or "").strip().upper()
        year = str(meta.get("year") or "").strip()
        question = str(meta.get("question") or "").strip()
        if session and year and question:
            clean = clean_body(body)
            if clean:
                lookup[(session, year, question)] = clean

    return lookup


def load_questions() -> list:
    records = []
    workspace_root = QUESTIONS_DIR.parent.parent.parent.parent  # resources/../..

    solutions = load_solutions()
    n_with_solution = 0

    for md_file in sorted(QUESTIONS_DIR.rglob("*.md")):
        raw = md_file.read_text(encoding="utf-8", errors="ignore")
        meta, body = parse_frontmatter(raw)

        if not meta:
            continue

        clean_q = clean_body(body)
        if len(clean_q) < 20:
            continue

        year = str(meta.get("year", "")).strip()
        session = str(meta.get("session", "")).strip()
        paper = str(meta.get("paper", "")).strip()
        question = str(meta.get("question", "")).strip()

        q_id = f"F102_{session}_{year}_Paper{paper}_{question}"

        chapters = meta.get("chapters") or []
        if isinstance(chapters, str):
            chapters = [chapters]
        chapters = [c for c in chapters if c]

        try:
            source_file = str(md_file.relative_to(workspace_root)).replace("\\", "/")
        except ValueError:
            source_file = str(md_file)

        # Join solution text for richer embeddings
        sol_key = (session.upper(), year, question)
        solution_text = solutions.get(sol_key, "")
        if solution_text:
            n_with_solution += 1
            embed_text = f"QUESTION:\n{clean_q}\n\nSOLUTION:\n{solution_text}"
        else:
            embed_text = f"QUESTION:\n{clean_q}"

        records.append({
            "id": q_id,
            "year": year,
            "session": session,
            "paper": paper,
            "question": question,
            "chapters": chapters,
            "time_minutes": str(meta.get("time_allocated_minutes", "") or ""),
            "text": embed_text,
            "question_only": clean_q,
            "has_solution": bool(solution_text),
            "source_file": source_file,
        })

    print(f"  Solutions matched: {n_with_solution}/{len(records)}")
    return records


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Load exam questions")
    parser.add_argument("--year",    help="Filter to a specific year, e.g. 2012")
    parser.add_argument("--session", help="Filter to a specific session: JUNE or NOVEMBER")
    args = parser.parse_args()

    if not QUESTIONS_DIR.exists():
        raise FileNotFoundError(f"Questions directory not found: {QUESTIONS_DIR}")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    records = load_questions()

    if args.year:
        records = [r for r in records if r["year"] == args.year]
    if args.session:
        records = [r for r in records if r["session"].upper() == args.session.upper()]

    OUTPUT.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8")

    tagged = sum(1 for r in records if r["chapters"])
    print(f"Loaded {len(records)} questions ({tagged} with chapter tags) -> {OUTPUT}")
    print()

    # Breakdown by year + session
    counts = Counter(f"{r['year']} {r['session']}" for r in records)
    for ys, n in sorted(counts.items()):
        print(f"  {n:2d} questions  {ys}")

    # Show unique chapter tags found
    all_tags = sorted(set(c for r in records for c in r["chapters"]))
    print(f"\nUnique chapter tags: {len(all_tags)}")
    for t in all_tags:
        print(f"  - {t}")


if __name__ == "__main__":
    main()
