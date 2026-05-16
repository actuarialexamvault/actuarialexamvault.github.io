"""
Step 11: Topic frequency — how many distinct exam questions test each topic?

Assignment strategy (three-pass hybrid)
----------------------------------------

Pass 1 — TAGGED questions (chapters field non-empty, typically 2010-2019):
  Use the exam institute's own chapter tags as ground truth (100% reliable).

Pass 2 — UNTAGGED questions without a cluster sibling (embedding inference):
  Two-gate approach to suppress actuarial-terminology false positives:
    Gate 1 — z-score: folder score must be > mean + Z_THRESH * std across all folders.
    Gate 2 — margin:  folder must beat 2nd-best by at least MARGIN_THRESH.
  "4. External environment" faces a stricter margin gate (EXT_ENV_MARGIN) because
  its notes use broad business language present in every question preamble.

Pass 3 — CLUSTER PROPAGATION for low/unassigned questions:
  Questions that failed both embedding gates often belong to a similarity cluster
  (cosine >= 0.95) with other questions that DID receive confident assignments.
  These "cluster siblings" test essentially the same content, so the unassigned
  question inherits their folder assignments (method="cluster_propagated").
  This also surfaces genuine multi-topic questions: if cluster siblings disagree
  on folder, all folders are included and a conflict flag is set — these are
  genuinely cross-topic questions that the examiners recycle across subject areas.

Calibration evidence (from calibrate_check.py on 149 tagged questions):
  margin >= 0.025 -> precision 80%, coverage 34%
  margin >= 0.050 -> precision 100%, coverage 12%

Outputs
-------
  results/topic_frequency.csv       one row per topic folder
  results/topic_frequency.html      interactive sortable HTML priority table
  results/question_assignments.csv  one row per (question, folder) assignment
                                    with method, confidence, cluster_id flags
"""

import json
import csv
import math
from pathlib import Path
from collections import defaultdict

import numpy as np

RESULTS = Path(__file__).parent / "results"

# --- Tuning parameters (calibrated from calibrate_check.py) ---
Z_THRESH        = 1.5    # z-score gate: folder score must be > mean + Z * std
MARGIN_THRESH   = 0.020  # margin gate: folder must beat 2nd-best by this much
EXT_ENV_MARGIN  = 0.040  # stricter margin for "4. External environment" catch-all

# Recency weight: questions from the last N years count more.
# weight(year) = RECENCY_BASE ^ (current_year - year)
CURRENT_YEAR  = 2026
RECENCY_BASE  = 0.90     # 10% decay per year

CHAPTER_TAG_TO_FOLDER = {
    "Monitoring Experience":                        "20. Monitoring experience",
    "With-profits surplus distribution":            "3. Asset shares and profit distribution",
    "Asset Share":                                  "3. Asset shares and profit distribution",
    "Risk":                                         "5. Risks",
    "The general business environment":             "4. External environment",
    "Investments":                                  "18. Investments",
    "Unit Pricing":                                 "6. Unit pricing and actuarial funding",
    "Actuarial Funding":                            "6. Unit pricing and actuarial funding",
    "Assumptions":                                  "9. Assumptions",
    "Cost of guarantees and options":               "14. Guarantees and options",
    "Product Design":                               "8. Product design",
    "Reinsurance":                                  "16. Reinsurance",
    "Supervisory Reserves and Capital Requirements": "10. Reserving",
    "Surrender Values":                             "12. Surrender values",
    "Alterations":                                  "13. Alterations",
    "Underwriting":                                 "17. Underwriting & data checks",
    "Policy Data Checks":                           "17. Underwriting & data checks",
    "Income Protection":                            "2. Health and care products",
    "Critical Illness":                             "2. Health and care products",
    "Long-term Care Insurance":                     "2. Health and care products",
    "Pricing health care products":                 "15. Pricing health & care contracts",
    "Life Insurance Products":                      "1. Life insurance contracts",
    "Modelling":                                    "7. Modelling",
    "Further Risk Management":                      "19. Further risk management",
}

EXT_ENV_FOLDER = "4. External environment"


def get_chapter_tags(q: dict) -> list:
    raw = q.get("chapters") or []
    if isinstance(raw, str):
        return [t.strip() for t in raw.split(";") if t.strip()]
    return list(raw)


def recency_weight(year: int) -> float:
    return RECENCY_BASE ** max(0, CURRENT_YEAR - year)


def infer_folders_embedding(qi: int, sim: np.ndarray, folder_to_idxs: dict) -> list[dict]:
    """
    Return list of {folder, score, margin, z_score, passed} for this question.
    Uses the two-gate approach for untagged questions.
    """
    folder_scores = {
        folder: float(sim[np.array(idxs), qi].max())
        for folder, idxs in folder_to_idxs.items()
    }
    scores_arr = np.array(list(folder_scores.values()))
    mu = scores_arr.mean()
    sigma = scores_arr.std()

    ranked = sorted(folder_scores.items(), key=lambda x: -x[1])
    results = []
    for rank, (folder, score) in enumerate(ranked):
        z = (score - mu) / sigma if sigma > 0 else 0.0
        # margin against next-best (0 if this is not the top-ranked for this folder pair)
        # Use margin vs the best score that ISN'T this folder
        other_scores = [s for f, s in ranked if f != folder]
        best_other = max(other_scores) if other_scores else 0.0
        margin = score - best_other

        # Gate 1: z-score
        passes_z = z >= Z_THRESH
        # Gate 2: margin (stricter for external environment)
        min_margin = EXT_ENV_MARGIN if folder == EXT_ENV_FOLDER else MARGIN_THRESH
        passes_margin = margin >= min_margin
        passed = passes_z and passes_margin

        results.append({
            "folder": folder,
            "score": score,
            "z_score": z,
            "margin": margin,
            "passed": passed,
        })

    return results


def load_clusters() -> dict:
    """
    Returns: {qid: set_of_cluster_ids}  (a question can belong to multiple clusters
    because clusters overlap at sim >= 0.95)
    """
    path = RESULTS / "question_similarity_clusters.csv"
    if not path.exists():
        print("  WARNING: question_similarity_clusters.csv not found — cluster propagation skipped")
        return {}
    qid_to_clusters = defaultdict(set)
    cluster_members = {}   # cluster_id -> list[qid]
    with path.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            cid = row["cluster_id"]
            members = [q.strip() for q in row["question_ids"].split("|")]
            cluster_members[cid] = members
            for qid in members:
                qid_to_clusters[qid].add(cid)
    return qid_to_clusters, cluster_members


def main():
    # --- Load data ---
    notes = json.loads((RESULTS / "notes_data.json").read_text(encoding="utf-8"))
    questions = json.loads((RESULTS / "questions_data.json").read_text(encoding="utf-8"))
    sim = np.load(RESULTS / "similarity_matrix.npy")  # (N_notes, N_questions)

    print(f"Notes: {len(notes)} | Questions: {len(questions)} | Sim: {sim.shape}")

    # --- Load cluster data ---
    qid_to_clusters, cluster_members = load_clusters()
    print(f"Clusters loaded: {len(cluster_members)} clusters covering {len(qid_to_clusters)} questions")

    # Build folder index
    folder_to_idxs = defaultdict(list)
    for i, n in enumerate(notes):
        folder_to_idxs[n["folder"]].append(i)

    all_folders = sorted(folder_to_idxs.keys())

    # --- Assign each question to topic folder(s) ---
    # Each assignment row also carries cluster_id and cluster_conflict for transparency.
    assignments = []
    n_tagged = 0
    n_inferred = 0
    n_unassigned = 0

    # q_meta lookup for cluster propagation pass
    q_meta = {q["id"]: q for q in questions}

    for qi, q in enumerate(questions):
        qid = q["id"]
        year = int(q.get("year", 0))
        session = q.get("session", "")
        marks = float(q.get("time_minutes") or 0)
        tags = get_chapter_tags(q)

        if tags:
            # Ground-truth assignment from chapter tags
            n_tagged += 1
            mapped_folders = list({CHAPTER_TAG_TO_FOLDER[t] for t in tags if t in CHAPTER_TAG_TO_FOLDER})
            if not mapped_folders:
                # Tags exist but none map — treat as untagged
                mapped_folders = []

            cluster_ids_str = ",".join(sorted(qid_to_clusters.get(qid, set())))
            for folder in mapped_folders:
                assignments.append({
                    "question_id": qid,
                    "year": year,
                    "session": session,
                    "marks": marks,
                    "folder": folder,
                    "method": "tagged",
                    "confidence": "high",
                    "score": None,
                    "z_score": None,
                    "margin": None,
                    "cluster_ids": cluster_ids_str,
                    "cluster_conflict": "",
                })
        else:
            # Embedding-based inference
            inferences = infer_folders_embedding(qi, sim, folder_to_idxs)
            passed = [r for r in inferences if r["passed"]]

            cluster_ids_str = ",".join(sorted(qid_to_clusters.get(qid, set())))
            if passed:
                n_inferred += 1
                for r in passed:
                    assignments.append({
                        "question_id": qid,
                        "year": year,
                        "session": session,
                        "marks": marks,
                        "folder": r["folder"],
                        "method": "inferred",
                        "confidence": "medium",
                        "score": round(r["score"], 4),
                        "z_score": round(r["z_score"], 3),
                        "margin": round(r["margin"], 4),
                        "cluster_ids": cluster_ids_str,
                        "cluster_conflict": "",
                    })
            else:
                # No folder passed both gates — assign top-1 but flag as low confidence
                n_unassigned += 1
                top = sorted(inferences, key=lambda x: -x["score"])[0]
                assignments.append({
                    "question_id": qid,
                    "year": year,
                    "session": session,
                    "marks": marks,
                    "folder": top["folder"],
                    "method": "inferred_low_conf",
                    "confidence": "low",
                    "score": round(top["score"], 4),
                    "z_score": round(top["z_score"], 3),
                    "margin": round(top["margin"], 4),
                    "cluster_ids": cluster_ids_str,
                    "cluster_conflict": "",
                })

    print(f"Pass 1+2 breakdown: {n_tagged} tagged | {n_inferred} inferred (high-conf) | {n_unassigned} inferred (low-conf)")

    # --- Pass 3: Cluster propagation ---
    # Build index of current high/medium assignments: qid -> set of folders
    current_confident = defaultdict(set)   # qid -> {folder, ...}
    for a in assignments:
        if a["confidence"] in ("high", "medium"):
            current_confident[a["question_id"]].add(a["folder"])

    # Find low-confidence questions that have at least one high/medium cluster sibling
    low_conf_qids = {a["question_id"] for a in assignments if a["confidence"] == "low"}
    n_propagated = 0
    propagated_assignments = []   # new rows to add

    for qid in low_conf_qids:
        # Collect all folders from confident cluster siblings
        sibling_folders = set()
        sibling_cluster_ids = set()
        for cid in qid_to_clusters.get(qid, set()):
            for sibling_qid in cluster_members[cid]:
                if sibling_qid != qid and sibling_qid in current_confident:
                    sibling_folders |= current_confident[sibling_qid]
                    sibling_cluster_ids.add(cid)

        if not sibling_folders:
            continue  # no confident siblings — leave as low-conf

        # Check for conflict: siblings disagree on topic
        conflict = len(sibling_folders) > 1
        conflict_str = "; ".join(sorted(sibling_folders)) if conflict else ""
        cluster_ids_str = ",".join(sorted(sibling_cluster_ids))

        q = q_meta[qid]
        year = int(q.get("year", 0))
        session = q.get("session", "")
        marks = float(q.get("time_minutes") or 0)

        # Remove the existing low-conf row for this question
        assignments = [a for a in assignments if a["question_id"] != qid]

        for folder in sibling_folders:
            propagated_assignments.append({
                "question_id": qid,
                "year": year,
                "session": session,
                "marks": marks,
                "folder": folder,
                "method": "cluster_propagated",
                "confidence": "medium",
                "score": None,
                "z_score": None,
                "margin": None,
                "cluster_ids": cluster_ids_str,
                "cluster_conflict": conflict_str,
            })
        n_propagated += 1

    assignments.extend(propagated_assignments)
    print(f"Pass 3 cluster propagation: {n_propagated} low-conf questions re-assigned via cluster siblings")
    still_low = sum(1 for a in assignments if a["confidence"] == "low")
    print(f"Remaining low-confidence (no cluster sibling): {still_low}")

    # --- Save question_assignments.csv ---
    assign_path = RESULTS / "question_assignments.csv"
    fieldnames = ["question_id", "year", "session", "marks", "folder", "method",
                  "confidence", "score", "z_score", "margin", "cluster_ids", "cluster_conflict"]
    with assign_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(assignments)
    print(f"Saved {assign_path}")

    # --- Aggregate per topic folder ---
    # Only use high+medium confidence for frequency counts.
    # Low-confidence assignments are recorded but excluded from frequency.
    high_conf = [a for a in assignments if a["confidence"] in ("high", "medium")]

    folder_stats = defaultdict(lambda: {
        "n_questions": 0,
        "papers": set(),   # unique (year, session) pairs
        "years": [],
        "marks_sum": 0.0,
        "recency_score": 0.0,
        "question_ids": [],
        "n_low_conf": 0,
    })

    for a in assignments:
        folder = a["folder"]
        if a["confidence"] in ("high", "medium"):
            folder_stats[folder]["n_questions"] += 1
            folder_stats[folder]["papers"].add((a["year"], a["session"]))
            folder_stats[folder]["years"].append(a["year"])
            folder_stats[folder]["marks_sum"] += a["marks"]
            folder_stats[folder]["recency_score"] += recency_weight(a["year"])
            folder_stats[folder]["question_ids"].append(a["question_id"])
        else:
            folder_stats[folder]["n_low_conf"] += 1

    # --- Build output rows ---
    rows = []
    for folder in all_folders:
        s = folder_stats[folder]
        n_q = s["n_questions"]
        n_papers = len(s["papers"])
        last_year = max(s["years"]) if s["years"] else 0
        avg_marks = (s["marks_sum"] / n_q) if n_q > 0 else 0
        rec_score = s["recency_score"]

        rows.append({
            "folder": folder,
            "n_questions": n_q,
            "n_papers": n_papers,
            "last_tested_year": last_year,
            "recency_score": round(rec_score, 3),
            "avg_marks_per_question": round(avg_marks, 1),
            "n_low_conf_only": s["n_low_conf"],
            "question_ids": "; ".join(sorted(set(s["question_ids"]))),
        })

    # Sort by raw question count first (direct measure of "how often tested"),
    # then recency score as tiebreaker (so two topics with equal counts rank
    # the more recently-tested one higher).
    rows.sort(key=lambda r: (-r["n_questions"], -r["recency_score"]))
    for rank, r in enumerate(rows, 1):
        r["priority_rank"] = rank

    # --- Save topic_frequency.csv ---
    csv_path = RESULTS / "topic_frequency.csv"
    csv_fields = ["priority_rank", "folder", "n_questions", "n_papers", "last_tested_year",
                  "recency_score", "avg_marks_per_question", "n_low_conf_only", "question_ids"]
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=csv_fields)
        w.writeheader()
        w.writerows(rows)
    print(f"Saved {csv_path}")

    # --- Build HTML report ---
    _write_html(rows, assignments)

    # Print summary table to console
    print()
    print(f"{'Rank':>4}  {'Folder':<45}  {'#Q':>4}  {'#Papers':>7}  {'LastYr':>6}  {'RecScore':>9}  {'AvgMks':>7}")
    print("-" * 90)
    for r in rows:
        print(f"  {r['priority_rank']:>2}  {r['folder']:<45}  {r['n_questions']:>4}  "
              f"{r['n_papers']:>7}  {r['last_tested_year']:>6}  "
              f"{r['recency_score']:>9.3f}  {r['avg_marks_per_question']:>7.1f}")


def _write_html(rows: list, assignments: list) -> None:
    # Build question detail lookup per folder
    detail_by_folder = defaultdict(list)
    for a in assignments:
        if a["confidence"] in ("high", "medium"):
            detail_by_folder[a["folder"]].append(a)

    html_rows = ""
    for r in rows:
        folder = r["folder"]
        last = r["last_tested_year"]
        rec = r["recency_score"]
        # Priority badge
        if rec >= 3.0 or r["n_questions"] >= 12:
            badge = '<span style="color:#c0392b;font-weight:bold">HIGH</span>'
        elif rec >= 1.5 or r["n_questions"] >= 7:
            badge = '<span style="color:#d35400;font-weight:bold">MEDIUM</span>'
        else:
            badge = '<span style="color:#7f8c8d">LOW</span>'

        # Build collapsed question list
        q_items = ""
        for a in sorted(detail_by_folder[folder], key=lambda x: (-x["year"], x["session"])):
            method = a["method"]
            marks_str = f" [{int(a['marks'])} min]" if a["marks"] else ""
            if method == "tagged":
                badge = ""
            elif method == "cluster_propagated":
                badge = ' <em style="color:#8e44ad">(cluster-propagated)</em>'
            else:
                badge = ' <em>(inferred)</em>'
            conflict_badge = ""
            if a.get("cluster_conflict"):
                conflict_badge = (' <span style="color:#c0392b" title="Cluster siblings disagree: '
                                  + a["cluster_conflict"].replace('"', '&quot;')
                                  + '">&#9888; multi-topic</span>')
            q_items += f"<li>{a['question_id']}{marks_str}{badge}{conflict_badge}</li>"

        html_rows += f"""
        <tr>
          <td>{r['priority_rank']}</td>
          <td>{folder}</td>
          <td>{badge}</td>
          <td>{r['n_questions']}</td>
          <td>{r['n_papers']}</td>
          <td>{last}</td>
          <td>{rec:.2f}</td>
          <td>{r['avg_marks_per_question']:.0f}</td>
          <td><details><summary>show</summary><ul style="margin:4px 0;padding-left:18px">{q_items}</ul></details></td>
        </tr>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Topic Frequency — F102 Past Exams</title>
<style>
  body {{ font-family: system-ui, sans-serif; font-size: 13px; margin: 20px; }}
  h1 {{ font-size: 18px; }}
  table {{ border-collapse: collapse; width: 100%; }}
  th {{ background: #2c3e50; color: #fff; padding: 8px 10px; cursor: pointer; white-space: nowrap; }}
  th:hover {{ background: #34495e; }}
  td {{ padding: 6px 10px; border-bottom: 1px solid #e0e0e0; vertical-align: top; }}
  tr:hover td {{ background: #f4f8fb; }}
  tr:nth-child(even) td {{ background: #fafafa; }}
  tr:nth-child(even):hover td {{ background: #f4f8fb; }}
  details summary {{ cursor: pointer; color: #2980b9; }}
  .note {{ background:#fffbe6; border-left:4px solid #f39c12; padding:8px 12px; margin-bottom:16px; font-size:12px; }}
</style>
</head>
<body>
<h1>Topic Frequency — F102 Past Exam Questions</h1>
<div class="note">
  <strong>Assignment method:</strong>
  Questions tagged 2010–2019 use the exam institute's own chapter tags (high confidence).
  Questions 2020–2025 use embedding-based inference with a z-score gate (z &gt; 1.5)
  and a margin gate (&gt; 0.020 for most topics; &gt; 0.040 for External environment).
  Low-confidence inferences that belong to a similarity cluster (&ge;0.95) are
  re-assigned by <em>cluster propagation</em> (inheriting their cluster siblings' folders);
  remaining low-confidence inferences are excluded from frequency counts.
  <br><strong>Priority rank</strong> = sorted by number of distinct exam questions matched
  (most frequently tested first); recency score breaks ties.
  <br><span style="color:#c0392b">&#9888; multi-topic</span> = cluster siblings are assigned to
  different folders, so this question genuinely spans multiple topics.
</div>
<table id="tbl">
<thead>
<tr>
  <th onclick="sortTable(0)">Rank</th>
  <th onclick="sortTable(1)">Topic Folder</th>
  <th onclick="sortTable(2)">Priority</th>
  <th onclick="sortTable(3)"># Questions</th>
  <th onclick="sortTable(4)"># Papers</th>
  <th onclick="sortTable(5)">Last Tested</th>
  <th onclick="sortTable(6)">Recency Score</th>
  <th onclick="sortTable(7)">Avg Marks</th>
  <th>Questions</th>
</tr>
</thead>
<tbody>{html_rows}
</tbody>
</table>
<script>
function sortTable(col) {{
  const tbl = document.getElementById('tbl');
  const tbody = tbl.tBodies[0];
  const rows = Array.from(tbody.rows);
  const asc = tbl.dataset.sortCol == col && tbl.dataset.sortDir == 'asc';
  rows.sort((a, b) => {{
    let av = a.cells[col].innerText.replace(/[^0-9.\-]/g,'');
    let bv = b.cells[col].innerText.replace(/[^0-9.\-]/g,'');
    av = isNaN(+av) ? av : +av;
    bv = isNaN(+bv) ? bv : +bv;
    return asc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  }});
  rows.forEach(r => tbody.appendChild(r));
  tbl.dataset.sortCol = col;
  tbl.dataset.sortDir = asc ? 'desc' : 'asc';
}}
</script>
</body>
</html>"""

    html_path = RESULTS / "topic_frequency.html"
    html_path.write_text(html, encoding="utf-8")
    print(f"Saved {html_path}")


if __name__ == "__main__":
    main()
