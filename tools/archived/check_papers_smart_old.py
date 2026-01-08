"""
Smart scraper that only checks for papers NOT already in pdf-links.js
This minimizes requests to the Actuarial Society website.
"""

import argparse
import time
import requests
import urllib3
import re
import json
import datetime
from collections import defaultdict

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Subject codes
SUBJECTS = [
    'A211', 'A213', 'A311', 'A301',  # A-series
    'N211',  # N-series
    'F101', 'F102', 'F103', 'F104', 'F105', 'F107-B100', 'F108',  # F100-series
    'F201', 'F202', 'F203', 'F204', 'F205', 'F207-B200'  # F200-series
]

# Years to check (default range: 2010 .. current year)
START_YEAR = 2010
CURRENT_YEAR = datetime.date.today().year
# descending order to keep behaviour similar to previous script
YEARS = list(range(CURRENT_YEAR, START_YEAR - 1, -1))

# Sessions
SESSIONS = ['JUNE', 'MAY', 'NOVEMBER', 'OCTOBER']

# Papers
PAPERS = [1, 2]

# URL patterns
URL_PATTERNS = [
    # Recent known upload folder patterns (kept for backwards compat)
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{session}-{year}-PAPER-{paper}-EXAM-1.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/08/{subject}{letter}_S1_{year}_Exam.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{session}-{year}-EXAM-{paper}.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{paper}-{session}-{year}-Exam.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{session}-{year}-Exam-%E2%80%93-Paper-{paper}.pdf",
    # Fallback patterns without upload year/month folders (covers older and alternate URL shapes)
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{session}-{year}-PAPER-{paper}-EXAM-1.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}{letter}_S1_{year}_Exam.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{session}-{year}-EXAM-{paper}.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{paper}-{session}-{year}-Exam.pdf",
    # Older filename shape used on some early uploads: SUBJECT-YEAR-SESSION-... e.g. F102-2011-JUNE-EXAM-1.pdf
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{year}-{session}-EXAM-{paper}.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{year}-{session}-EXAM-1.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{year}-{session}-EXAMINERS-REPORT-{paper}.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{year}-{session}-EXAMINERS-REPORT.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{session}-{year}-Exam-%E2%80%93-Paper-{paper}.pdf",
    # A213 specific patterns
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/12/{subject}{letter}_S2_{year}_CBA-_VIR.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/12/{subject}{letter}_S2_{year}_WRITTEN-_VIR.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{session}-{year}-{subject}B-{session}-{year}-EXAM.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{session}-{year}-COMPUTER-BASED-EXAM-1.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{session}-{year}-WRITTEN-EXAM-1.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{session}-{year}-CBA-1.pdf",
]


def detect_paper_from_url(url, default_paper=None):
    """Try to detect A/B letter markers in a URL and map them to paper numbers.

    Returns an int paper number (1 or 2). If no letter marker found, returns
    the default_paper (if provided) or 1.
    """
    try:
        # Look for patterns like A311A or A311a, or subject followed by A/B before
        # an _S1_/S2_ token or before 'Exam'/'EXAM' etc.
        m = re.search(r'([A-Z0-9]+)([ABab])(?=[^A-Za-z0-9]|_S[12]|_S|[_\-]?(Exam|EXAM|PAPER))', url)
        if not m:
            # Fallback: find any occurrence of subject-like token followed by A/B
            m = re.search(r'([A-Z]{1,3}\d{1,3})([ABab])', url)
        if m:
            letter = m.group(2).upper()
            return 1 if letter == 'A' else 2
    except Exception:
        pass
    # default
    return default_paper if default_paper is not None else 1

def load_existing_links(pdf_links_path=None):
    """ Only use canonical JSON as the source of existing links. If the canonical

    Implementation notes:
    - Look for quoted URLs in the JS file and heuristically extract subject,
      session, year and paper number.
    - Returns a nested dict: existing[subject][session][year][paper_str] -> url
    - If the JS file is missing or parsing fails the function returns an empty
      nested structure so the checker will perform full checks.
    """
    if pdf_links_path is None:
        import os
        # Get the script directory and construct absolute path
        script_dir = os.path.dirname(os.path.abspath(__file__))
        pdf_links_path = os.path.join(script_dir, '..', '..', 'js', 'pdf-links.js')

    existing = defaultdict(lambda: defaultdict(lambda: defaultdict(dict)))

    # Only use canonical JSON as the source of existing links. If the canonical
    # JSON is missing or cannot be parsed, return an empty structure and log a
    # clear message so the caller will perform full checks.
    try:
        canonical_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'pdfs', 'exam_links.json')
        if not os.path.exists(canonical_path):
            print(f"Canonical exam_links.json not found at {canonical_path}; will check all papers")
            return existing

        with open(canonical_path, 'r', encoding='utf-8') as cf:
            data = json.load(cf)

        # data is shaped subject -> session -> year -> paper -> url
        for subject, sessions in data.items():
            for session, years in sessions.items():
                for year, papers in years.items():
                    for paper_key, url in papers.items():
                        # only include non-empty URLs
                        if url in (None, ''):
                            continue
                        existing[subject][session][year][str(paper_key)] = url

        return existing
    except Exception as e:
        print(f"Warning: Failed to load canonical exam_links.json: {e}")
        print("Will check all papers")
        return existing

def check_url(url, verify=True, timeout=7, retries=2, backoff=1.5):
    """Check if a URL exists with retries and optional TLS verify.

    Returns True if status_code == 200, False otherwise.
    """
    attempt = 0
    while True:
        try:
            response = requests.head(url, verify=verify, timeout=timeout, allow_redirects=True)
            return response.status_code == 200
        except requests.exceptions.SSLError:
            # re-raise SSL errors so the caller can decide (ca-bundle/insecure)
            raise
        except Exception:
            attempt += 1
            if attempt > retries:
                return False
            time.sleep(backoff * attempt)


def parse_pdf_url_metadata(url):
    """Attempt to extract subject, year, session and paper type from a PDF url.

    Returns a dict with keys: subject, year, session (canonical), paper (int or '1'/'2'), kind ('exam'|'examiner'|'unknown')
    or None if not parseable.
    """
    try:
        u = url.upper()
        # Determine kind
        kind = 'examiner' if 'EXAMINER' in u or 'EXAMINERS' in u or 'EXAMINERS-REPORT' in u else ('exam' if 'EXAM' in u else 'unknown')

        # Try S1/S2 pattern: SUBJECT_S1_YYYY or SUBJECT_S2_YYYY
        m = re.search(r"/([A-Z0-9\-]+)_S([12])_(20\d{2})", u)
        if m:
            subject = m.group(1)
            snum = m.group(2)
            year = m.group(3)
            session = 'JUNE' if snum == '1' else 'NOVEMBER'
        else:
            # Try SUBJECT-YYYY-SESSION or SUBJECT-SESSION-YYYY
            m = re.search(r"/([A-Z0-9\-]+)[-_ ](20\d{2})[-_ ](JUNE|MAY|NOVEMBER|NOV|OCT|OCTOBER|JUN)", u)
            if m:
                subject = m.group(1)
                year = m.group(2)
                raw_session = m.group(3)
            else:
                m2 = re.search(r"/([A-Z0-9\-]+)[-_ ](JUNE|MAY|NOVEMBER|NOV|OCT|OCTOBER|JUN)[-_ ](20\d{2})", u)
                if m2:
                    subject = m2.group(1)
                    raw_session = m2.group(2)
                    year = m2.group(3)
                else:
                    # Try fallback: find subject token and year somewhere in the url
                    m3 = re.search(r"/([A-Z0-9\-]{2,8})[-_ ]?(20\d{2})", u)
                    if m3:
                        subject = m3.group(1)
                        year = m3.group(2)
                        raw_session = None
                    else:
                        return None

            # normalize session
            if raw_session:
                rs = raw_session.upper()
                if rs in ('MAY', 'JUNE', 'JUN'):
                    session = 'JUNE'
                elif rs in ('OCT', 'OCTOBER', 'NOV', 'NOVEMBER'):
                    session = 'NOVEMBER'
                else:
                    session = rs

        # Paper detection: look for PAPER-1/PAPER-2 or -EXAM-1 etc or letter markers
        paper = None
        p = re.search(r'PAPER[-_ ]?(\d)', u)
        if not p:
            p = re.search(r'EXAM[-_ ]?(\d)', u)
        if p:
            paper = int(p.group(1))
        else:
            # detect A/B marker fallback
            try:
                paper = detect_paper_from_url(url)
            except Exception:
                paper = 1

        return {'subject': subject, 'year': year, 'session': session, 'paper': str(paper), 'kind': kind, 'url': url}
    except Exception:
        return None

def main(argv=None):
    parser = argparse.ArgumentParser(description='Smart papers checker')
    parser.add_argument('--start-year', type=int, default=min(YEARS))
    parser.add_argument('--end-year', type=int, default=max(YEARS))
    parser.add_argument('--subjects', nargs='*', default=SUBJECTS, help='List of subject codes to check')
    parser.add_argument('--delay', type=float, default=0.1, help='Delay between requests (s)')
    parser.add_argument('--dry-run', action='store_true', help='Do not write manifests or make persistent changes')
    parser.add_argument('--crawl-manifest', help='Path to a crawl results JSON (tools/crawl_results_*.json) to ingest instead of probing')
    parser.add_argument('--ca-bundle', help='Path to CA bundle PEM file')
    parser.add_argument('--insecure', action='store_true', help='Disable TLS verification')
    args = parser.parse_args(argv)

    print("="*80)
    print("Smart Past Papers Scraper - Only checks missing papers")
    print("="*80)

    # TLS verify configuration
    verify = True
    if args.insecure:
        verify = False
    elif args.ca_bundle:
        verify = args.ca_bundle

    # Load existing links
    print("\nLoading existing links from exam_links.json...")
    existing_links = load_existing_links()

    # Prepare results container (used by normal probing flow and crawl-manifest ingestion)
    results = defaultdict(lambda: defaultdict(lambda: defaultdict(dict)))

    # If a crawl manifest is provided, ingest it and construct results directly
    if args.crawl_manifest:
        print(f"\nIngesting crawl manifest {args.crawl_manifest}...")
        try:
            with open(args.crawl_manifest, 'r', encoding='utf-8') as cf:
                crawl = json.load(cf)
        except Exception as e:
            print(f"Failed to load crawl manifest: {e}")
            return

        # Populate results from crawl entries
        for url in crawl.get('found_pdfs', []) + crawl.get('found_links', []):
            meta = parse_pdf_url_metadata(url)
            if not meta:
                continue
            if meta['kind'] != 'exam':
                # skip non-exam PDFs in this script
                continue

            subj = meta['subject']
            yr = meta['year']
            sess = meta['session']
            paper = meta['paper']

            # respect canonical session mapping
            if sess in ('MAY', 'JUNE'):
                canonical = 'JUNE'
            elif sess in ('OCTOBER', 'NOVEMBER'):
                canonical = 'NOVEMBER'
            else:
                canonical = sess

            results[subj][yr].setdefault(canonical, {})[paper] = url

        # Write manifest (subject -> year -> session -> paper -> url)
        manifest_path = 'resources/pdfs/papers_manifest.json'
        manifest = {}
        for subject in results:
            manifest[subject] = {}
            for year in results[subject]:
                manifest[subject][year] = {}
                for session in results[subject][year]:
                    manifest[subject][year][session] = results[subject][year][session]

        if not args.dry_run:
            try:
                with open(manifest_path, 'w', encoding='utf-8') as mf:
                    json.dump(manifest, mf, indent=2)
                print(f"Wrote manifest to {manifest_path}")
            except Exception as e:
                print(f"Failed to write manifest: {e}")
        else:
            print("Dry run: manifest not written")

        return
    
    # Count existing links
    existing_count = sum(
        len(papers)
        for subject_data in existing_links.values()
        for session_data in subject_data.values()
        for papers in session_data.values()
    )
    print(f"Found {existing_count} existing links in exam_links.json")
    
    results = defaultdict(lambda: defaultdict(lambda: defaultdict(dict)))
    checks_needed = 0
    checks_skipped = 0
    
    years_to_check = [y for y in YEARS if args.start_year <= y <= args.end_year]

    for subject in args.subjects:
        print(f"\nChecking {subject}...")
        
        for year in years_to_check:
            year_str = str(year)
            
            for session in SESSIONS:
                for paper in PAPERS:
                    paper_str = str(paper)
                    
                    # Normalize session to canonical tokens used in canonical JSON
                    if session in ('MAY', 'JUNE'):
                        canonical_session = 'JUNE'
                    elif session in ('OCTOBER', 'NOVEMBER'):
                        canonical_session = 'NOVEMBER'
                    else:
                        canonical_session = session

                    # Check if we already have this paper
                    if (subject in existing_links and 
                        canonical_session in existing_links[subject] and 
                        year_str in existing_links[subject][canonical_session] and 
                        paper_str in existing_links[subject][canonical_session][year_str]):
                        
                        # Already exists, copy it over (store under the canonical session)
                        results[subject][year_str].setdefault(canonical_session, {})[paper_str] = existing_links[subject][canonical_session][year_str][paper_str]
                        checks_skipped += 1
                        continue
                    
                    # Need to check for this paper
                    checks_needed += 1
                    found = False
                    
                    # Use patterns that don't require 'letter' parameter
                    standard_patterns = [URL_PATTERNS[0], URL_PATTERNS[2], URL_PATTERNS[3], URL_PATTERNS[4]]
                    
                    for pattern in standard_patterns:
                        url = pattern.format(
                            subject=subject,
                            session=session,
                            year=year,
                            paper=paper
                        )
                        
                        try:
                            ok = check_url(url, verify=verify)
                        except requests.exceptions.SSLError as e:
                            print(f"SSL error when checking {url}: {e}")
                            ok = False

                        if ok:
                            # Determine paper from URL if it encodes an A/B marker
                            detected = detect_paper_from_url(url, default_paper=paper)
                            final_paper = detected
                            final_paper_str = str(final_paper)
                            print(f"  ✓ NEW: {year} {session} Paper {final_paper}")
                            # store under canonical session
                            results[subject][year_str].setdefault(canonical_session, {})[final_paper_str] = url
                            found = True
                            break

                        time.sleep(args.delay)
                    
                    # Try letter format for newer papers if not found
                    # Letter-format URLs use _S1_ or _S2_ to indicate semester. Map:
                    # S1 -> MAY/JUNE, S2 -> OCTOBER/NOVEMBER. Only attempt the
                    # appropriate S-number for the current session to avoid assigning
                    # the same letter-URL to unrelated sessions.
                    if not found and year >= 2024:
                        # determine the target letter for this paper
                        target_letter = 'a' if paper == 1 else 'b'

                        s1_sessions = ['MAY', 'JUNE']
                        s2_sessions = ['OCTOBER', 'NOVEMBER']

                        if session in s1_sessions:
                            snum = '1'
                        elif session in s2_sessions:
                            snum = '2'
                        else:
                            snum = None

                        if snum is not None:
                            # Try both lowercase and uppercase variants of the letter
                            for letter in [target_letter.lower(), target_letter.upper()]:
                                # Construct the URL by replacing the _S1_ token in the
                                # template with the appropriate S-number (S1/S2)
                                pattern = URL_PATTERNS[1]
                                if '_S1_' in pattern:
                                    pattern_s = pattern.replace('_S1_', f'_S{snum}_')
                                else:
                                    pattern_s = pattern

                                url = pattern_s.format(
                                    subject=subject,
                                    letter=letter,
                                    year=year
                                )

                                try:
                                    ok = check_url(url, verify=verify)
                                except requests.exceptions.SSLError as e:
                                    print(f"SSL error when checking {url}: {e}")
                                    ok = False

                                if ok:
                                    # If the discovered URL contains an A/B marker, prefer
                                    # that mapping (A->1, B->2) rather than the loop-paper.
                                    detected = detect_paper_from_url(url, default_paper=paper)
                                    final_paper = detected
                                    final_paper_str = str(final_paper)
                                    print(f"  ✓ NEW: {year} {session} Paper {final_paper}")
                                    # store under canonical session
                                    results[subject][year_str].setdefault(canonical_session, {})[final_paper_str] = url
                                    found = True
                                    break
                                time.sleep(args.delay)
    
    # Print summary
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    print(f"Existing links: {checks_skipped}")
    print(f"New checks needed: {checks_needed}")
    print(f"Requests saved: {checks_skipped} ({checks_skipped / (checks_needed + checks_skipped) * 100:.1f}%)")
    print()
    
    new_found = 0
    for subject in SUBJECTS:
        count = sum(
            len(papers)
            for year_data in results[subject].values()
            for papers in year_data.values()
        )
        
        existing_for_subject = sum(
            len(papers)
            for session_data in existing_links[subject].values()
            for papers in session_data.values()
        )
        
        new_for_subject = count - existing_for_subject
        if new_for_subject > 0:
            print(f"{subject}: {count} total ({new_for_subject} NEW)")
            new_found += new_for_subject
        elif count > 0:
            print(f"{subject}: {count} total")
    
    print(f"\nTotal NEW papers found: {new_found}")
    
    # Generate JavaScript output for NEW papers only
    if new_found > 0:
        print("\n" + "="*80)
        print("NEW Papers to Add to pdf-links.js")
        print("="*80)
        
        for subject in SUBJECTS:
            new_papers = []
            
            for year in sorted(results[subject].keys(), reverse=True):
                for session in SESSIONS:
                    if session in results[subject][year]:
                        for paper, url in results[subject][year][session].items():
                            # Check if this is new
                            if not (subject in existing_links and 
                                   session in existing_links[subject] and 
                                   year in existing_links[subject][session] and 
                                   paper in existing_links[subject][session][year]):
                                new_papers.append((year, session, paper, url))
            
            if new_papers:
                print(f"\n{subject}:")
                for year, session, paper, url in new_papers:
                    print(f"  {year} {session} Paper {paper}: '{url}'")

    # Write structured manifest (subject -> year -> session -> paper -> url)
    manifest_path = 'resources/pdfs/papers_manifest.json'
    manifest = {}
    for subject in results:
        manifest[subject] = {}
        for year in results[subject]:
            manifest[subject][year] = {}
            for session in results[subject][year]:
                manifest[subject][year][session] = results[subject][year][session]

    if not args.dry_run:
        try:
            with open(manifest_path, 'w', encoding='utf-8') as mf:
                json.dump(manifest, mf, indent=2)
            print(f"Wrote manifest to {manifest_path}")
        except Exception as e:
            print(f"Failed to write manifest: {e}")
    else:
        print("Dry run: manifest not written")


if __name__ == "__main__":
    main()
