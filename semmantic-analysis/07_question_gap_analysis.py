"""
Step 7: Questions with the weakest match to any note block.

"Gap" questions are those where even the best-matching note block has a low
cosine similarity — meaning the question topic is poorly covered in the notes.

Metrics per question
--------------------
  top1_sim   : similarity of the single best-matching note block   (primary sort key)
  mean_sim   : mean similarity across ALL 532 note blocks
  coverage   : "gap" / "partial" / "covered" bucket

Outputs
-------
  results/question_gap_analysis.csv    all 281 questions ranked worst→best
  results/question_gap_analysis.html   interactive sortable HTML table
"""

import csv
import json
import textwrap
from pathlib import Path

import numpy as np

RESULTS = Path(__file__).parent / "results"

# Buckets are computed from the actual data distribution (percentiles)
# so the ranking is always meaningful regardless of the absolute similarity range.
# Bottom 25%  = "low coverage"
# 25th–75th % = "medium coverage"
# Top 25%     = "high coverage"
GAP_PCTILE     = 25   # bottom quartile  → "low"
PARTIAL_PCTILE = 75   # top quartile     → "high"


def truncate(text: str, n: int = 120) -> str:
    text = text.replace("\n", " ").strip()
    return text[:n] + "…" if len(text) > n else text


def main():
    for name in ["question_top_matches.json", "questions_data.json", "notes_data.json", "similarity_matrix.npy"]:
        if not (RESULTS / name).exists():
            raise FileNotFoundError(f"{name} not found. Run the pipeline first.")

    top_matches = json.loads((RESULTS / "question_top_matches.json").read_text(encoding="utf-8"))
    questions   = json.loads((RESULTS / "questions_data.json").read_text(encoding="utf-8"))
    notes       = json.loads((RESULTS / "notes_data.json").read_text(encoding="utf-8"))
    sim_matrix  = np.load(str(RESULTS / "similarity_matrix.npy"))   # (N_notes, N_questions)

    # Build a quick lookup: question id → full text + metadata
    q_lookup = {q["id"]: q for q in questions}

    # Identify which note indices are file-level (no callout blocks) vs callout
    file_level_mask = np.array([n.get("chunk_type", "callout") == "file" for n in notes])
    callout_mask    = ~file_level_mask
    n_file_chunks   = int(file_level_mask.sum())
    print(f"  Notes breakdown: {callout_mask.sum()} callout blocks, {n_file_chunks} file-level chunks")

    # Identify file-level chunk names for flagging
    file_level_names = {n["heading"] for n, is_file in zip(notes, file_level_mask) if is_file}
    print(f"  File-level (no callout blocks): {sorted(file_level_names)}")

    # First pass: collect all top1 similarities to compute percentile thresholds
    # Use CALLOUT-ONLY top1 for ranking, so file-level catch-alls don't inflate scores
    callout_sim = sim_matrix[callout_mask, :]    # (N_callout, N_questions)
    all_top1_callout = callout_sim.max(axis=0).tolist()   # best callout match per question
    all_top1_any     = sim_matrix.max(axis=0).tolist()    # best match including file-level

    low_thresh  = float(np.percentile(all_top1_callout, GAP_PCTILE))
    high_thresh = float(np.percentile(all_top1_callout, PARTIAL_PCTILE))
    print(f"  Callout-only top1 range: {min(all_top1_callout):.4f} – {max(all_top1_callout):.4f}")
    print(f"  Overall top1 range:      {min(all_top1_any):.4f} – {max(all_top1_any):.4f}")
    print(f"  Bucket thresholds (p{GAP_PCTILE}/p{PARTIAL_PCTILE}):  low < {low_thresh:.4f}  |  high >= {high_thresh:.4f}")

    rows = []
    for qi, qm in enumerate(top_matches):
        qid = qm["id"]

        # Best overall match (may be file-level)
        top1_any  = qm["top_matches"][0]["similarity"] if qm["top_matches"] else 0.0
        top1_note = qm["top_matches"][0]["note_heading"] if qm["top_matches"] else ""
        top1_callout_hdr = qm["top_matches"][0].get("note_callout") or ""
        top1_folder      = qm["top_matches"][0]["note_folder"] if qm["top_matches"] else ""
        top1_chunk_type  = qm["top_matches"][0].get("chunk_type", "callout") if qm["top_matches"] else "callout"

        # Best callout-only match (excludes file-level chunks)
        top1_callout_sim = float(all_top1_callout[qi])

        # Best callout note label
        callout_scores = sim_matrix[callout_mask, qi]
        best_callout_idx_local = int(np.argmax(callout_scores))
        callout_notes = [n for n, is_c in zip(notes, callout_mask) if is_c]
        best_callout_note = callout_notes[best_callout_idx_local]
        best_callout_label = best_callout_note["heading"]
        if best_callout_note.get("callout_header"):
            best_callout_label += f" — {best_callout_note['callout_header']}"

        mean_sim = float(sim_matrix[:, qi].mean())
        best_is_file = (top1_chunk_type == "file")

        if top1_callout_sim >= high_thresh:
            bucket = "high"
        elif top1_callout_sim >= low_thresh:
            bucket = "medium"
        else:
            bucket = "low"

        q_full = q_lookup.get(qid, {})
        question_text = truncate(q_full.get("question_only", qm.get("question", "")))
        chapters = "; ".join(qm.get("chapters_tagged", []))

        rows.append({
            "rank":               0,
            "question_id":        qid,
            "year":               qm["year"],
            "session":            qm["session"],
            "question":           qm["question"],
            "chapters":           chapters,
            "top1_callout_sim":   top1_callout_sim,   # PRIMARY ranking key
            "top1_any_sim":       top1_any,
            "mean_sim":           mean_sim,
            "coverage":           bucket,
            "best_is_file_chunk": best_is_file,
            "best_note_any":      top1_note,
            "best_callout_header": top1_callout_hdr,
            "best_folder":        top1_folder,
            "best_callout_match": best_callout_label,  # always a callout block
            "question_text":      question_text,
        })

    # Sort: worst callout-coverage first
    rows.sort(key=lambda r: (r["top1_callout_sim"], r["mean_sim"]))
    for i, r in enumerate(rows):
        r["rank"] = i + 1

    # --- CSV ---
    csv_fields = [
        "rank", "question_id", "year", "session", "question", "chapters",
        "top1_callout_sim", "top1_any_sim", "mean_sim", "coverage",
        "best_is_file_chunk", "best_note_any", "best_callout_header",
        "best_folder", "best_callout_match", "question_text",
    ]
    csv_path = RESULTS / "question_gap_analysis.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=csv_fields, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            out = dict(r)
            out["top1_callout_sim"] = f"{r['top1_callout_sim']:.4f}"
            out["top1_any_sim"]     = f"{r['top1_any_sim']:.4f}"
            out["mean_sim"]         = f"{r['mean_sim']:.4f}"
            w.writerow(out)
    print(f"  Saved {csv_path.name} ({len(rows)} rows)")

    # --- Console summary ---
    counts = {"low": 0, "medium": 0, "high": 0}
    for r in rows:
        counts[r["coverage"]] += 1

    n_file_best = sum(1 for r in rows if r["best_is_file_chunk"])
    print(f"\n  Coverage buckets (percentile-based on callout-only top-1 similarity)")
    print(f"    low    (bottom {GAP_PCTILE}th pctile, < {low_thresh:.4f}): {counts['low']:3d} questions")
    print(f"    medium ({GAP_PCTILE}th–{PARTIAL_PCTILE}th pctile):            {counts['medium']:3d} questions")
    print(f"    high   (top {100-PARTIAL_PCTILE}th pctile,   >= {high_thresh:.4f}): {counts['high']:3d} questions")
    print(f"\n  Questions where best overall match is a file-level chunk: {n_file_best}")
    print(f"  (File-level chunks: {sorted(file_level_names)})")

    print("\n=== TOP 30 WEAKEST-COVERED QUESTIONS (callout-only ranking) ===")
    print(f"  {'Rank':>4}  {'ID':<32}  {'c-top1':>6}  {'any-t1':>6}  {'Bucket':<7}  {'F?':2}  {'Best callout match':<45}  Question")
    print(f"  {'-'*4}  {'-'*32}  {'-'*6}  {'-'*6}  {'-'*7}  {'-'*2}  {'-'*45}  {'-'*55}")
    for r in rows[:30]:
        flag = "F" if r["best_is_file_chunk"] else " "
        label = r["best_callout_match"][:45]
        print(
            f"  {r['rank']:>4}  {r['question_id']:<32}  "
            f"{r['top1_callout_sim']:6.3f}  {r['top1_any_sim']:6.3f}  "
            f"{r['coverage']:<7}  {flag:2}  {label:<45}  "
            f"{r['question_text'][:55]}"
        )

    # --- HTML interactive table ---
    _write_html(rows, RESULTS / "question_gap_analysis.html",
                low_thresh=low_thresh, high_thresh=high_thresh,
                gap_pctile=GAP_PCTILE, partial_pctile=PARTIAL_PCTILE,
                file_level_names=file_level_names)
    print(f"\n  Saved question_gap_analysis.html  (open in browser)")


def _write_html(rows, path, low_thresh, high_thresh, gap_pctile, partial_pctile, file_level_names):
    bucket_color = {
        "low":    "#d73027",   # red
        "medium": "#fc8d59",   # orange
        "high":   "#1a9850",   # green
    }

    # Build table rows
    tr_html = []
    for r in rows:
        color = bucket_color[r["coverage"]]
        best_any  = r["best_note_any"]
        if r["best_callout_header"]:
            best_any += f" — {r['best_callout_header']}"
        best_callout = r["best_callout_match"]
        file_badge = '<span style="background:#c0392b;color:white;border-radius:3px;padding:1px 4px;font-size:10px" title="Best overall match is a file-level chunk (no callout blocks)">FILE</span>' if r["best_is_file_chunk"] else ''
        qtext        = r["question_text"].replace("<", "&lt;").replace(">", "&gt;")
        best_any_esc = best_any.replace("<", "&lt;").replace(">", "&gt;")
        best_cal_esc = best_callout.replace("<", "&lt;").replace(">", "&gt;")
        tr_html.append(
            f'<tr class="bkt-{r["coverage"]}">'
            f'<td>{r["rank"]}</td>'
            f'<td>{r["question_id"]}</td>'
            f'<td>{r["year"]}</td>'
            f'<td>{r["session"][:3]}</td>'
            f'<td>{r["question"]}</td>'
            f'<td>{r["chapters"]}</td>'
            f'<td style="color:{color};font-weight:bold">{r["top1_callout_sim"]:.4f}</td>'
            f'<td>{r["top1_any_sim"]:.4f} {file_badge}</td>'
            f'<td>{r["mean_sim"]:.4f}</td>'
            f'<td style="background:{color};color:white;text-align:center;border-radius:4px;padding:2px 6px">{r["coverage"]}</td>'
            f'<td title="{best_cal_esc}">{best_cal_esc[:55]}{"…" if len(best_cal_esc)>55 else ""}</td>'
            f'<td title="{best_any_esc}">{best_any_esc[:50]}{"…" if len(best_any_esc)>50 else ""} {file_badge}</td>'
            f'<td title="{qtext}">{qtext[:75]}{"…" if len(qtext)>75 else ""}</td>'
            f'</tr>'
        )

    counts = {"low": sum(1 for r in rows if r["coverage"]=="low"),
              "medium": sum(1 for r in rows if r["coverage"]=="medium"),
              "high": sum(1 for r in rows if r["coverage"]=="high")}

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>F102 Question Gap Analysis</title>
<style>
  body {{ font-family: Arial, sans-serif; font-size: 13px; margin: 20px; background: #f8f8f8; }}
  h1 {{ font-size: 18px; margin-bottom: 4px; }}
  .subtitle {{ color: #555; font-size: 12px; margin-bottom: 16px; }}
  .summary {{ display:flex; gap:20px; margin-bottom:16px; }}
  .chip {{ padding: 6px 14px; border-radius: 20px; color:white; font-weight:bold; font-size:13px; }}
  .low-chip    {{ background: #d73027; }}
  .medium-chip {{ background: #fc8d59; }}
  .high-chip   {{ background: #1a9850; }}
  .filters {{ margin-bottom: 12px; }}
  .filters label {{ margin-right: 16px; cursor:pointer; }}
  input[type=text] {{ padding:5px 10px; border:1px solid #ccc; border-radius:4px; width:300px; }}
  table {{ border-collapse: collapse; width: 100%; background: white; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }}
  th {{ background: #2c3e50; color: white; padding: 8px 10px; text-align: left; cursor: pointer; user-select:none; white-space:nowrap; }}
  th:hover {{ background: #3d5166; }}
  td {{ padding: 6px 10px; border-bottom: 1px solid #eee; vertical-align: top; }}
  tr:hover td {{ background: #f0f4f8; }}
  tr.hidden {{ display: none; }}
  .sort-asc::after  {{ content: " ▲"; font-size:10px; }}
  .sort-desc::after {{ content: " ▼"; font-size:10px; }}
</style>
</head>
<body>
<h1>F102 — Question Gap Analysis</h1>
<p class="subtitle">
  Questions ranked by weakest match to callout blocks only (file-level catch-all chunks excluded from ranking).<br>
  Buckets: low = bottom {gap_pctile}th pctile (callout top1 &lt; {low_thresh:.4f}) |
  medium = {gap_pctile}th\u2013{partial_pctile}th pctile | high = top {100-partial_pctile}th pctile (\u2265 {high_thresh:.4f})<br>
  <b>FILE</b> badge = best overall match was a file-level chunk (no callout blocks): {', '.join(sorted(file_level_names))}
</p>
<div class="summary">
  <span class="chip low-chip">&#9679; Low coverage: {counts['low']}</span>
  <span class="chip medium-chip">&#9679; Medium coverage: {counts['medium']}</span>
  <span class="chip high-chip">&#9679; High coverage: {counts['high']}</span>
</div>
<div class="filters">
  <strong>Filter:</strong>
  <label><input type="checkbox" class="bkt-filter" value="low"    checked> Low</label>
  <label><input type="checkbox" class="bkt-filter" value="medium" checked> Medium</label>
  <label><input type="checkbox" class="bkt-filter" value="high"   checked> High</label>
  &nbsp;&nbsp;
  <input type="text" id="qsearch" placeholder="Search question text or ID…">
</div>
<table id="main-table">
<thead>
<tr>
  <th onclick="sortTable(0)">Rank</th>
  <th onclick="sortTable(1)">ID</th>
  <th onclick="sortTable(2)">Year</th>
  <th onclick="sortTable(3)">Session</th>
  <th onclick="sortTable(4)">Q#</th>
  <th onclick="sortTable(5)">Chapters tagged</th>
  <th onclick="sortTable(6)">Callout top-1 ↑</th>
  <th onclick="sortTable(7)">Any top-1</th>
  <th onclick="sortTable(8)">Mean sim</th>
  <th onclick="sortTable(9)">Coverage</th>
  <th onclick="sortTable(10)">Best callout match</th>
  <th onclick="sortTable(11)">Best overall match</th>
  <th onclick="sortTable(12)">Question (truncated)</th>
</tr>
</thead>
<tbody>
{''.join(tr_html)}
</tbody>
</table>

<script>
// Sort
let sortCol = 0, sortDir = 1;
function sortTable(col) {{
  const tbody = document.querySelector('#main-table tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  if (sortCol === col) sortDir = -sortDir; else {{ sortCol = col; sortDir = 1; }}
  rows.sort((a, b) => {{
    const av = a.cells[col].textContent.trim();
    const bv = b.cells[col].textContent.trim();
    const an = parseFloat(av), bn = parseFloat(bv);
    if (!isNaN(an) && !isNaN(bn)) return sortDir * (an - bn);
    return sortDir * av.localeCompare(bv);
  }});
  rows.forEach(r => tbody.appendChild(r));
  document.querySelectorAll('th').forEach((th, i) => {{
    th.classList.remove('sort-asc','sort-desc');
    if (i === col) th.classList.add(sortDir===1 ? 'sort-asc' : 'sort-desc');
  }});
}}

// Filter by bucket
function applyFilters() {{
  const checked = new Set(Array.from(document.querySelectorAll('.bkt-filter:checked')).map(c => c.value));
  const search  = document.getElementById('qsearch').value.toLowerCase();
  document.querySelectorAll('#main-table tbody tr').forEach(tr => {{
    const bkt = tr.className.replace('bkt-','');
    const txt = tr.textContent.toLowerCase();
    tr.classList.toggle('hidden', !checked.has(bkt) || (search && !txt.includes(search)));
  }});
}}
document.querySelectorAll('.bkt-filter').forEach(c => c.addEventListener('change', applyFilters));
document.getElementById('qsearch').addEventListener('input', applyFilters);
</script>
</body>
</html>"""

    path.write_text(html, encoding="utf-8")


if __name__ == "__main__":
    main()
