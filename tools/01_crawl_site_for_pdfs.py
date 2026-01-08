"""
Lightweight site crawler to find PDF links for a subject and given years by:
- hitting the site's search page (?s=...) for subject and subject+year
- crawling a small set of internal pages (depth-limited) and extracting hrefs
- reporting discovered PDF URLs and links that include the subject/year

Designed to be conservative (limited requests), TLS options supported.

Usage:
  python tools/crawl_site_for_subject_years.py F102 2010 2011 --insecure

Outputs:
  - prints discovered links
  - writes `tools/crawl_results_{subject}.json`

"""
import argparse
import requests
import re
import time
import json
from urllib.parse import urljoin, urlparse


def extract_links(html, base_url):
    # simple href extractor
    links = set()
    for m in re.findall(r'href=["\']([^"\']+)["\']', html, flags=re.IGNORECASE):
        # make absolute
        abs_url = urljoin(base_url, m)
        links.add(abs_url)
    return links


def is_internal(url, base_netloc):
    try:
        p = urlparse(url)
        return p.netloc == '' or p.netloc == base_netloc
    except Exception:
        return False


def crawl(base_url, subject, years, verify=True, delay=0.2, max_pages=20):
    results = {
        'subject': subject,
        'years': years,
        'base_url': base_url,
        'found_pdfs': [],
        'found_links': []
    }

    session = requests.Session()

    parsed = urlparse(base_url)
    base_netloc = parsed.netloc

    seen_pages = set()
    to_visit = [base_url]

    pages_visited = 0

    # First, try site search pages for subject and year combinations
    search_terms = [subject] + [f"{subject} {y}" for y in years]
    for term in search_terms:
        s_url = f"{base_url.rstrip('/')}/?s={requests.utils.requote_uri(term)}"
        try:
            r = session.get(s_url, verify=verify, timeout=10)
            if r.status_code == 200:
                links = extract_links(r.text, base_url)
                for l in links:
                    if l.lower().endswith('.pdf') and subject.lower() in l.lower():
                        results['found_pdfs'].append({'source': s_url, 'url': l})
                    if subject.lower() in l.lower() or any(str(y) in l for y in years):
                        results['found_links'].append({'source': s_url, 'url': l})
                    # enqueue internal pages found
                    if is_internal(l, base_netloc) and l not in seen_pages and pages_visited < max_pages:
                        to_visit.append(l)
            else:
                # still add the search page to visited list to avoid retry storms
                seen_pages.add(s_url)
        except Exception as e:
            # ignore and continue
            seen_pages.add(s_url)
        time.sleep(delay)

    # Now do a small breadth-first crawl of internal pages up to max_pages
    while to_visit and pages_visited < max_pages:
        page = to_visit.pop(0)
        if page in seen_pages:
            continue
        try:
            r = session.get(page, verify=verify, timeout=10)
            seen_pages.add(page)
            pages_visited += 1
            if r.status_code != 200:
                continue
            links = extract_links(r.text, base_url)
            for l in links:
                # check PDFs
                if l.lower().endswith('.pdf') and subject.lower() in l.lower():
                    results['found_pdfs'].append({'source': page, 'url': l})
                # check subject/year mentions
                if subject.lower() in l.lower() or any(str(y) in l for y in years):
                    results['found_links'].append({'source': page, 'url': l})
                # enqueue new internal pages
                if is_internal(l, base_netloc) and l not in seen_pages and l not in to_visit and pages_visited + len(to_visit) < max_pages:
                    to_visit.append(l)
        except Exception:
            seen_pages.add(page)
        time.sleep(delay)

    # dedupe
    results['found_pdfs'] = {item['url']: item for item in results['found_pdfs']}
    results['found_links'] = {item['url']: item for item in results['found_links']}

    # flatten
    results['found_pdfs'] = list(results['found_pdfs'].keys())
    results['found_links'] = list(results['found_links'].keys())

    return results


def main(argv=None):
    parser = argparse.ArgumentParser(description='Crawl site for subject/year PDF links')
    parser.add_argument('subject', help='Subject code (e.g. F102)')
    parser.add_argument('years', nargs='+', type=int, help='Years to search (e.g. 2010 2011)')
    parser.add_argument('--base-url', default='https://www.actuarialsociety.org.za', help='Base site URL')
    parser.add_argument('--delay', type=float, default=0.2, help='Delay between requests (s)')
    parser.add_argument('--max-pages', type=int, default=30, help='Max internal pages to visit')
    parser.add_argument('--insecure', action='store_true', help='Disable TLS verification')
    args = parser.parse_args(argv)

    verify = not args.insecure

    subject = args.subject
    years = args.years

    print(f"Crawling {args.base_url} for {subject} years {years}")

    res = crawl(args.base_url, subject, years, verify=verify, delay=args.delay, max_pages=args.max_pages)

    out_path = f"tools/crawl_results_{subject}.json"
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(res, f, indent=2)

    print('\nFOUND PDF LINKS:')
    for u in res['found_pdfs']:
        print('  ', u)

    print('\nFOUND RELATED LINKS:')
    for u in res['found_links'][:200]:
        print('  ', u)

    print(f"\nWrote results to {out_path}")

if __name__ == '__main__':
    main()
