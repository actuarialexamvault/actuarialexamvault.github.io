"""
Smart scraper for examiners reports that only checks for reports NOT already found.
Minimizes requests to the Actuarial Society website.
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
    'A211', 'A213', 'A311',  # A-series
    'N211',  # N-series
    'F101', 'F102', 'F103', 'F104', 'F105', 'F107', 'F108',  # F100-series
    'F201', 'F202', 'F203', 'F204', 'F205', 'F207'  # F200-series
]

# Years to check (default range: 2010 .. current year)
START_YEAR = 2010
CURRENT_YEAR = datetime.date.today().year
YEARS = list(range(CURRENT_YEAR, START_YEAR - 1, -1))

# Sessions
SESSIONS = ['JUNE', 'MAY', 'NOVEMBER', 'OCTOBER', 'NOV', 'OCT']

# Papers (for reports that specify paper number)
PAPERS = [1, 2]

# URL patterns for examiners reports
EXAMINERS_REPORT_PATTERNS = [
    # Recent upload-folder patterns
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{session}-{year}-EXAMINERS-REPORT-1.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{session}-{year}-PAPER-{paper}-EXAMINERS-REPORT.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{session}-{year}-EXAMINERS-REPORT.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{session}-{year}-Examiners-Report.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/08/{subject}_S1_{year}_Examiners_Report.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/12/{subject}_S2_{year}_Examiners_Report.pdf",
    # Fallback patterns without upload folder year/month (older file layouts)
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{session}-{year}-EXAMINERS-REPORT-1.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{session}-{year}-PAPER-{paper}-EXAMINERS-REPORT.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{session}-{year}-EXAMINERS-REPORT.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{session}-{year}-Examiners-Report.pdf",
    # Older filename shapes include the year immediately after subject: SUBJECT-YYYY-SESSION-...
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{year}-{session}-EXAMINERS-REPORT-1.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{year}-{session}-EXAMINERS-REPORT.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}-{year}-{session}-EXAMINERS-REPORT-{paper}.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}_S1_{year}_Examiners_Report.pdf",
    "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/{subject}_S2_{year}_Examiners_Report.pdf",
]

def load_existing_reports(reports_file='resources/pdfs/examiners_manifest.json'):
    """Load previously found examiners reports.

    Primary source: parse `js/memo-links.js` for examiner report URLs and populate the
    nested structure existing[subject][year][session] -> list of report dicts.

    If the JS file is not present or parsing fails, the function returns an empty
    structure so the checker will perform full checks.
    """
    import os
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # default path to memo-links.js (two levels up from resources/pdfs)
    memo_js_path = os.path.join(script_dir, '..', '..', 'js', 'memo-links.js')

    existing = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))

    # Try parsing the JS memo-links file first; if it doesn't exist or parsing fails,
    # return an empty structure so the checker will perform normal checks.
    try:
        if os.path.exists(memo_js_path):
            content = open(memo_js_path, 'r', encoding='utf-8').read()

            # Find all quoted URLs in the file
            url_matches = re.findall(r"['\"](https?://[^'\"]+)['\"]", content)

            for url in url_matches:
                # Only consider examiner/examiners report URLs
                if not re.search(r'Examiner|Examiners|EXAMINERS', url, re.IGNORECASE):
                    continue

                # Try to extract subject, session and year from URL using a few heuristics
                # Pattern 1: /{subject}-{session}-{year}- ... e.g. /A311-JUNE-2024-...
                m = re.search(r"/([A-Z0-9\-]+)[-_ ]?(JUNE|MAY|NOVEMBER|OCTOBER|NOV|OCT)[-_ ]?(20\d{2})", url, re.IGNORECASE)
                if m:
                    subject = m.group(1).upper()
                    # normalize session to canonical tokens (MAY/JUNE -> JUNE; OCTOBER/NOVEMBER -> NOVEMBER)
                    raw_session = m.group(2).upper()
                    if raw_session in ('MAY', 'JUNE'):
                        session = 'JUNE'
                    elif raw_session in ('OCTOBER', 'NOVEMBER', 'OCT', 'NOV'):
                        session = 'NOVEMBER'
                    else:
                        session = raw_session
                    year = m.group(3)
                # Pattern 1b: /{subject}-{year}-{session}- ... e.g. /F102-2010-NOV-...
                elif re.search(r"/([A-Z0-9\-]+)[-_ ]?(20\d{2})[-_ ]?(JUNE|MAY|NOVEMBER|OCTOBER|NOV|OCT)", url, re.IGNORECASE):
                    m1b = re.search(r"/([A-Z0-9\-]+)[-_ ]?(20\d{2})[-_ ]?(JUNE|MAY|NOVEMBER|OCTOBER|NOV|OCT)", url, re.IGNORECASE)
                    subject = m1b.group(1).upper()
                    year = m1b.group(2)
                    raw_session = m1b.group(3).upper()
                    if raw_session in ('MAY', 'JUNE'):
                        session = 'JUNE'
                    elif raw_session in ('OCTOBER', 'NOVEMBER', 'OCT', 'NOV'):
                        session = 'NOVEMBER'
                    else:
                        session = raw_session
                else:
                    # Pattern 2: /{subject}_S1_{year}_ or _S2_ format -> map S1->MAY, S2->NOVEMBER
                    m2 = re.search(r"/([A-Z0-9\-]+)_S([12])_(20\d{2})", url, re.IGNORECASE)
                    if m2:
                        subject = m2.group(1).upper()
                        s_num = m2.group(2)
                        year = m2.group(3)
                        # Map S1 -> canonical JUNE, S2 -> NOVEMBER
                        session = 'JUNE' if s_num == '1' else 'NOVEMBER'
                    else:
                        # Pattern 3: try to find /{subject}-{year}- or /{subject}{sep}{year}
                        m3 = re.search(r"/([A-Z0-9\-]+)[-_ ]?(20\d{2})", url, re.IGNORECASE)
                        if m3:
                            subject = m3.group(1).upper()
                            year = m3.group(2)
                            # session unknown -> place under canonical JUNE as a best-effort default
                            session = 'JUNE'
                        else:
                            # Could not determine subject/year/session - skip
                            continue

                # Determine paper number if present, else mark as 'General'
                p = re.search(r'PAPER[-_ ]?(\d)', url, re.IGNORECASE)
                paper = int(p.group(1)) if p else 'General'

                # Add to existing structure (sessions are canonicalized above)
                existing[subject][year][session].append({'paper': paper, 'url': url})

            return existing
        else:
            print(f"memo-links.js not found at {memo_js_path}; will perform full checks")
            return existing
    except Exception as e:
        print(f"Warning: Failed to parse memo-links.js: {e}")
        print("Will perform full checks instead.")
        return existing

def save_reports(results, reports_file='resources/pdfs/examiners_manifest.json'):
    """Save found reports to JSON file for future reference"""
    # Convert defaultdict to regular dict for JSON serialization
    data = {}
    for subject, years in results.items():
        data[subject] = {}
        for year, sessions in years.items():
            data[subject][year] = {}
            for session, reports in sessions.items():
                data[subject][year][session] = reports
    
    with open(reports_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

def check_url(url, verify=True, timeout=7, retries=2, backoff=1.5):
    attempt = 0
    while True:
        try:
            response = requests.head(url, verify=verify, timeout=timeout, allow_redirects=True)
            return response.status_code == 200
        except requests.exceptions.SSLError:
            raise
        except Exception:
            attempt += 1
            if attempt > retries:
                return False
            time.sleep(backoff * attempt)

def reports_exist_for_session(existing, subject, year, session):
    """Check if we already have reports for this subject/year/session"""
    return (subject in existing and 
            year in existing[subject] and 
            session in existing[subject][year] and 
            len(existing[subject][year][session]) > 0)

def main(argv=None):
    parser = argparse.ArgumentParser(description='Smart examiners reports checker')
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
    print("Smart Examiners Reports Scraper - Only checks missing reports")
    print("="*80)
    
    # TLS verify configuration
    verify = True
    if args.insecure:
        verify = False
    elif args.ca_bundle:
        verify = args.ca_bundle

    # Load existing reports
    print("\nLoading existing reports from resources/pdfs/examiners_manifest.json...")
    existing_reports = load_existing_reports()

    # Prepare results container (used by normal probing flow and crawl-manifest ingestion)
    results = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))

    # If a crawl manifest is provided, ingest it and construct results directly
    if args.crawl_manifest:
        print(f"\nIngesting crawl manifest {args.crawl_manifest}...")
        try:
            with open(args.crawl_manifest, 'r', encoding='utf-8') as cf:
                crawl = json.load(cf)
        except Exception as e:
            print(f"Failed to load crawl manifest: {e}")
            return

        for url in crawl.get('found_pdfs', []) + crawl.get('found_links', []):
            u = url.upper()
            # Only handle examiner/examiners report PDFs here
            if not re.search(r'EXAMINER|EXAMINERS|EXAMINERS-REPORT', u):
                continue

            # Try to extract metadata similar to load_existing_reports heuristics
            m = re.search(r"/([A-Z0-9\-]+)[-_ ]?(JUNE|MAY|NOVEMBER|OCTOBER|NOV|OCT)[-_ ]?(20\d{2})", u, re.IGNORECASE)
            if m:
                subject = m.group(1).upper()
                raw_session = m.group(2).upper()
                year = m.group(3)
                if raw_session in ('MAY', 'JUNE'):
                    canonical = 'JUNE'
                elif raw_session in ('OCTOBER', 'NOVEMBER', 'NOV', 'OCT'):
                    canonical = 'NOVEMBER'
                else:
                    canonical = raw_session
            # Pattern for SUBJECT-YEAR-SESSION (e.g., F102-2010-NOV-)
            elif re.search(r"/([A-Z0-9\-]+)[-_ ]?(20\d{2})[-_ ]?(JUNE|MAY|NOVEMBER|OCTOBER|NOV|OCT)", u, re.IGNORECASE):
                m1b = re.search(r"/([A-Z0-9\-]+)[-_ ]?(20\d{2})[-_ ]?(JUNE|MAY|NOVEMBER|OCTOBER|NOV|OCT)", u, re.IGNORECASE)
                subject = m1b.group(1).upper()
                year = m1b.group(2)
                raw_session = m1b.group(3).upper()
                if raw_session in ('MAY', 'JUNE'):
                    canonical = 'JUNE'
                elif raw_session in ('OCTOBER', 'NOVEMBER', 'NOV', 'OCT'):
                    canonical = 'NOVEMBER'
                else:
                    canonical = raw_session
            else:
                m2 = re.search(r"/([A-Z0-9\-]+)_S([12])_(20\d{2})", u, re.IGNORECASE)
                if m2:
                    subject = m2.group(1).upper()
                    sn = m2.group(2)
                    year = m2.group(3)
                    canonical = 'JUNE' if sn == '1' else 'NOVEMBER'
                else:
                    m3 = re.search(r"/([A-Z0-9\-]{2,8})[-_ ]?(20\d{2})", u)
                    if m3:
                        subject = m3.group(1).upper()
                        year = m3.group(2)
                        canonical = 'JUNE'
                    else:
                        continue

            # Determine paper if present
            p = re.search(r'PAPER[-_ ]?(\d)', u)
            paper = int(p.group(1)) if p else 'General'

            results[subject][year][canonical].append({'paper': paper, 'url': url})

        # Save manifest
        manifest_path = 'resources/pdfs/examiners_manifest.json'
        manifest = {}
        for subject in results:
            manifest[subject] = {}
            for year in results[subject]:
                manifest[subject][year] = results[subject][year]

        if not args.dry_run:
            # Save the manifest (no separate reports file needed)
            try:
                with open(manifest_path, 'w', encoding='utf-8') as mf:
                    json.dump(manifest, mf, indent=2)
                print(f"Wrote manifest to {manifest_path}")
            except Exception as e:
                print(f"Failed to write manifest: {e}")
        else:
            print('Dry run: manifest not written')

        return
    
    # Count existing reports
    existing_count = sum(
        len(reports)
        for subject_data in existing_reports.values()
        for year_data in subject_data.values()
        for reports in year_data.values()
    )
    print(f"Found {existing_count} existing reports")
    
    results = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    checks_needed = 0
    checks_skipped = 0
    
    years_to_check = [y for y in YEARS if args.start_year <= y <= args.end_year]

    for subject in args.subjects:
        print(f"\nChecking {subject}...")
        
        for year in years_to_check:
            year_str = str(year)
            
            for session in SESSIONS:
                # Normalize input session token to canonical names used in storage
                if session in ('MAY', 'JUNE'):
                    canonical_session = 'JUNE'
                elif session in ('OCTOBER', 'NOVEMBER'):
                    canonical_session = 'NOVEMBER'
                else:
                    canonical_session = session

                # Check if we already have reports for this canonical session
                if reports_exist_for_session(existing_reports, subject, year_str, canonical_session):
                    # Copy existing reports under canonical session
                    results[subject][year_str][canonical_session] = existing_reports[subject][year_str][canonical_session]
                    checks_skipped += 1
                    continue
                
                # Need to check for reports
                checks_needed += 1
                found_for_session = False
                
                # Try patterns without paper number first (general reports)
                for pattern in [EXAMINERS_REPORT_PATTERNS[0], EXAMINERS_REPORT_PATTERNS[2], 
                               EXAMINERS_REPORT_PATTERNS[3], EXAMINERS_REPORT_PATTERNS[4], 
                               EXAMINERS_REPORT_PATTERNS[5]]:
                    url = pattern.format(
                        subject=subject,
                        session=session,
                        year=year
                    )
                    try:
                        ok = check_url(url, verify=verify)
                    except requests.exceptions.SSLError as e:
                        print(f"SSL error when checking {url}: {e}")
                        ok = False

                    if ok:
                        print(f"  ✓ NEW: {year} {canonical_session} Examiners Report (General)")
                        results[subject][year_str][canonical_session].append({
                            'paper': 'General',
                            'url': url
                        })
                        found_for_session = True
                        break
                    time.sleep(args.delay)
                
                # If no general report found, try paper-specific reports
                if not found_for_session:
                    for paper in PAPERS:
                        url = EXAMINERS_REPORT_PATTERNS[1].format(
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
                            print(f"  ✓ NEW: {year} {canonical_session} Paper {paper} Examiners Report")
                            results[subject][year_str][canonical_session].append({
                                'paper': paper,
                                'url': url
                            })
                        time.sleep(args.delay)
    
    # Save all results (existing + new) for next time
    manifest_path = 'resources/pdfs/examiners_manifest.json'
    manifest = {}
    for subject in results:
        manifest[subject] = {}
        for year in results[subject]:
            manifest[subject][year] = results[subject][year]

    if not args.dry_run:
        save_reports(results)
        try:
            with open(manifest_path, 'w', encoding='utf-8') as mf:
                json.dump(manifest, mf, indent=2)
            print(f"Wrote manifest to {manifest_path}")
        except Exception as e:
            print(f"Failed to write manifest: {e}")
    else:
        print('Dry run: manifests not written')
    
    # Print summary
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    print(f"Existing reports: {checks_skipped}")
    print(f"New checks needed: {checks_needed}")
    if checks_needed + checks_skipped > 0:
        print(f"Requests saved: {checks_skipped} ({checks_skipped / (checks_needed + checks_skipped) * 100:.1f}%)")
    print()
    
    new_found = 0
    for subject in SUBJECTS:
        count = sum(
            len(reports)
            for year_data in results[subject].values()
            for reports in year_data.values()
        )
        
        existing_for_subject = sum(
            len(reports)
            for year_data in existing_reports[subject].values()
            for reports in year_data.values()
        )
        
        new_for_subject = count - existing_for_subject
        if new_for_subject > 0:
            print(f"{subject}: {count} total ({new_for_subject} NEW)")
            new_found += new_for_subject
        elif count > 0:
            print(f"{subject}: {count} total")
    
    print(f"\nTotal NEW reports found: {new_found}")
    
    # Generate detailed output for NEW reports only
    if new_found > 0:
        print("\n" + "="*80)
        print("NEW Examiners Reports Found")
        print("="*80)
        
        for subject in SUBJECTS:
            new_reports = []
            
            for year in sorted(results[subject].keys(), reverse=True):
                for session in SESSIONS:
                    if session in results[subject][year]:
                        for report in results[subject][year][session]:
                            # Check if this is new
                            is_new = not reports_exist_for_session(existing_reports, subject, year, session)
                            if is_new:
                                new_reports.append((year, session, report))
            
            if new_reports:
                print(f"\n{subject}:")
                for year, session, report in new_reports:
                    paper_info = f"Paper {report['paper']}" if report['paper'] != 'General' else 'General'
                    print(f"  {year} {session} {paper_info}:")
                    print(f"    {report['url']}")
        
        # Generate JavaScript format for NEW reports
        print("\n" + "="*80)
        print("JavaScript Format for NEW Reports")
        print("="*80)
        
        for subject in SUBJECTS:
            has_new = False
            
            # Check if subject has new reports
            for year in results[subject].keys():
                for session in SESSIONS:
                    if session in results[subject][year]:
                        is_new = not reports_exist_for_session(existing_reports, subject, year, session)
                        if is_new:
                            has_new = True
                            break
                if has_new:
                    break
            
            if has_new:
                print(f"\n'{subject}': {{")
                
                for year in sorted(results[subject].keys(), reverse=True):
                    year_has_new = False
                    for session in SESSIONS:
                        if session in results[subject][year]:
                            is_new = not reports_exist_for_session(existing_reports, subject, year, session)
                            if is_new:
                                year_has_new = True
                                break
                    
                    if year_has_new:
                        print(f"  '{year}': {{")
                        
                        for session in SESSIONS:
                            if session in results[subject][year]:
                                is_new = not reports_exist_for_session(existing_reports, subject, year, session)
                                if is_new:
                                    reports = results[subject][year][session]
                                    print(f"    '{session}': {{")
                                    
                                    for report in reports:
                                        paper_key = report['paper'] if report['paper'] != 'General' else 'general'
                                        print(f"      '{paper_key}': '{report['url']}',")
                                    
                                    print(f"    }},")
                        
                        print(f"  }},")
                
                print("},")
    else:
        print("\nNo new reports found. All known reports are already recorded.")

if __name__ == "__main__":
    main()
