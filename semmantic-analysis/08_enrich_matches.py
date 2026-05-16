"""
Step 8 (standalone): Enrich question_top_matches.csv with full text.

Reads the outputs already produced by steps 1-5 (no re-embedding needed).

Adds three text fields to every row:
  question_text  – the exam question body (what was asked)
  solution_text  – the examiner's memo / solution text (how to answer)
  note_text      – the matching Obsidian callout / note block text

Outputs:
  results/question_top_matches_enriched.csv   flat CSV with all original
                                               columns + 3 text columns
  results/question_review.html                human-readable HTML report
                                               grouped by question
"""

import csv
import html as html_lib
import json
import re
from pathlib import Path

RESULTS = Path(__file__).parent / "results"

# ── helpers ─────────────────────────────────────────────────────────────────

def extract_solution(full_text: str) -> str:
    """Return everything after the 'SOLUTION:' marker in the combined text."""
    marker = "SOLUTION:"
    idx = full_text.find(marker)
    if idx == -1:
        return ""
    return full_text[idx + len(marker):].strip()


def md_to_html_simple(text: str) -> str:
    """Very lightweight markdown → HTML converter (enough for display)."""
    lines = text.splitlines()
    out = []
    in_ul = False
    for line in lines:
        # Headings
        hm = re.match(r'^(#{1,4})\s+(.*)', line)
        if hm:
            if in_ul:
                out.append("</ul>")
                in_ul = False
            level = len(hm.group(1))
            out.append(f"<h{level}>{html_lib.escape(hm.group(2))}</h{level}>")
            continue
        # Bullet lists
        bm = re.match(r'^[\-\*]\s+(.*)', line)
        if bm:
            if not in_ul:
                out.append("<ul>")
                in_ul = True
            content = inline_md(bm.group(1))
            out.append(f"  <li>{content}</li>")
            continue
        # Close list on blank or non-bullet line
        if in_ul:
            out.append("</ul>")
            in_ul = False
        stripped = line.strip()
        if stripped == "":
            out.append("<br>")
        else:
            out.append(f"<p>{inline_md(stripped)}</p>")
    if in_ul:
        out.append("</ul>")
    return "\n".join(out)


def inline_md(text: str) -> str:
    """Escape HTML then re-apply bold/italic markers."""
    text = html_lib.escape(text)
    text = re.sub(r'\*\*\*(.+?)\*\*\*', r'<strong><em>\1</em></strong>', text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
    text = re.sub(r'`(.+?)`', r'<code>\1</code>', text)
    return text


# ── main ────────────────────────────────────────────────────────────────────

def main():
    # Validate prerequisites
    for name in ["questions_data.json", "notes_data.json", "question_top_matches.csv"]:
        if not (RESULTS / name).exists():
            raise FileNotFoundError(
                f"{name} not found in results/. Run the earlier pipeline steps first."
            )

    questions = json.loads((RESULTS / "questions_data.json").read_text(encoding="utf-8"))
    notes     = json.loads((RESULTS / "notes_data.json").read_text(encoding="utf-8"))

    # Index questions by id
    q_index: dict = {q["id"]: q for q in questions}

    # Index notes by (file, callout_header); also by file alone for file-level chunks
    n_callout_index: dict = {}
    n_file_index: dict    = {}
    for n in notes:
        key = (n["file"], n.get("callout_header") or "")
        n_callout_index[key] = n
        if n["chunk_type"] == "file":
            n_file_index[n["file"]] = n

    # Read the base CSV
    with open(RESULTS / "question_top_matches.csv", newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    # ── Enrich rows ──────────────────────────────────────────────────────────
    enriched = []
    for row in rows:
        q        = q_index.get(row["question_id"], {})
        q_text   = q.get("question_only", "")
        sol_text = extract_solution(q.get("text", ""))

        # Look up note: prefer exact (file, callout) match, fall back to file-level
        note_key = (row["note_file"], row.get("note_callout", ""))
        note = n_callout_index.get(note_key)
        if note is None:
            note = n_file_index.get(row["note_file"])
        note_text = note["text"] if note else ""

        enriched.append({
            **row,
            "question_text": q_text,
            "solution_text": sol_text,
            "note_text":     note_text,
        })

    if not enriched:
        print("No rows to enrich.")
        return

    # ── Write enriched CSV ────────────────────────────────────────────────────
    fieldnames = list(enriched[0].keys())
    out_csv = RESULTS / "question_top_matches_enriched.csv"
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(enriched)
    print(f"  Saved {out_csv.name} ({len(enriched)} rows)")

    # ── Generate HTML report ──────────────────────────────────────────────────
    # Group enriched rows by question_id (preserve encounter order)
    from collections import OrderedDict
    groups: dict = OrderedDict()
    for row in enriched:
        qid = row["question_id"]
        if qid not in groups:
            groups[qid] = {
                "meta": row,
                "matches": [],
            }
        groups[qid]["matches"].append(row)

    # Similarity band colouring
    def sim_class(sim_str: str) -> str:
        try:
            s = float(sim_str)
        except ValueError:
            return "sim-low"
        if s >= 0.80:
            return "sim-high"
        if s >= 0.70:
            return "sim-med"
        return "sim-low"

    # Build HTML body
    sections = []
    for qid, group in groups.items():
        meta    = group["meta"]
        matches = group["matches"]
        q_html  = md_to_html_simple(meta["question_text"])
        s_html  = md_to_html_simple(meta["solution_text"])

        match_cards = []
        for m in matches:
            callout_label = (
                f'<span class="callout-label">{html_lib.escape(m["note_callout"])}</span>'
                if m["note_callout"] else ""
            )
            note_html = md_to_html_simple(m["note_text"])
            sc = sim_class(m["similarity"])
            match_cards.append(f"""
      <div class="match-card {sc}">
        <div class="match-header">
          <span class="rank">#{html_lib.escape(m["rank"])}</span>
          <span class="folder">{html_lib.escape(m["note_folder"])}</span>
          <span class="heading">{html_lib.escape(m["note_heading"])}</span>
          {callout_label}
          <span class="sim-badge">{html_lib.escape(m["similarity"])}</span>
        </div>
        <div class="note-body">{note_html}</div>
      </div>""")

        sections.append(f"""
  <section class="question-block" id="{html_lib.escape(qid)}">
    <div class="q-header">
      <h2>{html_lib.escape(qid)}</h2>
      <span class="meta-pill">{html_lib.escape(meta["year"])} · {html_lib.escape(meta["session"])}</span>
      <span class="meta-pill chapter">{html_lib.escape(meta["chapters_tagged"])}</span>
    </div>

    <details open>
      <summary class="section-toggle">Question</summary>
      <div class="text-block question-text">{q_html}</div>
    </details>

    <details open>
      <summary class="section-toggle">Examiner's Solution</summary>
      <div class="text-block solution-text">{s_html}</div>
    </details>

    <details open>
      <summary class="section-toggle">Top Matching Notes
        <span class="match-count">{len(matches)} match{"es" if len(matches) != 1 else ""}</span>
      </summary>
      <div class="matches">{"".join(match_cards)}</div>
    </details>
  </section>""")

    html_body = "\n".join(sections)
    total_q   = len(groups)
    total_r   = len(enriched)

    html_doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Question Review — Top Note Matches</title>
  <style>
    /* ── Reset & base ── */
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      background: #f4f6fa;
      color: #1a1a2e;
      padding: 24px 16px;
    }}
    a {{ color: #3a7bd5; }}

    /* ── Header ── */
    .page-header {{
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #fff;
      border-radius: 12px;
      padding: 28px 32px;
      margin-bottom: 28px;
    }}
    .page-header h1 {{ font-size: 1.6rem; margin-bottom: 6px; }}
    .page-header p  {{ opacity: 0.75; font-size: 0.9rem; }}
    .stats {{ display: flex; gap: 24px; margin-top: 16px; }}
    .stat-pill {{
      background: rgba(255,255,255,0.12);
      border-radius: 20px;
      padding: 4px 14px;
      font-size: 0.85rem;
    }}

    /* ── Question block ── */
    .question-block {{
      background: #fff;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.07);
      margin-bottom: 24px;
      overflow: hidden;
    }}
    .q-header {{
      background: #16213e;
      color: #fff;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }}
    .q-header h2 {{ font-size: 1rem; font-weight: 700; margin-right: 4px; }}
    .meta-pill {{
      background: rgba(255,255,255,0.18);
      border-radius: 12px;
      padding: 2px 10px;
      font-size: 0.78rem;
    }}
    .meta-pill.chapter {{ background: rgba(58,123,213,0.55); }}

    /* ── Collapsible sections ── */
    details {{ border-top: 1px solid #e8ecf4; }}
    summary.section-toggle {{
      cursor: pointer;
      padding: 10px 20px;
      font-weight: 600;
      font-size: 0.88rem;
      color: #16213e;
      list-style: none;
      display: flex;
      align-items: center;
      gap: 8px;
      user-select: none;
    }}
    summary.section-toggle::before {{ content: "▶"; font-size: 0.7rem; transition: transform .2s; }}
    details[open] > summary.section-toggle::before {{ transform: rotate(90deg); }}
    .match-count {{
      background: #e8ecf4;
      border-radius: 10px;
      padding: 1px 8px;
      font-size: 0.78rem;
      font-weight: 400;
      color: #555;
    }}

    /* ── Text blocks ── */
    .text-block {{
      padding: 14px 24px 18px;
      border-left: 4px solid transparent;
    }}
    .question-text {{ border-left-color: #3a7bd5; background: #f8faff; }}
    .solution-text {{ border-left-color: #27ae60; background: #f5fff8; }}
    .text-block p  {{ margin-bottom: 8px; }}
    .text-block ul {{ padding-left: 20px; margin-bottom: 8px; }}
    .text-block li {{ margin-bottom: 4px; }}
    .text-block h1, .text-block h2, .text-block h3, .text-block h4 {{
      margin: 12px 0 6px;
      color: #16213e;
    }}

    /* ── Match cards ── */
    .matches {{ padding: 12px 20px 16px; display: flex; flex-direction: column; gap: 12px; }}
    .match-card {{
      border-radius: 8px;
      border: 1px solid #e0e6f0;
      overflow: hidden;
    }}
    .match-header {{
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 14px;
      background: #f0f3fa;
      font-size: 0.82rem;
    }}
    .rank {{
      font-weight: 700;
      font-size: 0.9rem;
      color: #16213e;
      min-width: 24px;
    }}
    .folder  {{ font-weight: 600; color: #3a7bd5; }}
    .heading {{ color: #444; }}
    .callout-label {{
      background: #e8f0fe;
      border-radius: 10px;
      padding: 1px 8px;
      color: #2c5fad;
      font-style: italic;
    }}
    .sim-badge {{
      margin-left: auto;
      font-weight: 700;
      border-radius: 10px;
      padding: 2px 10px;
      font-size: 0.8rem;
    }}
    .sim-high .sim-badge {{ background: #d4edda; color: #155724; }}
    .sim-med  .sim-badge {{ background: #fff3cd; color: #856404; }}
    .sim-low  .sim-badge {{ background: #f8d7da; color: #721c24; }}
    .sim-high {{ border-left: 3px solid #27ae60; }}
    .sim-med  {{ border-left: 3px solid #f0ad4e; }}
    .sim-low  {{ border-left: 3px solid #e74c3c; }}
    .note-body {{
      padding: 10px 14px 14px;
      font-size: 0.88rem;
      color: #333;
      background: #fff;
    }}
    .note-body p  {{ margin-bottom: 6px; }}
    .note-body ul {{ padding-left: 18px; margin-bottom: 6px; }}
    .note-body li {{ margin-bottom: 3px; }}
  </style>
</head>
<body>
  <header class="page-header">
    <h1>Question Review — Top Note Matches</h1>
    <p>
      For each exam question: the question asked, the examiner&rsquo;s solution,
      and the top-ranked Obsidian note blocks matched by semantic similarity.
    </p>
    <div class="stats">
      <span class="stat-pill">{total_q} questions</span>
      <span class="stat-pill">{total_r} match rows</span>
    </div>
  </header>
{html_body}
</body>
</html>"""

    out_html = RESULTS / "question_review.html"
    out_html.write_text(html_doc, encoding="utf-8")
    print(f"  Saved {out_html.name} ({total_q} questions, {total_r} match rows)")


if __name__ == "__main__":
    main()
