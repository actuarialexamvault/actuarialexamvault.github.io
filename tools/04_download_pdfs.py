import os
import json
import time
import argparse
import logging
from pathlib import Path
from urllib.parse import urlparse
from collections import defaultdict

import requests

# Basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')


def safe_get(url, timeout=30, verify=False):
    try:
        resp = requests.get(url, timeout=timeout, verify=verify)
        resp.raise_for_status()
        return resp
    except Exception as e:
        raise


def generate_clean_filename(subject, year, session, paper_id, paper_type, url):
    original_filename = os.path.basename(urlparse(url).path)
    extension = os.path.splitext(original_filename)[1] or '.pdf'
    # Normalize components
    session_s = session.replace(' ', '_') if session else 'UnknownSession'
    paper = paper_id if paper_id else 'Paper'
    clean = f"{subject}_{year}_{session_s}_{paper}_{paper_type}{extension}"
    # Replace spaces and repeated underscores
    return re_sub_filename(clean)


def re_sub_filename(name):
    # lightweight normalize: remove problematic chars
    return ''.join(c for c in name if c.isalnum() or c in '._-')


def write_bytes_to_file(path: Path, content: bytes):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def download_with_retries(url, out_path: Path, retries=3, timeout=30, verify=False):
    last_exc = None
    for attempt in range(1, retries + 1):
        try:
            logging.info(f"Attempt {attempt}/{retries} -> {url}")
            r = safe_get(url, timeout=timeout, verify=verify)
            content_type = r.headers.get('content-type', '').lower()
            if 'pdf' not in content_type and not url.lower().endswith('.pdf'):
                logging.warning(f"Downloaded content for {url} does not look like a PDF (content-type={content_type})")
            write_bytes_to_file(out_path, r.content)
            return True
        except Exception as e:
            logging.warning(f"Download attempt {attempt} failed for {url}: {e}")
            last_exc = e
            time.sleep(1 * attempt)
    logging.error(f"All {retries} attempts failed for {url}: {last_exc}")
    return False


def load_json(path: Path):
    with path.open('r', encoding='utf-8') as f:
        return json.load(f)


def flatten_exam_links(exam_json):
    """Given the canonical exam_links.json structure, produce iterable items
    yielding dicts with keys: subject, session, year, paper, url, type
    This function contains defensive handling for several common shapes.
    Actual structure: { subject: { session: { year: { paper: url }}}}
    """
    items = []
    # exam_links.json structure: Subject → Session → Year → Paper
    if isinstance(exam_json, dict):
        for subject, by_session in exam_json.items():
            if not isinstance(by_session, dict):
                continue
            for session, by_year in by_session.items():
                if not isinstance(by_year, dict):
                    continue
                for year, papers in by_year.items():
                    if isinstance(papers, dict):
                        for paper, url in papers.items():
                            items.append({'subject': subject, 'year': str(year), 'session': str(session), 'paper': str(paper), 'url': url, 'type': 'Exam'})
                    elif isinstance(papers, list):
                        # list of urls
                        for idx, url in enumerate(papers, start=1):
                            items.append({'subject': subject, 'year': str(year), 'session': str(session), 'paper': f'P{idx}', 'url': url, 'type': 'Exam'})
    return items


def flatten_memo_links(memo_json):
    """
    Flatten memo_links.json structure.
    Actual structure: { subject: { year: { session: { paper: url }}}}
    """
    items = []
    if isinstance(memo_json, dict):
        for subject, by_year in memo_json.items():
            if not isinstance(by_year, dict):
                continue
            for year, by_session in by_year.items():
                if not isinstance(by_session, dict):
                    continue
                for session, papers in by_session.items():
                    if isinstance(papers, dict):
                        for paper, url in papers.items():
                            items.append({'subject': subject, 'year': str(year), 'session': str(session), 'paper': str(paper), 'url': url, 'type': 'Examiners_Report'})
    return items


def write_manifest(manifest, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = out_dir / 'download_manifest.json'
    with manifest_path.open('w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    logging.info(f"Wrote manifest to {manifest_path}")


def parse_args():
    p = argparse.ArgumentParser(description='Download exam PDFs and memos from canonical JSON maps')
    p.add_argument('--exam-json', type=Path, default=Path('resources/pdfs/exam_links.json'), help='Path to canonical exam_links.json')
    p.add_argument('--memo-json', type=Path, default=Path('resources/pdfs/memo-links.json'), help='Path to canonical memo-links.json')
    p.add_argument('--out-dir', type=Path, default=Path('resources/pdfs/downloads'), help='Base output directory')
    p.add_argument('--subject', type=str, default=None, help='Filter to download only specific subject (e.g., F102)')
    p.add_argument('--force', action='store_true', help='Overwrite existing files')
    p.add_argument('--retries', type=int, default=3, help='Number of download retries')
    p.add_argument('--timeout', type=int, default=30, help='HTTP timeout seconds')
    p.add_argument('--verify-ssl', action='store_true', help='Verify SSL certificates when downloading')
    p.add_argument('--dry-run', action='store_true', help="Don't write files, just show actions")
    return p.parse_args()


def main():
    args = parse_args()

    # Load JSONs if they exist
    exam_path = args.exam_json
    memo_path = args.memo_json

    entries = []
    if exam_path.exists():
        try:
            exam_json = load_json(exam_path)
            entries.extend(flatten_exam_links(exam_json))
            logging.info(f"Loaded exam links from {exam_path}")
        except Exception as e:
            logging.error(f"Failed to load exam JSON {exam_path}: {e}")
    else:
        logging.warning(f"Exam JSON not found at {exam_path}")

    if memo_path.exists():
        try:
            memo_json = load_json(memo_path)
            entries.extend(flatten_memo_links(memo_json))
            logging.info(f"Loaded memo links from {memo_path}")
        except Exception as e:
            logging.error(f"Failed to load memo JSON {memo_path}: {e}")
    else:
        logging.warning(f"Memo JSON not found at {memo_path}")

    if not entries:
        logging.error("No entries found to download. Exiting.")
        return 1

    # Filter by subject if specified
    if args.subject:
        entries = [e for e in entries if e.get('subject') == args.subject]
        if not entries:
            logging.error(f"No entries found for subject '{args.subject}'. Exiting.")
            return 1
        logging.info(f"Filtered to {len(entries)} entries for subject '{args.subject}'")

    out_base: Path = args.out_dir
    manifest = []
    success = 0
    failed = 0

    for item in entries:
        subject = item.get('subject', 'unknown')
        year = item.get('year', 'unknown')
        session = item.get('session', 'unknown')
        paper = item.get('paper', '')
        url = item.get('url')
        ptype = item.get('type', 'Exam')

        # Use different folder structures for exams vs examiner reports:
        # - Exams (from exam_links.json): Subject/Session/Year/Exam/
        # - Memos (from memo_links.json): Subject/Year/Session/Examiners_Report/
        if ptype == 'Exam':
            # exam_links.json structure: Subject → Session → Year → Exam
            target_dir = out_base / subject / session / year / 'Exam'
        else:
            # memo_links.json structure: Subject → Year → Session → Examiners_Report
            target_dir = out_base / subject / year / session / 'Examiners_Report'
        
        clean_name = generate_clean_filename(subject, year, session, paper, ptype, url)
        target_path = target_dir / clean_name

        manifest_entry = {
            'subject': subject,
            'year': year,
            'session': session,
            'paper': paper,
            'type': ptype,
            'url': url,
            'path': str(target_path)
        }

        # Skip if exists
        if target_path.exists() and not args.force:
            logging.info(f"Skipping existing: {target_path}")
            manifest_entry['status'] = 'skipped'
            manifest.append(manifest_entry)
            success += 1
            continue

        logging.info(f"Will download: {url} -> {target_path}")
        if args.dry_run:
            manifest_entry['status'] = 'dry-run'
            manifest.append(manifest_entry)
            continue

        ok = download_with_retries(url, target_path, retries=args.retries, timeout=args.timeout, verify=args.verify_ssl)
        manifest_entry['status'] = 'ok' if ok else 'failed'
        manifest.append(manifest_entry)
        if ok:
            success += 1
        else:
            failed += 1

    # Write manifest summary
    write_manifest(manifest, out_base)

    logging.info(f"Downloads complete. success={success} failed={failed} total={len(manifest)}")
    return 0


if __name__ == '__main__':
    import sys
    sys.exit(main())
