"""
Process crawl results to discover exam papers and generate manifest.
"""

import argparse
import re
import json
from collections import defaultdict
from pathlib import Path

# Get the project root directory
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
MANIFEST_PATH = PROJECT_ROOT / "resources" / "pdfs" / "papers_manifest.json"
CANONICAL_PATH = PROJECT_ROOT / "resources" / "pdfs" / "exam_links.json"

def load_existing_links():
    try:
        with open(CANONICAL_PATH, "r", encoding="utf-8") as f:
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

def detect_paper_from_url(url, default_paper=None):
    try:
        m = re.search(r"([A-Z0-9]+)([ABab])(?=[^A-Za-z0-9]|_S[12]|_S|[_\-]?(Exam|EXAM|PAPER))", url)
        if not m:
            m = re.search(r"([A-Z]{1,3}\d{1,3})([ABab])", url)
        if m:
            letter = m.group(2).upper()
            return 1 if letter == "A" else 2
    except:
        pass
    return default_paper if default_paper is not None else 1

def parse_exam_url(url):
    try:
        # Only process PDF URLs
        if not url.lower().endswith('.pdf'):
            return None
        
        u = url.upper()
        if "EXAMINER" in u or "EXAMINERS" in u or "EXAMINERS-REPORT" in u:
            return None  # Skip examiner reports
        if "EXAM" not in u:
            return None
        
        m = re.search(r"/([A-Z0-9\-]+)_S([12])_(20\d{2})", u)
        if m:
            subject, snum, year = m.group(1), m.group(2), m.group(3)
            session = "JUNE" if snum == "1" else "NOVEMBER"
        else:
            m = re.search(r"/([A-Z0-9\-]+)[-_ ](20\d{2})[-_ ](JUNE|MAY|NOVEMBER|NOV|OCT|OCTOBER|JUN)", u)
            if m:
                subject, year, raw_session = m.group(1), m.group(2), m.group(3)
                session = normalize_session(raw_session)
            else:
                m2 = re.search(r"/([A-Z0-9\-]+)[-_ ](JUNE|MAY|NOVEMBER|NOV|OCT|OCTOBER|JUN)[-_ ](20\d{2})", u)
                if m2:
                    subject, raw_session, year = m2.group(1), m2.group(2), m2.group(3)
                    session = normalize_session(raw_session)
                else:
                    return None
        
        p = re.search(r"PAPER[-_ ]?(\d)", u)
        if not p:
            p = re.search(r"EXAM[-_ ]?(\d)", u)
        paper = int(p.group(1)) if p else detect_paper_from_url(url)
        
        return {"subject": subject, "year": year, "session": session, "paper": str(paper), "url": url}
    except:
        return None

def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--crawl-manifest", required=True)
    parser.add_argument("--subjects", nargs="*")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    
    print("="*80)
    print("Exam Papers Discovery from Crawl Results")
    print("="*80)
    
    existing = load_existing_links()
    existing_count = sum(len(papers) for sd in existing.values() for sess in sd.values() for papers in sess.values())
    print(f"\nFound {existing_count} existing papers")
    
    with open(args.crawl_manifest, "r") as f:
        crawl = json.load(f)
    
    results = defaultdict(lambda: defaultdict(lambda: defaultdict(dict)))
    new_papers = []
    changed_papers = []
    
    for url in crawl.get("found_pdfs", []) + crawl.get("found_links", []):
        meta = parse_exam_url(url)
        if not meta or (args.subjects and meta["subject"] not in args.subjects):
            continue
        
        # Check if this subject/session/year/paper slot already exists
        existing_url = None
        if (meta["subject"] in existing and 
            meta["session"] in existing[meta["subject"]] and 
            meta["year"] in existing[meta["subject"]][meta["session"]] and 
            meta["paper"] in existing[meta["subject"]][meta["session"]][meta["year"]]):
            existing_url = existing[meta["subject"]][meta["session"]][meta["year"]][meta["paper"]]
        
        # Categorize: new (no entry), changed (different URL), or same (identical URL)
        if existing_url is None or existing_url == '':
            # Slot is empty or doesn't exist - this is NEW
            new_papers.append(meta)
        elif existing_url != url:
            # URL is different - this is a CHANGE (potential update/correction)
            changed_papers.append({**meta, 'old_url': existing_url})
        # else: URL is identical, skip (not interesting)
        
        results[meta["subject"]][meta["year"]].setdefault(meta["session"], {})[meta["paper"]] = url
    
    print(f"\nNEW papers found: {len(new_papers)}")
    print(f"CHANGED URLs found: {len(changed_papers)}")
    
    if new_papers:
        print("\n" + "="*80)
        print("NEW PAPERS DISCOVERED")
        print("="*80)
        by_subj = defaultdict(list)
        for p in new_papers:
            by_subj[p["subject"]].append(p)
        for subj in sorted(by_subj.keys()):
            print(f"\n{subj}:")
            for p in sorted(by_subj[subj], key=lambda x: (x["year"], x["session"], x["paper"])):
                print(f"  {p['year']} {p['session']} Paper {p['paper']}")
                print(f"    {p['url']}")
    
    if changed_papers:
        print("\n" + "="*80)
        print("CHANGED URLs (Potential Updates/Corrections)")
        print("="*80)
        by_subj = defaultdict(list)
        for p in changed_papers:
            by_subj[p["subject"]].append(p)
        for subj in sorted(by_subj.keys()):
            print(f"\n{subj}:")
            for p in sorted(by_subj[subj], key=lambda x: (x["year"], x["session"], x["paper"])):
                print(f"  {p['year']} {p['session']} Paper {p['paper']}")
                print(f"    OLD: {p['old_url']}")
                print(f"    NEW: {p['url']}")
    
    if not args.dry_run:
        MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
            json.dump(dict(results), f, indent=2)
        print(f"\nWrote manifest to {MANIFEST_PATH}")
    
    return 0

if __name__ == "__main__":
    import sys
    raise SystemExit(main(sys.argv[1:]))
