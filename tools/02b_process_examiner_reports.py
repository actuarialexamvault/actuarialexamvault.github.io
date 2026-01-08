"""
Process crawl results to discover examiners reports and generate manifest.
"""

import argparse
import re
import json
import os
from collections import defaultdict
from pathlib import Path

# Get the project root directory
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
MANIFEST_PATH = PROJECT_ROOT / "resources" / "pdfs" / "examiners_manifest.json"

def load_existing_reports():
    try:
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def normalize_session(raw_session):
    rs = raw_session.upper()
    if rs in ("MAY", "JUNE", "JUN"):
        return "JUNE"
    elif rs in ("OCT", "OCTOBER", "NOV", "NOVEMBER"):
        return "NOVEMBER"
    return rs

def parse_examiner_report_url(url):
    try:
        # Only process PDF URLs
        if not url.lower().endswith('.pdf'):
            return None
        
        u = url.upper()
        if "EXAMINER" not in u:
            return None
        m1 = re.search(r"/([A-Z0-9\-]+)[-_ ]?(JUNE|MAY|NOVEMBER|OCTOBER|JUN)[-_ ]?(20\d{2})", u)
        m1b = re.search(r"/([A-Z0-9\-]+)[-_ ]?(20\d{2})[-_ ]?(JUNE|MAY|NOVEMBER|OCTOBER|NOV|OCT)", u)
        m2 = re.search(r"/([A-Z0-9\-]+)_S([12])_(20\d{2})", u, re.IGNORECASE)
        if m1:
            subject, raw_session, year = m1.group(1).upper(), m1.group(2), m1.group(3)
            session = normalize_session(raw_session)
        elif m1b:
            subject, year, raw_session = m1b.group(1).upper(), m1b.group(2), m1b.group(3)
            session = normalize_session(raw_session)
        elif m2:
            subject, sn, year = m2.group(1).upper(), m2.group(2), m2.group(3)
            session = "JUNE" if sn == "1" else "NOVEMBER"
        else:
            return None
        p = re.search(r"PAPER[-_ ]?(\d)", u)
        paper = int(p.group(1)) if p else "General"
        return {"subject": subject, "year": year, "session": session, "paper": paper, "url": url}
    except:
        return None

def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--crawl-manifest", required=True)
    parser.add_argument("--subjects", nargs="*")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    
    print("="*80)
    print("Examiners Reports Discovery from Crawl Results")
    print("="*80)
    
    existing = load_existing_reports()
    existing_count = sum(len(reports) for sd in existing.values() for yd in sd.values() for reports in yd.values())
    print(f"\nFound {existing_count} existing reports")
    
    with open(args.crawl_manifest, "r") as f:
        crawl = json.load(f)
    
    results = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    new_reports = []
    changed_reports = []
    
    for url in crawl.get("found_pdfs", []) + crawl.get("found_links", []):
        meta = parse_examiner_report_url(url)
        if not meta or (args.subjects and meta["subject"] not in args.subjects):
            continue
        
        # Check if a report already exists for this subject/year/session/paper combo
        existing_url = None
        if (meta["subject"] in existing and 
            meta["year"] in existing[meta["subject"]] and 
            meta["session"] in existing[meta["subject"]][meta["year"]]):
            
            # Check if we already have a report for this paper
            for e in existing[meta["subject"]][meta["year"]][meta["session"]]:
                if e.get("paper") == meta["paper"]:
                    existing_url = e.get("url")
                    break
        
        # Categorize: new (no entry), changed (different URL), or same (identical URL)
        if existing_url is None or existing_url == '':
            # No report exists for this slot - this is NEW
            new_reports.append(meta)
        elif existing_url != url:
            # URL is different - this is a CHANGE (potential update/correction)
            changed_reports.append({**meta, 'old_url': existing_url})
        # else: URL is identical, skip (not interesting)
        
        results[meta["subject"]][meta["year"]][meta["session"]].append({"paper": meta["paper"], "url": url})
    
    print(f"\nNEW reports found: {len(new_reports)}")
    print(f"CHANGED URLs found: {len(changed_reports)}")
    
    if new_reports:
        print("\n" + "="*80)
        print("NEW REPORTS DISCOVERED")
        print("="*80)
        by_subj = defaultdict(list)
        for r in new_reports:
            by_subj[r["subject"]].append(r)
        for subj in sorted(by_subj.keys()):
            print(f"\n{subj}:")
            for r in sorted(by_subj[subj], key=lambda x: (x["year"], x["session"])):
                print(f"  {r['year']} {r['session']} Paper {r['paper']}")
                print(f"    {r['url']}")
    
    if changed_reports:
        print("\n" + "="*80)
        print("CHANGED URLs (Potential Updates/Corrections)")
        print("="*80)
        by_subj = defaultdict(list)
        for r in changed_reports:
            by_subj[r["subject"]].append(r)
        for subj in sorted(by_subj.keys()):
            print(f"\n{subj}:")
            for r in sorted(by_subj[subj], key=lambda x: (x["year"], x["session"])):
                print(f"  {r['year']} {r['session']} Paper {r['paper']}")
                print(f"    OLD: {r['old_url']}")
                print(f"    NEW: {r['url']}")
    
    if not args.dry_run:
        MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
            json.dump(dict(results), f, indent=2)
        print(f"\nWrote manifest to {MANIFEST_PATH}")
    
    return 0

if __name__ == "__main__":
    import sys
    raise SystemExit(main(sys.argv[1:]))
