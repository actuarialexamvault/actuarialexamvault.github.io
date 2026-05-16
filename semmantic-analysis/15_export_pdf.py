"""
Step 15: Export topic summaries → PDF (summaries only, no past exam questions).

Builds a clean print-ready HTML from topic_summaries.json and converts it to
PDF using Microsoft Edge's built-in headless engine — no extra packages needed.

Usage
-----
  python 15_export_pdf.py
  python 15_export_pdf.py --out my_guide.pdf
  python 15_export_pdf.py --edge "C:\\path\\to\\msedge.exe"

Output
------
  results/study_guide_summaries.pdf
"""

import argparse
import csv
import json
import re
import sys
import tempfile
from pathlib import Path

RESULTS = Path(__file__).parent / "results"

# ---------------------------------------------------------------------------
# PDF via Word COM (no installs needed — pywin32 ships with Office/Python)
# ---------------------------------------------------------------------------

def export_docs(html_path: Path, pdf_path: Path, docx_path: Path) -> None:
    import shutil
    import win32com.client
    WD_EXPORT_FORMAT_PDF = 17
    WD_FORMAT_XML = 12  # .docx

    # Save to a temp PDF (no spaces, avoids locking the destination if it's open)
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as t:
        tmp_pdf = Path(t.name)
    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as t:
        tmp_docx = Path(t.name)

    print("Opening Word COM ...")
    word = win32com.client.Dispatch("Word.Application")
    word.Visible = False
    try:
        doc = word.Documents.Open(str(html_path.resolve()))
        print(f"Saving Word → {docx_path.name} ...")
        doc.SaveAs2(str(tmp_docx), FileFormat=WD_FORMAT_XML)
        print(f"Saving PDF  → {pdf_path.name} ...")
        doc.ExportAsFixedFormat(str(tmp_pdf), WD_EXPORT_FORMAT_PDF)
        doc.Close(False)
    finally:
        word.Quit()

    shutil.move(str(tmp_pdf),  str(pdf_path))
    shutil.move(str(tmp_docx), str(docx_path))

# ---------------------------------------------------------------------------
# Markdown → HTML (Python-side renderer — no JS required)
# ---------------------------------------------------------------------------

def _md_inline(s: str) -> str:
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"\*(.+?)\*",     r"<em>\1</em>",         s)
    s = re.sub(r"_(.+?)_",       r"<em>\1</em>",          s)
    s = re.sub(r"`([^`]+)`",     r"<code>\1</code>",      s)
    return s


def _render_md(text: str) -> str:
    text = re.sub(
        r"```[^\n]*\n([\s\S]*?)```",
        lambda m: "<pre><code>" + m.group(1).replace("&", "&amp;").replace("<", "&lt;") + "</code></pre>",
        text,
    )
    lines = text.split("\n")
    out = []
    in_ul = in_ol = False

    def close_lists():
        nonlocal in_ul, in_ol
        if in_ul: out.append("</ul>"); in_ul = False
        if in_ol: out.append("</ol>"); in_ol = False

    for line in lines:
        esc = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        if re.match(r"^#### ", esc):
            close_lists(); out.append(f"<h4>{_md_inline(esc[5:])}</h4>"); continue
        if re.match(r"^### ", esc):
            close_lists(); out.append(f"<h3>{_md_inline(esc[4:])}</h3>"); continue
        if re.match(r"^## ", esc):
            close_lists(); out.append(f"<h2>{_md_inline(esc[3:])}</h2>"); continue
        if re.match(r"^# ", esc):
            close_lists(); out.append(f"<h1>{_md_inline(esc[2:])}</h1>"); continue
        if re.match(r"^[-*] ", esc):
            if not in_ul: close_lists(); out.append("<ul>"); in_ul = True
            out.append(f"<li>{_md_inline(esc[2:])}</li>"); continue
        if re.match(r"^\d+\. ", esc):
            if not in_ol: close_lists(); out.append("<ol>"); in_ol = True
            item = re.sub(r"^\d+\.\s*", "", esc)
            out.append(f"<li>{_md_inline(item)}</li>"); continue
        close_lists()
        if esc.strip() == "":
            out.append("<br>"); continue
        out.append(f"<p>{_md_inline(esc)}</p>")

    close_lists()
    return "\n".join(out)


# ---------------------------------------------------------------------------
# Print-ready HTML — minimal inline styles so Word COM renders cleanly
# ---------------------------------------------------------------------------

def _priority_text(n_q: int, rec: float) -> str:
    if n_q >= 30 or rec >= 12:
        return "HIGH PRIORITY"
    elif n_q >= 20 or rec >= 8:
        return "MEDIUM PRIORITY"
    return "LOW PRIORITY"


def _latex_to_text(html: str) -> str:
    """Convert LaTeX delimiters to readable plain text for Word/PDF rendering."""
    import re as _re
    # Map common LaTeX commands to Unicode / readable text
    subs = [
        (r"\\frac\{([^}]+)\}\{([^}]+)\}", r"(\1)/(\2)"),
        (r"\\sqrt\{([^}]+)\}",             r"sqrt(\1)"),
        (r"\\sum",   "Σ"),  (r"\\prod",  "Π"),
        (r"\\int",   "∫"),  (r"\\infty", "∞"),
        (r"\\alpha", "α"),  (r"\\beta",  "β"),
        (r"\\gamma", "γ"),  (r"\\delta", "δ"),
        (r"\\mu",    "μ"),  (r"\\sigma", "σ"),
        (r"\\lambda","λ"),  (r"\\pi",    "π"),
        (r"\\leq",   "≤"),  (r"\\geq",   "≥"),
        (r"\\neq",   "≠"),  (r"\\approx","≈"),
        (r"\\times", "×"),  (r"\\cdot",  "·"),
        (r"\\left",  ""),   (r"\\right", ""),
        (r"\\\[",    ""),   (r"\\\]",    ""),
        (r"\{([^}]*)\}",    r"\1"),   # strip bare braces
        (r"_\{([^}]+)\}",  r"_\1"),  # subscript
        (r"\^\{([^}]+)\}", r"^\1"),  # superscript
        (r"_([A-Za-z0-9])",  r"_\1"),
        (r"\^([A-Za-z0-9])", r"^\1"),
    ]
    # Display math: $$...$$ → styled block
    def fmt_display(m):
        formula = m.group(1).strip()
        for pat, rep in subs:
            formula = _re.sub(pat, rep, formula)
        return f'<p style="font-family:Consolas,monospace;font-size:10pt;background:#f5f5f5;padding:4px 8px;margin:6px 0">{formula}</p>'
    html = _re.sub(r"\$\$([\s\S]+?)\$\$", fmt_display, html)
    # Inline math: $...$ → monospace span
    def fmt_inline(m):
        formula = m.group(1).strip()
        for pat, rep in subs:
            formula = _re.sub(pat, rep, formula)
        return f'<span style="font-family:Consolas,monospace;font-size:9.5pt">{formula}</span>'
    html = _re.sub(r"\$([^$\n]+?)\$", fmt_inline, html)
    return html


# Topics merged into another; skip as standalone entries in the PDF.
_MERGE_INTO: dict[str, str] = {
    "19. Further risk management": "5. Risks",
}


def build_print_html(topic_summaries: dict, topic_ranks: list) -> str:
    folders_ordered = [
        r["folder"] for r in topic_ranks
        if int(r["n_questions"]) > 0 and r["folder"] not in _MERGE_INTO
    ]
    sections = []
    for i, folder in enumerate(folders_ordered):
        if folder not in topic_summaries:
            continue
        r     = next((x for x in topic_ranks if x["folder"] == folder), {})
        n_q   = int(r.get("n_questions", 0))
        rec   = float(r.get("recency_score", 0))
        last  = r.get("last_tested_year", "")
        rank  = r.get("priority_rank", "")
        pri   = _priority_text(n_q, rec)
        summary_html = _latex_to_text(topic_summaries[folder].get("summary_html", ""))

        # HR separator between topics (not before the first)
        display_name = re.sub(r'^\d+\.\s*', '', folder)
        sep = "<hr style='border:none;border-top:2px solid #ccc;margin:24px 0'>" if i > 0 else ""

        sections.append(f"""{sep}
<h2 style="font-family:Arial,sans-serif;font-size:15pt;color:#1a1a2e;margin:0 0 2px">
  #{rank} &nbsp; {display_name}
  <span style="font-size:9pt;font-weight:normal;color:#777;margin-left:12px">{pri}</span>
</h2>
<p style="font-family:Arial,sans-serif;font-size:9pt;color:#888;margin:0 0 10px">
  {n_q} exam questions &nbsp;|&nbsp; last tested {last} &nbsp;|&nbsp; recency {rec:.2f}
</p>
<div style="font-family:Arial,sans-serif;font-size:11pt;line-height:1.55;color:#1a1a2e">
{summary_html}
</div>""")

    n = len(sections)
    body = "\n".join(sections)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>F102 Study Guide — Summaries</title>
<style>
  body  {{ font-family: Arial, sans-serif; font-size: 11pt;
           color: #1a1a2e; margin: 24px 32px; line-height: 1.55; }}
  h1    {{ font-size: 18pt; margin: 0 0 4px; }}
  h2    {{ font-size: 15pt; color: #1a1a2e; margin: 20px 0 2px; }}
  h3    {{ font-size: 13pt; margin: 14px 0 5px; border-bottom: 1px solid #ddd; padding-bottom: 2px; }}
  h4    {{ font-size: 11pt; margin: 10px 0 4px; }}
  ul, ol{{ padding-left: 22px; margin: 6px 0 10px; }}
  li    {{ margin-bottom: 4px; }}
  p     {{ margin: 0 0 8px; }}
  hr    {{ border: none; border-top: 2px solid #ccc; margin: 24px 0; }}
  code  {{ background: #f1f3f5; padding: 1px 4px; font-size: 9pt; }}
  pre   {{ background: #f1f3f5; padding: 8px; margin: 6px 0; font-size: 9pt; }}
</style>
</head>
<body>
<h1>F102 Study Guide &mdash; Topic Summaries</h1>
<p style="color:#888;font-size:9pt;margin:0 0 20px">{n} topics ordered by exam frequency</p>
{body}
</body>
</html>"""


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description="Export topic summaries to PDF")
    ap.add_argument("--out",  default=str(RESULTS / "study_guide_summaries.pdf"))
    args = ap.parse_args()

    output_pdf  = Path(args.out)
    output_docx = output_pdf.with_suffix(".docx")
    output_pdf.parent.mkdir(parents=True, exist_ok=True)

    summaries_path = RESULTS / "topic_summaries.json"
    if not summaries_path.exists():
        print("ERROR: topic_summaries.json not found. Run 13_llm_summaries.py first.")
        sys.exit(1)
    topic_summaries = json.loads(summaries_path.read_text(encoding="utf-8"))

    ranks_path = RESULTS / "topic_frequency.csv"
    if not ranks_path.exists():
        print("ERROR: topic_frequency.csv not found. Run 11_topic_frequency.py first.")
        sys.exit(1)
    topic_ranks = list(csv.DictReader(ranks_path.open(encoding="utf-8")))

    print(f"Loaded {len(topic_summaries)} summaries")
    html_content = build_print_html(topic_summaries, topic_ranks)

    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", suffix=".html", delete=False
    ) as tmp:
        tmp.write(html_content)
        tmp_path = Path(tmp.name)

    try:
        export_docs(tmp_path, output_pdf, output_docx)
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except PermissionError:
            pass  # Word may briefly hold the file; OS will clean it from Temp

    size_pdf  = output_pdf.stat().st_size  / 1_048_576
    size_docx = output_docx.stat().st_size / 1_048_576
    print(f"Done  PDF  : {output_pdf}  ({size_pdf:.1f} MB)")
    print(f"Done  Word : {output_docx} ({size_docx:.1f} MB)")


if __name__ == "__main__":
    main()
