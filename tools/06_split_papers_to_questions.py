#!/usr/bin/env python3
import re
import json
from pathlib import Path
import argparse
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


def load_chapter_map(path: Path):
    if not path.exists():
        logger.warning(f"Chapter map not found at {path}")
        return {}
    with path.open('r', encoding='utf-8') as f:
        return json.load(f)


def session_normalize(s: str):
    if not s:
        return ''
    s = s.strip().lower()
    # normalize to three-letter month code
    if s.startswith('jun'):
        return 'jun'
    if s.startswith('nov'):
        return 'nov'
    return s[:3]


def find_chapters_for_question(chapter_map: dict, subject: str, session: str, year: int, paper: str, question: str):
    # chapter_map: { chapter_name: [ {session, year, paper, question, part}, ... ] }
    matches = []
    wanted_s = session_normalize(session)
    for chapter, entries in chapter_map.items():
        for e in entries:
            try:
                es = session_normalize(str(e.get('session', '')))
                ey = int(e.get('year'))
                ep = str(e.get('paper'))
                eq = str(e.get('question'))
            except Exception:
                continue
            if es == wanted_s and ey == year and ep == str(paper) and eq.lower().lstrip('q') == str(question).lower().lstrip('q'):
                matches.append(chapter)
                break
    return matches


QUESTION_RE = re.compile(r'(?m)^(?:QUESTION|Question)\s+(\d+)\b')


def split_markdown_into_questions(md_text: str):
    # returns list of tuples (question_number_str, question_markdown)
    # pre-clean headers/footers that often appear between pages
    cleaned = strip_common_headers_and_footers(md_text)
    matches = list(QUESTION_RE.finditer(cleaned))
    if not matches:
        return []
    results = []
    for i, m in enumerate(matches):
        qnum = m.group(1)
        start = m.start()
        end = matches[i+1].start() if i+1 < len(matches) else len(cleaned)
        chunk = cleaned[start:end].strip()
        results.append((qnum, chunk))
    return results


def extract_total_marks(question_md: str):
    """Find a '[Total N]' marker and return N as int, else None."""
    m = re.search(r"\[\s*Total\s+(\d+)\s*\]", question_md, re.IGNORECASE)
    if m:
        try:
            return int(m.group(1))
        except Exception:
            return None
    return None


def strip_common_headers_and_footers(text: str) -> str:
    # More robust line-based stripping.
    lines = text.splitlines()
    out_lines = []
    footer_substrings = [
        'PLEASE TURN OVER', 'TURN OVER', 'ACTUARIAL SOCIETY', '©', 'COPYRIGHT', 'PAGE', 'PLEASE TURN', 'END OF PAPER', 'END OF EXAM',
    ]
    footer_regexes = [
        re.compile(r'^\s*F\d{2,3}\s+J\d{3,4}\b', re.IGNORECASE),
        re.compile(r'^\s*##\s*Page\s+\d+', re.IGNORECASE),
        re.compile(r'^\s*Page\s*\d+\b', re.IGNORECASE),
        re.compile(r'^\s*END\s+OF\s+PAPER\b', re.IGNORECASE),
        re.compile(r'^\s*END\s+OF\s+EXAM\b', re.IGNORECASE),
        re.compile(r'^\s*##\s*$', re.IGNORECASE),
        re.compile(r'^\s*-{2,}\s*$', re.IGNORECASE),
    ]
    for ln in lines:
        s = ln.strip()
        if not s:
            out_lines.append('')
            continue
        # remove lines that are exactly '##' or contain only page markers
        skip = False
        # substring checks (case-insensitive)
        us = s.upper()
        for sub in footer_substrings:
            if sub in us:
                skip = True
                break
        if skip:
            continue
        # regex checks
        matched = False
        for rx in footer_regexes:
            if rx.search(ln):
                matched = True
                break
        if matched:
            continue
        # if line consists mostly of punctuation or a lone number, skip
        if re.match(r'^\s*\d+\s*$', ln):
            continue
        if re.match(r'^\s*[^\w\s]{3,}\s*$', ln):
            continue
        out_lines.append(ln)

    cleaned = '\n'.join(out_lines)
    # collapse multiple blank lines to two
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    return cleaned.strip()


def make_frontmatter(meta: dict):
    # simple YAML frontmatter
    lines = ['---']
    for k, v in meta.items():
        if isinstance(v, list):
            # render list as YAML list
            lines.append(f"{k}:")
            for item in v:
                lines.append(f"  - '{item}'")
        else:
            lines.append(f"{k}: '{v}'")
    lines.append('---\n')
    return '\n'.join(lines)


def process_subject(in_dir: Path, subject: str, out_dir: Path, chapter_map_path: Path):
    chapter_map = load_chapter_map(chapter_map_path)
    md_files = list(in_dir.rglob(f"{subject}/**/*.md"))
    if not md_files:
        # also try matching files under subject directly (older layout)
        md_files = list(in_dir.rglob(f"*{subject}*.md"))
    manifest = []
    for md in md_files:
        logger.info(f"Processing paper markdown: {md}")
        text = md.read_text(encoding='utf-8')
        # detect whether this file is the exam paper or the examiners' report
        # prefer the filename path to determine this (some files are under Examiners_Report)
        path_parts = [p.lower() for p in md.parts]
        if any('examiners_report' in p or 'examiners-report' in p or 'examiners' in p for p in path_parts):
            source_type = 'examiners_report'
        elif any('exam' in p for p in path_parts):
            source_type = 'exam'
        else:
            # fallback: inspect header for Document Type
            mtype = re.search(r'- \*\*Document Type\*\*:\s*([A-Za-z _-]+)', text, re.IGNORECASE)
            source_type = mtype.group(1).strip().lower().replace(' ', '_') if mtype else 'paper'
        # attempt to derive metadata from filename tokens
        fname = md.stem
        tokens = fname.split('_')
        # Handle two filename patterns:
        # 1. Exam papers: F102_JUNE_2024_1_Exam (Subject_Session_Year_Paper_Type)
        # 2. Examiners reports: F102_2024_NOVEMBER_general_Examiners_Report (Subject_Year_Session_Paper_Type)
        subj = subject
        session = ''
        year = None
        paper = ''
        
        if len(tokens) >= 4 and tokens[0].upper() == subject.upper():
            # Check if second token is a year (4 digits) or session (letters)
            try:
                potential_year = int(tokens[1])
                # Pattern 2: Subject_Year_Session_Paper (examiner report)
                year = potential_year
                session = tokens[2] if len(tokens) > 2 else ''
                paper = tokens[3] if len(tokens) > 3 else ''
                logger.info(f"Parsed as examiner report pattern: year={year}, session={session}, paper={paper}")
            except ValueError:
                # Pattern 1: Subject_Session_Year_Paper (exam paper)
                session = tokens[1]
                try:
                    year = int(tokens[2]) if len(tokens) > 2 else None
                except ValueError:
                    year = None
                paper = tokens[3] if len(tokens) > 3 else ''
                logger.info(f"Parsed as exam paper pattern: session={session}, year={year}, paper={paper}")
        
        # fallback: try to read header lines for Year/Session
        if year is None:
            # look for 'Year': in header
            m = re.search(r'- \*\*Year\*\*:\s*(\d{4})', text)
            if m:
                year = int(m.group(1))
        if not session:
            m = re.search(r'- \*\*Session\*\*:\s*([A-Za-z]+)', text)
            if m:
                session = m.group(1)
        # split into questions
        # If this is an examiners' report, treat it as 'solutions' and write into a separate folder
        qlist = split_markdown_into_questions(text)
        if not qlist:
            logger.warning(f"No questions found in {md}")
            continue
        for qnum, qmd in qlist:
            chapters = []
            if year is not None and session:
                chapters = find_chapters_for_question(chapter_map, subject, session, int(year), paper, qnum)
            # extract total marks and compute time allocation (minutes = marks * 1.8)
            total_marks = extract_total_marks(qmd)
            time_allocated = None
            if total_marks is not None:
                # round to 1 decimal place
                time_allocated = round(float(total_marks) * 1.8, 1)
            
            # Normalize session name to uppercase for consistency
            session_upper = session.upper() if session else ''
            
            # create output path
            # Solutions go to: solutions/Subject/Year/Session/Paper/
            # Questions go to: questions/Subject/Session/Year/Paper/questions/
            if source_type == 'examiners_report':
                # Solutions folder structure: solutions -> Subject -> Year -> Session -> Paper
                out_subdir = out_dir.parent / 'solutions' / subject / str(year) / session_upper / f"Paper{paper}"
            else:
                # Questions folder structure: questions -> Subject -> Session -> Year -> Paper -> questions
                out_subdir = out_dir / subject / session_upper / str(year) / f"Paper{paper}" / 'questions'
            out_subdir.mkdir(parents=True, exist_ok=True)
            out_filename = f"{subject}_{session_upper}_{year}_Paper{paper}_Q{qnum}.md"
            out_path = out_subdir / out_filename
            front = {
                'subject': subject,
                'session': session_upper,
                'year': year or '',
                'paper': paper,
                'question': f'Q{qnum}',
                'chapters': chapters,
                'source_type': source_type,
                'time_allocated_minutes': time_allocated or '',
            }
            fm = make_frontmatter(front)
            # Clean question markdown before writing:
            # - remove leading 'QUESTION N' header from the chunk (we'll add a canonical '## QUESTION N')
            # - normalise [Total N] to its own bolded line
            # - collapse excessive blank lines
            cleaned = qmd.replace('\r\n', '\n')
            # remove first occurrence of QUESTION header (case-insensitive)
            cleaned = re.sub(r'^\s*(?:QUESTION|Question)\s+\d+[^\n]*\n', '', cleaned, flags=re.IGNORECASE)
            cleaned = cleaned.strip()
            # normalise Total marks marker onto its own bolded line
            cleaned = re.sub(r"\[\s*Total\s+(\d+)\s*\]", r"\n\n**[Total \1]**\n\n", cleaned, flags=re.IGNORECASE)
            # collapse 3+ newlines into two
            cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
            # ensure we have a canonical question title at the top
            title = f"## QUESTION {qnum}\n\n"
            content = fm + '\n' + title + cleaned + '\n'
            out_path.write_text(content, encoding='utf-8')
            # prefer posix (forward-slash) relative path in manifest to avoid Windows backslashes
            try:
                rel = out_path.relative_to(Path.cwd()).as_posix()
            except Exception:
                rel = out_path.as_posix()
            manifest.append({'source': str(md), 'question': f'Q{qnum}', 'output': rel, 'chapters': chapters})
            logger.info(f"Wrote question: {out_path}")
    # write manifest
    manifest_path = out_dir / subject / 'manifest_questions.json'
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    with manifest_path.open('w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    logger.info(f"Wrote manifest for subject {subject}: {manifest_path}")
    return manifest_path


def parse_args():
    p = argparse.ArgumentParser(description='Split per-paper markdown into per-question files')
    p.add_argument('--in-dir', type=Path, default=Path('resources/markdown_questions/sample'), help='Input markdown dir')
    p.add_argument('--subject', required=True, help='Subject code to process (e.g. F102)')
    p.add_argument('--out-dir', type=Path, default=Path('resources/markdown_questions/questions'), help='Output dir for per-question md')
    p.add_argument('--chapter-map', type=Path, default=Path('resources/practice/chapter_map_F102.json'), help='Chapter map JSON')
    return p.parse_args()


def main():
    args = parse_args()
    process_subject(args.in_dir, args.subject, args.out_dir, args.chapter_map)


if __name__ == '__main__':
    main()
