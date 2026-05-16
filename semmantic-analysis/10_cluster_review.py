"""
Step 10 (standalone): Enrich similarity clusters with full question text + memo.

Reads question_similarity_clusters.csv and questions_data.json and produces
an interactive HTML report where each cluster is expandable and shows every
question with its full question text and examiner memo/solution.

Smaller clusters = tighter, more specific content matches. Use the size
filter to focus on clusters of 2-10 for the most actionable insights.

Output:
  results/cluster_review.html
"""

import csv
import html as html_lib
import json
import os
import re
import shutil
from pathlib import Path

RESULTS = Path(__file__).parent / "results"


# ── helpers ───────────────────────────────────────────────────────────────────

def esc(text: str) -> str:
    return html_lib.escape(str(text))


def extract_question(full_text: str) -> str:
    idx = full_text.find("SOLUTION:")
    part = full_text[:idx] if idx != -1 else full_text
    part = re.sub(r'^QUESTION:\s*', '', part.strip())
    return part.strip()


def extract_solution(full_text: str) -> str:
    idx = full_text.find("SOLUTION:")
    if idx == -1:
        return ""
    return full_text[idx + len("SOLUTION:"):].strip()


def md_to_html(text: str) -> str:
    """Lightweight Markdown -> HTML for display in the report."""
    lines = text.splitlines()
    out = []
    in_ul = False
    for line in lines:
        hm = re.match(r'^(#{1,4})\s+(.*)', line)
        if hm:
            if in_ul:
                out.append("</ul>")
                in_ul = False
            level = min(len(hm.group(1)) + 2, 6)  # h3-h6
            out.append(f"<h{level}>{_inline(hm.group(2))}</h{level}>")
            continue
        bm = re.match(r'^[\-\*]\s+(.*)', line)
        if bm:
            if not in_ul:
                out.append("<ul>")
                in_ul = True
            out.append(f"<li>{_inline(bm.group(1))}</li>")
            continue
        if in_ul:
            out.append("</ul>")
            in_ul = False
        s = line.strip()
        if s == "":
            out.append("<br>")
        else:
            out.append(f"<p>{_inline(s)}</p>")
    if in_ul:
        out.append("</ul>")
    return "\n".join(out)


def _inline(text: str) -> str:
    text = html_lib.escape(text)
    text = re.sub(r'\*\*\*(.+?)\*\*\*', r'<strong><em>\1</em></strong>', text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
    text = re.sub(r'`(.+?)`', r'<code>\1</code>', text)
    return text


def safe_write(path: Path, text: str):
    tmp = path.with_name(path.stem + ".tmp.html")
    tmp.write_text(text, encoding="utf-8")
    try:
        os.replace(str(tmp), str(path))
    except PermissionError:
        alt = path.with_name(path.stem + "_new.html")
        alt.unlink(missing_ok=True)
        shutil.move(str(tmp), str(alt))
        print(f"    (target locked; saved as {alt.name})")


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    for name in ["question_similarity_clusters.csv", "questions_data.json"]:
        if not (RESULTS / name).exists():
            raise FileNotFoundError(f"{name} not found. Run 09_question_similarity.py first.")

    questions = json.loads((RESULTS / "questions_data.json").read_text(encoding="utf-8"))
    q_index = {q["id"]: q for q in questions}

    with open(RESULTS / "question_similarity_clusters.csv", newline="", encoding="utf-8") as f:
        clusters = list(csv.DictReader(f))

    print(f"Clusters loaded: {len(clusters)}")
    print(f"Questions indexed: {len(q_index)}")

    # Sort smallest first (tightest matches most useful) but keep original cluster_id label
    clusters_sorted = sorted(clusters, key=lambda r: int(r["size"]))

    # Collect all distinct years and chapters for filter dropdowns
    all_years    = sorted({y.strip() for c in clusters for y in c["years"].split(",")})
    all_chapters = sorted({ch.strip() for c in clusters for ch in c["chapters"].split(";") if ch.strip()})

    # ── Build cluster HTML blocks ─────────────────────────────────────────────
    cluster_blocks = []
    for row in clusters_sorted:
        cid      = row["cluster_id"]
        size     = int(row["size"])
        ids      = [qid.strip() for qid in row["question_ids"].split("|")]
        years    = row["years"].strip()
        sessions = row["sessions"].strip()
        chapters = row["chapters"].strip()
        max_sim  = float(row["max_similarity"]) if row["max_similarity"] else 0
        min_sim  = float(row["min_similarity"]) if row["min_similarity"] else 0
        yr_list  = [y.strip() for y in years.split(",")]

        # Badge colour based on max similarity
        if max_sim >= 0.95:
            badge_col = "#155724"
            badge_lbl = "Near-duplicate"
        elif max_sim >= 0.92:
            badge_col = "#28a745"
            badge_lbl = "Very similar"
        else:
            badge_col = "#5cb85c"
            badge_lbl = "Similar"

        # Build individual question cards inside this cluster
        q_cards = []
        for qid in ids:
            q = q_index.get(qid)
            if q is None:
                q_cards.append(
                    f'<div class="qcard missing"><strong>{esc(qid)}</strong>'
                    f'<p><em>Question data not found.</em></p></div>'
                )
                continue

            chapters_q = "; ".join(q.get("chapters") or [])
            q_text_md  = extract_question(q.get("text", ""))
            sol_md     = extract_solution(q.get("text", ""))
            q_html     = md_to_html(q_text_md)
            sol_html   = md_to_html(sol_md) if sol_md else "<em>No solution available.</em>"

            q_cards.append(f"""
<details class="qcard">
  <summary>
    <span class="qid">{esc(qid)}</span>
    <span class="qtag">{esc(chapters_q)}</span>
    <span class="qtime">{esc(q.get('time_minutes', '') or '')} min</span>
  </summary>
  <div class="qcard-body">
    <div class="panel question-panel">
      <div class="panel-label">QUESTION</div>
      <div class="panel-content">{q_html}</div>
    </div>
    <div class="panel solution-panel">
      <div class="panel-label">MEMO / SOLUTION</div>
      <div class="panel-content">{sol_html}</div>
    </div>
  </div>
</details>""")

        yr_data = " ".join(yr_list)
        ch_data = chapters.lower()

        cluster_blocks.append(f"""
<details class="cluster" data-size="{size}" data-years="{yr_data}" data-chapters="{ch_data.lower()}">
  <summary>
    <span class="c-id">Cluster {esc(cid)}</span>
    <span class="c-size">{size} questions</span>
    <span class="c-sim badge" style="background:{badge_col}">{max_sim:.1%} max&nbsp;<small>{badge_lbl}</small></span>
    <span class="c-years">{esc(years)}</span>
    <span class="c-chapters">{esc(chapters[:80])}{'…' if len(chapters) > 80 else ''}</span>
  </summary>
  <div class="cluster-body">
    <div class="cluster-meta">
      <strong>Similarity range:</strong> {min_sim:.1%} – {max_sim:.1%} &nbsp;|&nbsp;
      <strong>Sessions:</strong> {esc(sessions)} &nbsp;|&nbsp;
      <strong>All chapters:</strong> {esc(chapters)}
    </div>
    {''.join(q_cards)}
  </div>
</details>""")

    year_opts    = "".join(f'<option value="{y}">{y}</option>' for y in all_years)
    chapter_opts = "".join(f'<option value="{c.lower()}">{esc(c)}</option>' for c in all_chapters)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Cluster Review \u2014 F102</title>
<style>
  :root{{--bg:#f5f7fa;--card:#fff;--bd:#dde1e7;--acc:#1565c0;--q:#e8f4fd;--s:#fdf6e3;}}
  *{{box-sizing:border-box;margin:0;padding:0;}}
  body{{font-family:"Segoe UI",Arial,sans-serif;background:var(--bg);color:#1a1a2e;font-size:14px;line-height:1.55;}}
  header{{background:var(--acc);color:#fff;padding:14px 26px;}}
  header h1{{font-size:1.3rem;font-weight:600;}}
  header p{{font-size:.82rem;opacity:.85;margin-top:3px;}}
  #ctrl{{display:flex;gap:12px;flex-wrap:wrap;align-items:center;
          padding:10px 18px;background:#fff;border-bottom:1px solid var(--bd);
          position:sticky;top:0;z-index:50;}}
  #ctrl label{{font-weight:600;font-size:12px;}}
  #ctrl select,#ctrl input{{padding:4px 7px;border:1px solid var(--bd);border-radius:4px;font-size:12px;}}
  #ctrl button{{padding:5px 12px;background:var(--acc);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;}}
  #cnt{{font-size:12px;color:#888;margin-left:auto;}}
  main{{max-width:1300px;margin:0 auto;padding:16px;}}
  .stat-bar{{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;}}
  .stat{{background:var(--card);border:1px solid var(--bd);border-radius:6px;padding:8px 14px;flex:1;min-width:110px;text-align:center;}}
  .stat .num{{font-size:1.5rem;font-weight:700;color:var(--acc);}}
  .stat .lbl{{font-size:.73rem;color:#666;}}

  /* Cluster block */
  details.cluster{{background:var(--card);border:1px solid var(--bd);border-radius:8px;
                   margin-bottom:10px;overflow:hidden;}}
  details.cluster>summary{{cursor:pointer;list-style:none;display:flex;align-items:center;
    gap:10px;padding:11px 16px;flex-wrap:wrap;}}
  details.cluster>summary::-webkit-details-marker{{display:none;}}
  details.cluster>summary::before{{content:"\u25b6";font-size:9px;flex-shrink:0;transition:transform .2s;}}
  details[open].cluster>summary::before{{transform:rotate(90deg);}}
  .c-id{{font-weight:700;font-size:13px;flex-shrink:0;min-width:80px;}}
  .c-size{{background:#e8f0fe;color:#1565c0;border-radius:10px;padding:2px 8px;font-size:11px;flex-shrink:0;}}
  .c-sim{{color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;flex-shrink:0;}}
  .c-years{{font-size:11px;color:#555;flex-shrink:0;}}
  .c-chapters{{font-size:11px;color:#777;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}}
  .badge{{display:inline-block;}}
  .cluster-body{{padding:10px 16px 14px;border-top:1px solid var(--bd);}}
  .cluster-meta{{font-size:12px;color:#555;margin-bottom:10px;padding:6px 10px;
                 background:#f8f9fa;border-radius:4px;border-left:3px solid var(--acc);}}

  /* Question card */
  details.qcard{{background:#fafbfc;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:7px;}}
  details.qcard>summary{{cursor:pointer;list-style:none;display:flex;align-items:center;
    gap:9px;padding:9px 13px;flex-wrap:wrap;}}
  details.qcard>summary::-webkit-details-marker{{display:none;}}
  details.qcard>summary::before{{content:"\u25b6";font-size:8px;flex-shrink:0;transition:transform .2s;color:#999;}}
  details[open].qcard>summary::before{{transform:rotate(90deg);}}
  .qid{{font-weight:700;font-size:12px;color:var(--acc);flex-shrink:0;}}
  .qtag{{background:#e8f0fe;color:#1565c0;border-radius:3px;padding:1px 6px;font-size:11px;}}
  .qtime{{font-size:11px;color:#999;margin-left:auto;}}
  .qcard-body{{display:grid;grid-template-columns:1fr 1fr;gap:0;border-top:1px solid #e2e8f0;}}
  @media(max-width:900px){{.qcard-body{{grid-template-columns:1fr;}}}}
  .panel{{padding:12px 14px;}}
  .question-panel{{background:var(--q);border-right:1px solid #b6d9f5;}}
  .solution-panel{{background:var(--s);}}
  .panel-label{{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;
                color:#777;margin-bottom:8px;}}
  .panel-content{{font-size:13px;}}
  .panel-content h3,.panel-content h4,.panel-content h5,.panel-content h6{{
    font-size:13px;font-weight:700;margin:8px 0 4px;color:#333;}}
  .panel-content p{{margin:4px 0;}}
  .panel-content ul{{padding-left:18px;margin:4px 0;}}
  .panel-content li{{margin:2px 0;}}
  .panel-content code{{background:#e8e8e8;padding:1px 4px;border-radius:3px;font-size:12px;}}
  .qcard.missing{{padding:10px 14px;background:#fff3f3;border-left:3px solid #dc3545;}}
  .hidden{{display:none!important;}}
</style>
</head>
<body>
<header>
  <h1>Cluster Review \u2014 F102 Cross-Exam Similarity</h1>
  <p>Each cluster groups questions from different exam years that test the same content. Sorted by size (smallest = tightest match).</p>
</header>

<div id="ctrl">
  <label>Max cluster size: <input type="number" id="max-size" value="20" min="2" max="999" style="width:60px"></label>
  <label>Min cluster size: <input type="number" id="min-size" value="2"  min="2" max="999" style="width:60px"></label>
  <label>Year: <select id="yr-filter"><option value="">All</option>{year_opts}</select></label>
  <label>Chapter: <select id="ch-filter"><option value="">All</option>{chapter_opts}</select></label>
  <button id="apply-btn">Apply</button>
  <button id="expand-btn">Expand all</button>
  <button id="collapse-btn">Collapse all</button>
  <span id="cnt"></span>
</div>

<main>
<div class="stat-bar">
  <div class="stat"><div class="num">{len(clusters)}</div><div class="lbl">Total clusters</div></div>
  <div class="stat"><div class="num">{sum(int(c['size']) for c in clusters)}</div><div class="lbl">Total question slots</div></div>
  <div class="stat"><div class="num">{len(questions)}</div><div class="lbl">Questions in corpus</div></div>
  <div class="stat"><div class="num">90%</div><div class="lbl">Similarity threshold</div></div>
</div>

{''.join(cluster_blocks)}
</main>

<script>
(function(){{
  var all = Array.from(document.querySelectorAll('details.cluster'));

  function applyFilters(){{
    var maxSz  = parseInt(document.getElementById('max-size').value) || 999;
    var minSz  = parseInt(document.getElementById('min-size').value) || 2;
    var yr     = document.getElementById('yr-filter').value;
    var ch     = document.getElementById('ch-filter').value.toLowerCase();
    var vis    = 0;
    all.forEach(function(el){{
      var sz    = parseInt(el.dataset.size);
      var years = el.dataset.years || '';
      var chs   = el.dataset.chapters || '';
      var ok    = sz >= minSz && sz <= maxSz
                  && (yr === '' || years.indexOf(yr) !== -1)
                  && (ch === '' || chs.indexOf(ch) !== -1);
      el.classList.toggle('hidden', !ok);
      if(ok) vis++;
    }});
    document.getElementById('cnt').textContent = vis + ' cluster' + (vis!==1?'s':'') + ' shown';
  }}

  document.getElementById('apply-btn').addEventListener('click', applyFilters);
  document.getElementById('expand-btn').addEventListener('click', function(){{
    all.forEach(function(el){{ if(!el.classList.contains('hidden')) el.open=true; }});
  }});
  document.getElementById('collapse-btn').addEventListener('click', function(){{
    all.forEach(function(el){{ el.open=false; }});
  }});

  // Also filter on Enter key in number inputs
  ['max-size','min-size'].forEach(function(id){{
    document.getElementById(id).addEventListener('keydown', function(e){{
      if(e.key==='Enter') applyFilters();
    }});
  }});

  applyFilters();
}})();
</script>
</body>
</html>
"""

    out = RESULTS / "cluster_review.html"
    safe_write(out, html)
    print(f"  Saved {out.name}")
    print("\nTip: Set 'Max cluster size' to 10 to focus on the tightest question matches.")


if __name__ == "__main__":
    main()
