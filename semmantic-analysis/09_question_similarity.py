"""
Step 9 (standalone): Cross-exam question similarity analysis.

Identifies exam questions from different years/sessions that test the same
content by computing pairwise cosine similarity on the question embeddings
produced in step 3.

Same-exam pairs (same year + session) are always excluded.

Outputs:
  results/question_similarity_clusters.csv   one row per cluster of similar questions
  results/question_similarity_matrix.html    interactive Q x Q heatmap sorted by chapter
  results/question_similarity_pairs.csv      all cross-exam pairs above threshold
  results/question_similarity.html           interactive pairs + per-question HTML report
"""

import csv
import html as html_lib
import json
import os
import re
import shutil
import numpy as np
from pathlib import Path
from collections import defaultdict

RESULTS = Path(__file__).parent / "results"

# NOTE: All questions are from the same actuarial exam subject (F102), so
# raw cosine similarities are elevated across the board (median ~86%).
# 0.90 captures meaningfully similar questions; 0.95+ are near-duplicates.
CLUSTER_THRESHOLD = 0.95   # threshold for clustering / pairs CSV
MATRIX_THRESHOLD  = 0.88   # lower threshold shown in the heatmap colour scale

TOP_K = 10  # max similar questions shown per question in per-question view


# ── helpers ───────────────────────────────────────────────────────────────────

def same_exam(q1: dict, q2: dict) -> bool:
    return q1["year"] == q2["year"] and q1["session"] == q2["session"]


def chapter_str(q: dict) -> str:
    return "; ".join(q.get("chapters") or [])


def extract_question_only(full_text: str) -> str:
    idx = full_text.find("SOLUTION:")
    part = full_text[:idx] if idx != -1 else full_text
    part = re.sub(r'^QUESTION:\s*', '', part.strip())
    return part.strip()


def esc(text: str) -> str:
    return html_lib.escape(str(text))


def safe_write(path: Path, text: str):
    """Write text to path, falling back to *_new.html if target is locked."""
    tmp = path.with_name(path.stem + ".tmp.html")
    tmp.write_text(text, encoding="utf-8")
    try:
        os.replace(str(tmp), str(path))
    except PermissionError:
        alt = path.with_name(path.stem + "_new.html")
        if alt.exists():
            alt.unlink(missing_ok=True)
        shutil.move(str(tmp), str(alt))
        print(f"    (target locked; saved as {alt.name} — close the old file in your browser)")


def sim_badge(score: float) -> str:
    if score >= 0.95:
        colour, label = "#155724", "Near-duplicate"
    elif score >= 0.92:
        colour, label = "#28a745", "Very similar"
    elif score >= 0.90:
        colour, label = "#5cb85c", "Similar"
    else:
        colour, label = "#f0ad4e", "Weak"
    return (
        f'<span class="badge" style="background:{colour}">'
        f'{score:.1%}&nbsp;<small>{label}</small></span>'
    )


# ── clustering (union-find) ───────────────────────────────────────────────────

def build_clusters(n: int, questions: list, sim: np.ndarray, threshold: float):
    """
    For each question, build a 'neighbourhood' row: the question itself plus
    all other cross-exam questions directly above the threshold.

    We then deduplicate: sort each neighbourhood, and drop any neighbourhood
    that is a strict subset of another (keeps the largest group for each
    connected set of questions, without transitive explosion).

    Returns a list of sorted index-lists, each representing one cluster.
    """
    # Step 1: adjacency — which questions is i directly similar to?
    neighbours: list[set] = [set() for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            if same_exam(questions[i], questions[j]):
                continue
            if sim[i, j] >= threshold:
                neighbours[i].add(j)
                neighbours[j].add(i)

    # Step 2: build candidate groups = {i} ∪ neighbours[i] for every i that has neighbours
    candidates = []
    for i in range(n):
        if neighbours[i]:
            group = frozenset({i} | neighbours[i])
            candidates.append(group)

    # Step 3: deduplicate identical groups
    unique = list({g for g in candidates})

    # Step 4: remove groups that are strict subsets of another group
    # (so we keep maximal neighbourhoods only)
    maximal = []
    for g in unique:
        if not any(g < other for other in unique):
            maximal.append(sorted(g))

    # Sort by size desc
    maximal.sort(key=lambda m: -len(m))
    return maximal


# ── CSV outputs ───────────────────────────────────────────────────────────────

def write_clusters_csv(path: Path, clusters: list, questions: list, sim: np.ndarray):
    """One row per cluster of similar questions."""
    rows = []
    for cid, members in enumerate(clusters, 1):
        ids      = [questions[i]["id"]   for i in members]
        years    = sorted(set(questions[i]["year"]    for i in members))
        sessions = sorted(set(questions[i]["session"] for i in members))
        chapters = sorted(set(
            ch
            for i in members
            for ch in (questions[i].get("chapters") or [])
        ))
        scores = [
            float(sim[i, j])
            for idx_i, i in enumerate(members)
            for j in members[idx_i + 1:]
            if not same_exam(questions[i], questions[j])
        ]
        rows.append({
            "cluster_id":     cid,
            "size":           len(members),
            "question_ids":   " | ".join(ids),
            "years":          ", ".join(years),
            "sessions":       ", ".join(sessions),
            "chapters":       "; ".join(chapters),
            "max_similarity": f"{max(scores):.4f}" if scores else "",
            "min_similarity": f"{min(scores):.4f}" if scores else "",
        })

    rows.sort(key=lambda r: (-int(r["size"]), -float(r["max_similarity"] or 0)))

    fieldnames = ["cluster_id", "size", "question_ids", "years", "sessions",
                  "chapters", "max_similarity", "min_similarity"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"  Saved {path.name} ({len(rows)} clusters)")


def write_pairs_csv(path: Path, pairs: list, questions: list):
    fieldnames = [
        "similarity",
        "question_id_1", "year_1", "session_1", "paper_1", "question_1", "chapters_1",
        "question_id_2", "year_2", "session_2", "paper_2", "question_2", "chapters_2",
    ]
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for score, i, j in pairs:
            q1, q2 = questions[i], questions[j]
            writer.writerow({
                "similarity":    f"{score:.4f}",
                "question_id_1": q1["id"],
                "year_1":        q1["year"],
                "session_1":     q1["session"],
                "paper_1":       q1.get("paper", ""),
                "question_1":    q1["question"],
                "chapters_1":    chapter_str(q1),
                "question_id_2": q2["id"],
                "year_2":        q2["year"],
                "session_2":     q2["session"],
                "paper_2":       q2.get("paper", ""),
                "question_2":    q2["question"],
                "chapters_2":    chapter_str(q2),
            })
    print(f"  Saved {path.name} ({len(pairs)} rows)")


# ── Q x Q similarity matrix HTML ──────────────────────────────────────────────

def write_matrix_html(path: Path, questions: list, sim: np.ndarray, threshold: float):
    """Canvas-based heatmap. Questions sorted by (chapter, year, session)."""
    n = len(questions)

    order = sorted(
        range(n),
        key=lambda i: (
            chapter_str(questions[i]),
            questions[i]["year"],
            questions[i]["session"],
            questions[i]["question"],
        )
    )
    qs = [questions[i] for i in order]

    labels   = json.dumps([f"{q['session'][:3]} {q['year']} {q['question']}" for q in qs])
    full_ids = json.dumps([q["id"]             for q in qs])
    chapters = json.dumps([chapter_str(q)      for q in qs])
    texts    = json.dumps([
        esc(extract_question_only(q["text"])[:180]).replace("\n", " ")
        for q in qs
    ])

    # Build compact JS matrix: array of arrays of [score*10000 (int16), same_exam_bit]
    # Stored as flat arrays to keep file size manageable for 281x281
    rows_js = []
    for i in range(n):
        qi = qs[i]
        row = []
        for j in range(n):
            qj = qs[j]
            s    = float(sim[order[i], order[j]])
            same = 1 if same_exam(qi, qj) else 0
            row.append(f"[{s:.4f},{same}]")
        rows_js.append("[" + ",".join(row) + "]")
    matrix_js = "[\n" + ",\n".join(rows_js) + "\n]"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Q\u00d7Q Similarity Matrix \u2014 F102</title>
<style>
  body{{font-family:"Segoe UI",Arial,sans-serif;background:#f5f7fa;color:#1a1a2e;margin:0;}}
  header{{background:#1976d2;color:#fff;padding:13px 26px;}}
  header h1{{font-size:1.25rem;font-weight:600;}}
  header p{{font-size:.8rem;opacity:.85;margin-top:2px;}}
  #ctrl{{display:flex;gap:14px;flex-wrap:wrap;align-items:center;
          padding:10px 18px;background:#fff;border-bottom:1px solid #dde1e7;}}
  #ctrl label{{font-weight:600;font-size:13px;}}
  #ctrl input{{padding:4px 7px;border:1px solid #ccc;border-radius:4px;font-size:12px;}}
  #wrap{{overflow:auto;padding:16px;}}
  canvas{{cursor:crosshair;display:block;}}
  #tip{{position:fixed;background:rgba(0,0,0,.82);color:#fff;padding:7px 11px;
        border-radius:6px;font-size:12px;pointer-events:none;display:none;
        max-width:320px;line-height:1.5;z-index:999;}}
  #leg{{display:flex;gap:10px;flex-wrap:wrap;align-items:center;
        padding:6px 18px;font-size:12px;background:#fff;border-bottom:1px solid #dde1e7;}}
  .lb{{width:16px;height:16px;border-radius:2px;display:inline-block;vertical-align:middle;margin-right:3px;}}
</style>
</head>
<body>
<header>
  <h1>Question \u00d7 Question Similarity Matrix \u2014 F102</h1>
  <p>Questions sorted by chapter then year. Hover a cell for details.</p>
</header>
<div id="ctrl">
  <label>Colour threshold:
    <input type="range" id="th" min="0.85" max="1.00" step="0.005" value="{threshold:.3f}">
    <span id="thv">{threshold:.1%}</span>
  </label>
  <label>Cell size:
    <input type="range" id="cs" min="2" max="18" step="1" value="5">
    <span id="csv">5px</span>
  </label>
</div>
<div id="leg">
  <span class="lb" style="background:#cfe2ff"></span>Same exam&nbsp;
  <span class="lb" style="background:#dee2e6"></span>Below threshold&nbsp;
  <span class="lb" style="background:#f0ad4e"></span>\u226588%&nbsp;
  <span class="lb" style="background:#5cb85c"></span>\u226590% Similar&nbsp;
  <span class="lb" style="background:#28a745"></span>\u226592% Very similar&nbsp;
  <span class="lb" style="background:#155724"></span>\u226595% Near-duplicate&nbsp;
  <span class="lb" style="background:#1976d2"></span>Diagonal
</div>
<div id="wrap"><canvas id="mx"></canvas></div>
<div id="tip"></div>
<script>
const N={n};
const MATRIX={matrix_js};
const LABELS={labels};
const IDS={full_ids};
const CHAPTERS={chapters};
const TEXTS={texts};

function col(s,same,th){{
  if(same) return '#cfe2ff';
  if(s<th) return '#dee2e6';
  if(s>=0.95) return '#155724';
  if(s>=0.92) return '#28a745';
  if(s>=0.90) return '#5cb85c';
  if(s>=0.88) return '#f0ad4e';
  return '#dee2e6';
}}

let CELL=5;
const canvas=document.getElementById('mx'),ctx=canvas.getContext('2d');
const tip=document.getElementById('tip');

function draw(){{
  const th=parseFloat(document.getElementById('th').value);
  canvas.width=N*CELL; canvas.height=N*CELL;
  for(let i=0;i<N;i++){{
    for(let j=0;j<N;j++){{
      const [s,same]=MATRIX[i][j];
      ctx.fillStyle=i===j?'#1976d2':col(s,same===1,th);
      ctx.fillRect(j*CELL,i*CELL,CELL,CELL);
    }}
  }}
}}

document.getElementById('th').addEventListener('input',function(){{
  document.getElementById('thv').textContent=(parseFloat(this.value)*100).toFixed(1)+'%';
  draw();
}});
document.getElementById('cs').addEventListener('input',function(){{
  CELL=parseInt(this.value);
  document.getElementById('csv').textContent=CELL+'px';
  draw();
}});

canvas.addEventListener('mousemove',function(e){{
  const r=canvas.getBoundingClientRect();
  const c=Math.floor((e.clientX-r.left)/CELL),rr=Math.floor((e.clientY-r.top)/CELL);
  if(c<0||c>=N||rr<0||rr>=N){{tip.style.display='none';return;}}
  const [s,same]=MATRIX[rr][c];
  tip.innerHTML=
    '<strong>Row:</strong> '+LABELS[rr]+'<br><em>'+CHAPTERS[rr]+'</em><br>'+
    '<strong>Col:</strong> '+LABELS[c]+'<br><em>'+CHAPTERS[c]+'</em><br>'+
    (rr===c?'<em style="color:#adf">(diagonal)</em>'
           :'<strong>Similarity:</strong> '+(s*100).toFixed(2)+'%'+(same?' <em>(same exam)</em>':''))+
    '<hr style="border-color:#555;margin:4px 0"><span style="font-size:11px">'+TEXTS[c]+'...</span>';
  tip.style.display='block';
  tip.style.left=(e.clientX+14)+'px';
  tip.style.top=(e.clientY+14)+'px';
}});
canvas.addEventListener('mouseleave',function(){{tip.style.display='none';}});
draw();
</script>
</body>
</html>
"""
    safe_write(path, html)
    print(f"  Saved {path.name}")


# ── pairs + per-question HTML ─────────────────────────────────────────────────

def write_pairs_html(path: Path, pairs: list, questions: list, per_question: list):
    years = sorted({q["year"] for q in questions})
    year_opts = "".join(f'<option value="{y}">{y}</option>' for y in years)

    pair_rows = []
    for score, i, j in pairs:
        q1, q2 = questions[i], questions[j]
        t1 = esc(extract_question_only(q1["text"])[:280]).replace("\n", "<br>")
        t2 = esc(extract_question_only(q2["text"])[:280]).replace("\n", "<br>")
        pair_rows.append(
            f'<tr data-score="{score:.4f}" data-y1="{q1["year"]}" data-y2="{q2["year"]}">'
            f'<td class="sc">{sim_badge(score)}</td>'
            f'<td><strong>{esc(q1["id"])}</strong><br><span class="tag">{esc(chapter_str(q1))}</span>'
            f'<div class="qt">{t1}</div></td>'
            f'<td><strong>{esc(q2["id"])}</strong><br><span class="tag">{esc(chapter_str(q2))}</span>'
            f'<div class="qt">{t2}</div></td>'
            f'</tr>'
        )

    accordion = []
    for entry in per_question:
        q = entry["question"]
        qfull = esc(extract_question_only(q["text"])).replace("\n", "<br>")
        match_rows = "".join(
            f'<tr><td>{sim_badge(m["score"])}</td>'
            f'<td><strong>{esc(m["q"]["id"])}</strong> '
            f'<span class="tag">{esc(chapter_str(m["q"]))}</span>'
            f'<div class="qt">{esc(extract_question_only(m["q"]["text"])[:200]).replace(chr(10),"<br>")}</div>'
            f'</td></tr>'
            for m in entry["matches"]
        )
        accordion.append(
            f'<details class="qb"><summary><strong>{esc(q["id"])}</strong>'
            f'&nbsp;<span class="tag">{esc(chapter_str(q))}</span></summary>'
            f'<div class="qbody"><div class="qt full">{qfull}</div>'
            f'<h4>Cross-exam matches \u2265{CLUSTER_THRESHOLD:.0%}</h4>'
            f'<table class="inner"><tr><th>Sim</th><th>Question</th></tr>{match_rows}</table>'
            f'</div></details>'
        )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Cross-Exam Similarity \u2014 F102</title>
<style>
  :root{{--bg:#f5f7fa;--card:#fff;--bd:#dde1e7;--acc:#1976d2;}}
  *{{box-sizing:border-box;margin:0;padding:0;}}
  body{{font-family:"Segoe UI",Arial,sans-serif;background:var(--bg);color:#1a1a2e;font-size:14px;}}
  header{{background:var(--acc);color:#fff;padding:14px 26px;}}
  header h1{{font-size:1.25rem;font-weight:600;}}
  header p{{font-size:.8rem;opacity:.85;margin-top:2px;}}
  main{{max-width:1400px;margin:0 auto;padding:18px;}}
  .stat-bar{{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;}}
  .stat{{background:var(--card);border:1px solid var(--bd);border-radius:6px;padding:9px 16px;flex:1;min-width:120px;text-align:center;}}
  .stat .num{{font-size:1.6rem;font-weight:700;color:var(--acc);}}
  .stat .lbl{{font-size:.75rem;color:#666;}}
  h2{{font-size:1rem;margin:22px 0 9px;color:var(--acc);border-bottom:2px solid var(--bd);padding-bottom:4px;}}
  .ctrl{{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:14px;}}
  .ctrl label{{font-weight:600;font-size:13px;}}
  .ctrl select,.ctrl input{{padding:5px 8px;border:1px solid var(--bd);border-radius:4px;font-size:12px;}}
  table{{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--bd);border-radius:6px;overflow:hidden;}}
  th{{background:#eef2f7;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--bd);}}
  td{{padding:8px 10px;border-bottom:1px solid var(--bd);vertical-align:top;}}
  tr:last-child td{{border-bottom:none;}}
  tr:hover{{background:#f0f5ff;}}
  .sc{{width:115px;text-align:center;}}
  .badge{{display:inline-block;color:#fff;padding:3px 7px;border-radius:10px;font-size:11px;white-space:nowrap;}}
  .qt{{margin-top:4px;color:#444;font-size:12px;line-height:1.5;max-height:100px;overflow:hidden;}}
  .qt.full{{max-height:none;}}
  .tag{{background:#e8f0fe;color:#1565c0;border-radius:3px;padding:1px 5px;font-size:11px;}}
  details.qb{{background:var(--card);border:1px solid var(--bd);border-radius:6px;margin-bottom:6px;}}
  details.qb summary{{cursor:pointer;padding:10px 14px;list-style:none;display:flex;align-items:center;gap:8px;font-size:13px;}}
  details.qb summary::-webkit-details-marker{{display:none;}}
  details.qb summary::before{{content:"\u25b6";font-size:9px;transition:transform .2s;}}
  details[open].qb summary::before{{transform:rotate(90deg);}}
  .qbody{{padding:10px 16px 13px;border-top:1px solid var(--bd);}}
  .qbody h4{{margin:9px 0 5px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#555;}}
  table.inner{{border:none;}}
  table.inner td,table.inner th{{border-bottom:1px solid #eee;font-size:12px;}}
  .hidden{{display:none!important;}}
  #cnt{{font-size:12px;color:#888;}}
</style>
</head>
<body>
<header>
  <h1>Cross-Exam Question Similarity \u2014 F102</h1>
  <p>Questions from different exam sittings testing the same content</p>
</header>
<main>
<div class="stat-bar">
  <div class="stat"><div class="num">{len(pairs)}</div><div class="lbl">Pairs \u2265{CLUSTER_THRESHOLD:.0%}</div></div>
  <div class="stat"><div class="num">{len(per_question)}</div><div class="lbl">Questions with matches</div></div>
  <div class="stat"><div class="num">{len(questions)}</div><div class="lbl">Total questions</div></div>
</div>

<h2>All Similar Pairs</h2>
<div class="ctrl">
  <label>Min similarity:
    <input type="range" id="sl" min="{CLUSTER_THRESHOLD:.2f}" max="1.00" step="0.005"
           value="{CLUSTER_THRESHOLD:.2f}" style="width:140px">
    <span id="slv">{CLUSTER_THRESHOLD:.0%}</span>
  </label>
  <label>Year A: <select id="ya"><option value="">All</option>{year_opts}</select></label>
  <label>Year B: <select id="yb"><option value="">All</option>{year_opts}</select></label>
  <span id="cnt"></span>
</div>
<table id="pt"><thead><tr><th>Similarity</th><th>Question A</th><th>Question B</th></tr></thead>
<tbody>{''.join(pair_rows)}</tbody></table>

<h2>Per-Question View</h2>
{''.join(accordion)}
</main>
<script>
(function(){{
  var sl=document.getElementById('sl'),slv=document.getElementById('slv');
  var ya=document.getElementById('ya'),yb=document.getElementById('yb');
  var cnt=document.getElementById('cnt');
  var rows=document.querySelectorAll('#pt tbody tr');
  function filter(){{
    var th=parseFloat(sl.value),a=ya.value,b=yb.value,vis=0;
    slv.textContent=(th*100).toFixed(1)+'%';
    rows.forEach(function(r){{
      var s=parseFloat(r.dataset.score),y1=r.dataset.y1,y2=r.dataset.y2;
      var ok=s>=th&&(a===''||y1===a||y2===a)&&(b===''||y2===b||y1===b);
      r.classList.toggle('hidden',!ok);
      if(ok)vis++;
    }});
    cnt.textContent=vis+' pair'+(vis!==1?'s':'')+' shown';
  }}
  sl.addEventListener('input',filter);
  ya.addEventListener('change',filter);
  yb.addEventListener('change',filter);
  filter();
}})();
</script>
</body>
</html>
"""
    safe_write(path, html)
    print(f"  Saved {path.name}")


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    for name in ["questions_data.json", "embeddings_questions.npy"]:
        if not (RESULTS / name).exists():
            raise FileNotFoundError(
                f"{name} not found. Run 02_load_questions.py and 03_embed.py first."
            )

    all_questions = json.loads((RESULTS / "questions_data.json").read_text(encoding="utf-8"))
    all_embs      = np.load(RESULTS / "embeddings_questions.npy")
    assert all_embs.shape[0] == len(all_questions)

    # Papergeneral entries are examiner memo/report files, not question papers.
    # They trivially match their Paper1 counterpart (same content) and must be excluded.
    keep_idx  = [i for i, q in enumerate(all_questions) if "papergeneral" not in q["id"].lower()]
    excluded  = len(all_questions) - len(keep_idx)
    questions = [all_questions[i] for i in keep_idx]
    q_embs    = all_embs[keep_idx]

    n = len(questions)
    print(f"Questions loaded: {n}  (excluded {excluded} Papergeneral memo entries)")
    print(f"Embedding shape:  {q_embs.shape}")

    print("Computing question x question similarity matrix...")
    sim = q_embs @ q_embs.T   # (N, N)

    print(f"Extracting pairs with similarity >= {CLUSTER_THRESHOLD:.0%}...")
    pairs = []
    for i in range(n):
        for j in range(i + 1, n):
            if same_exam(questions[i], questions[j]):
                continue
            s = float(sim[i, j])
            if s >= CLUSTER_THRESHOLD:
                pairs.append((s, i, j))
    pairs.sort(key=lambda x: -x[0])
    print(f"  Cross-exam pairs found: {len(pairs)}")

    print("Building clusters (union-find)...")
    clusters = build_clusters(n, questions, sim, CLUSTER_THRESHOLD)
    print(f"  Clusters found: {len(clusters)}")

    write_pairs_csv(RESULTS / "question_similarity_pairs.csv", pairs, questions)
    write_clusters_csv(RESULTS / "question_similarity_clusters.csv", clusters, questions, sim)

    per_question = []
    for i, q in enumerate(questions):
        matches = [
            (float(sim[i, j]), questions[j])
            for j in range(n)
            if j != i and not same_exam(q, questions[j]) and sim[i, j] >= CLUSTER_THRESHOLD
        ]
        matches.sort(key=lambda x: -x[0])
        if matches:
            per_question.append({
                "question": q,
                "matches": [{"score": s, "q": mq} for s, mq in matches[:TOP_K]],
            })

    write_pairs_html(RESULTS / "question_similarity.html", pairs, questions, per_question)
    write_matrix_html(RESULTS / "question_similarity_matrix.html", questions, sim, MATRIX_THRESHOLD)

    print("\nOutputs:")
    print(f"  results/question_similarity_clusters.csv  — {len(clusters)} clusters (all similar Qs in one row)")
    print(f"  results/question_similarity_pairs.csv     — {len(pairs)} pairs")
    print(f"  results/question_similarity.html          — interactive pairs report")
    print(f"  results/question_similarity_matrix.html   — Q x Q heatmap (sorted by chapter)")


if __name__ == "__main__":
    main()
