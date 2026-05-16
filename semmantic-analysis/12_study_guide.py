"""
Step 12: Study guide generator — per topic, per sub-topic, informed by past exams.

For each topic folder (ordered by priority rank from topic_frequency.csv):
  For each sub-topic (note callout block) within that folder:
    1. Count how many past exam questions were matched to this specific callout
       (using similarity within the folder only — avoids cross-topic noise).
    2. Rank sub-topics by question count (most tested first).
    3. For each sub-topic:
       - Show the key concepts from the note itself (your study material).
       - Show 2-3 representative exam questions + the examiner's solution.
       - Show years tested and command words (describe / calculate / explain ...).

Output
------
  results/study_guide.html    full interactive study guide

Design decisions
----------------
- Sub-topic matching is done with within-folder similarity only, so cross-topic
  noise (the main problem) cannot inflate a sub-topic's question count.
- Only questions with high/medium confidence folder assignment are included.
- Low-confidence folder assignments are skipped entirely.
- A sub-topic needs at least 1 matched question to appear in the guide.
  Sub-topics with zero exam matches are listed in a "not recently tested" appendix.
"""

import json
import csv
import re
from pathlib import Path
from collections import defaultdict

import numpy as np

RESULTS = Path(__file__).parent / "results"

# Within-folder similarity threshold to link a question to a specific sub-topic.
# Lower than the folder-level gate because we're already inside the right folder.
SUBTOPIC_SIM_THRESHOLD = 0.72

# Max exam examples to show per sub-topic
MAX_EXAMPLES = 3

# Note text truncation for HTML display
NOTE_PREVIEW_CHARS = 0  # 0 = no truncation

COMMAND_WORD_RE = re.compile(
    r"\b(calculate|derive|define|describe|explain|discuss|outline|list|state|"
    r"comment|assess|compare|suggest|recommend|justify|show|determine|estimate)\b",
    re.IGNORECASE,
)


def get_command_words(text: str) -> list:
    return sorted(set(m.group(0).lower() for m in COMMAND_WORD_RE.finditer(text)))


def extract_solution(full_text: str) -> str:
    """Pull solution section from combined question+solution text."""
    idx = full_text.find("SOLUTION:")
    if idx == -1:
        idx = full_text.find("SOLUTION\n")
    if idx == -1:
        return ""
    return full_text[idx + 9:].strip()


def extract_question_only(full_text: str) -> str:
    """Pull question section only."""
    sol_idx = full_text.find("SOLUTION")
    if sol_idx > 0:
        return full_text[:sol_idx].replace("QUESTION:", "").strip()
    return full_text.replace("QUESTION:", "").strip()


def format_note_text(text: str, max_chars: int = NOTE_PREVIEW_CHARS) -> str:
    """Convert note markdown bullets to clean HTML."""
    lines = text.split("\n")
    out_lines = []
    in_list = False
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if in_list:
                out_lines.append("</ul>")
                in_list = False
            continue
        # Skip heading lines that just repeat the callout label
        if stripped.startswith("#"):
            continue
        if stripped.startswith("- ") or stripped.startswith("* "):
            if not in_list:
                out_lines.append("<ul>")
                in_list = True
            out_lines.append(f"<li>{stripped[2:].strip()}</li>")
        else:
            if in_list:
                out_lines.append("</ul>")
                in_list = False
            out_lines.append(f"<p>{stripped}</p>")
    if in_list:
        out_lines.append("</ul>")
    result = "\n".join(out_lines)
    # Truncate at paragraph boundary if too long
    # Truncate only if explicitly limited
    if max_chars and len(result) > max_chars:
        cut = result.rfind("</", 0, max_chars)
        if cut > 0:
            end_tag = result.find(">", cut)
            result = result[: end_tag + 1] + "\n<p><em>[... more in notes]</em></p>"
    return result


def main():
    # --- Load all data ---
    notes = json.loads((RESULTS / "notes_data.json").read_text(encoding="utf-8"))
    questions_list = json.loads((RESULTS / "questions_data.json").read_text(encoding="utf-8"))
    sim = np.load(RESULTS / "similarity_matrix.npy")   # (N_notes, N_questions)
    assignments = list(csv.DictReader((RESULTS / "question_assignments.csv").open(encoding="utf-8")))
    topic_ranks = list(csv.DictReader((RESULTS / "topic_frequency.csv").open(encoding="utf-8")))

    # Load LLM summaries if available
    summaries_path = RESULTS / "topic_summaries.json"
    topic_summaries = {}
    if summaries_path.exists():
        topic_summaries = json.loads(summaries_path.read_text(encoding="utf-8"))
        print(f"Loaded LLM summaries for {len(topic_summaries)} topics")
    else:
        print("No topic_summaries.json found — run 13_llm_summaries.py to generate them")

    print(f"Notes: {len(notes)} | Questions: {len(questions_list)} | Sim: {sim.shape}")

    # Build lookups
    q_by_id = {q["id"]: q for q in questions_list}
    q_idx_by_id = {q["id"]: i for i, q in enumerate(questions_list)}

    # Assignment lookup: qid -> list of assignment rows for that question
    qid_assignments = defaultdict(list)
    for a in assignments:
        qid_assignments[a["question_id"]].append(a)

    # Group notes by folder
    folder_notes = defaultdict(list)   # folder -> list of (note_idx, note)
    for ni, n in enumerate(notes):
        if n.get("chunk_type") == "callout":
            folder_notes[n["folder"]].append((ni, n))

    # Group assignments by folder (exclude low confidence)
    folder_qids = defaultdict(list)
    for a in assignments:
        if a["confidence"] in ("high", "medium"):
            folder_qids[a["folder"]].append(a["question_id"])

    # Topic priority order
    folder_priority = {r["folder"]: int(r["priority_rank"]) for r in topic_ranks}
    folders_ordered = [r["folder"] for r in topic_ranks if int(r["n_questions"]) > 0]

    # --- For each folder, map questions to best sub-topic within that folder ---
    # This prevents cross-topic noise: we only look at notes INSIDE the folder.
    print("Mapping questions to sub-topics within each folder...")

    folder_sections = {}   # folder -> list of sub-topic dicts

    for folder in folders_ordered:
        note_pool = folder_notes[folder]      # [(ni, note)] for this folder
        qids = folder_qids[folder]            # question IDs assigned to this folder

        if not note_pool or not qids:
            continue

        note_idxs = [ni for ni, _ in note_pool]
        note_objs = [n for _, n in note_pool]

        # Submatrix: (n_folder_notes x n_folder_questions)
        qi_list = [q_idx_by_id[qid] for qid in qids if qid in q_idx_by_id]
        if not qi_list:
            continue

        sub_sim = sim[np.ix_(note_idxs, qi_list)]  # (N_folder_notes, N_folder_qs)

        # For each question, find the best-matching note within this folder
        # (if it clears SUBTOPIC_SIM_THRESHOLD)
        subtopic_questions = defaultdict(list)   # (heading, callout_header) -> [qid, ...]
        uncovered_questions = []                 # questions with no note scoring >= threshold

        for j, qid in enumerate(qids):
            if qid not in q_idx_by_id:
                continue
            col = sub_sim[:, j]
            best_ni_local = int(np.argmax(col))
            best_score = float(col[best_ni_local])
            best_note = note_objs[best_ni_local]

            if best_score >= SUBTOPIC_SIM_THRESHOLD:
                key = (best_note["heading"], best_note.get("callout_header", ""))
                subtopic_questions[key].append((qid, best_score))
            else:
                # This question has no good match in the notes — capture it
                q = q_by_id.get(qid)
                if q:
                    # Get conflict info from assignment
                    conflict = ""
                    method = "unknown"
                    for a in qid_assignments.get(qid, []):
                        if a.get("folder") == folder:
                            conflict = a.get("cluster_conflict", "")
                            method = a.get("method", "")
                            break
                    q_text = extract_question_only(q.get("text", ""))
                    s_text = extract_solution(q.get("text", ""))
                    cmd_words = get_command_words(q_text)
                    uncovered_questions.append({
                        "qid": qid,
                        "year": int(q.get("year", 0)),
                        "session": q.get("session", ""),
                        "question_text": q_text,
                        "solution_text": s_text,
                        "cmd_words": cmd_words,
                        "best_score": round(best_score, 3),
                        "best_note_title": best_note.get("callout_header") or best_note.get("heading", ""),
                        "has_solution": bool(q.get("has_solution")),
                        "cluster_conflict": conflict,
                        "method": method,
                    })

        uncovered_questions.sort(key=lambda x: (-x["year"], x["session"]))

        # Build sub-topic section list, sorted by question count desc
        subtopics = []
        for (heading, callout_header), qid_scores in subtopic_questions.items():
            # Find the note object for this subtopic
            note_obj = next(
                (n for _, n in note_pool
                 if n["heading"] == heading and n.get("callout_header", "") == callout_header),
                None,
            )
            if not note_obj:
                continue

            qid_scores.sort(key=lambda x: -x[1])
            years = []
            examples = []
            for qid, score in qid_scores:
                q = q_by_id.get(qid)
                if not q:
                    continue
                yr = int(q.get("year", 0))
                years.append(yr)
                if len(examples) < MAX_EXAMPLES:
                    q_text = extract_question_only(q.get("text", ""))
                    s_text = extract_solution(q.get("text", ""))
                    cmd_words = get_command_words(q_text)
                    examples.append({
                        "qid": qid,
                        "year": yr,
                        "session": q.get("session", ""),
                        "question_text": q_text,
                        "solution_text": s_text,
                        "cmd_words": cmd_words,
                        "score": round(score, 3),
                        "has_solution": bool(q.get("has_solution")),
                    })

            subtopics.append({
                "heading": heading,
                "callout_header": callout_header or heading,
                "n_questions": len(qid_scores),
                "years": sorted(set(years)),
                "last_year": max(years) if years else 0,
                "note_text": note_obj.get("text", ""),
                "examples": examples,
            })

        subtopics.sort(key=lambda s: (-s["n_questions"], -s["last_year"]))

        # Collect note blocks that had zero exam matches (for appendix)
        matched_keys = set(subtopic_questions.keys())
        untested = []
        for _, n in note_pool:
            key = (n["heading"], n.get("callout_header", ""))
            if key not in matched_keys:
                untested.append({
                    "heading": n["heading"],
                    "callout_header": n.get("callout_header", "") or n["heading"],
                    "note_text": n.get("text", ""),
                })

        folder_sections[folder] = {
            "subtopics": subtopics,
            "untested": untested,
            "uncovered": uncovered_questions,
            "n_questions": len(qids),
            "llm_summary": topic_summaries.get(folder, {}).get("summary_html", ""),
            "summary_model": topic_summaries.get(folder, {}).get("model", ""),
        }

    # --- Write HTML study guide ---
    _write_html(folders_ordered, folder_sections, topic_ranks, topic_summaries)
    print(f"Saved {RESULTS / 'study_guide.html'}")

    # Print console summary
    print()
    for folder in folders_ordered:
        sec = folder_sections.get(folder)
        if not sec:
            continue
        rank = folder_priority.get(folder, "?")
        print(f"[{rank:>2}] {folder} -- {sec['n_questions']} questions -> "
              f"{len(sec['subtopics'])} sub-topics matched, {len(sec.get('uncovered', []))} uncovered")
        for st in sec["subtopics"][:4]:
            years_str = ", ".join(str(y) for y in st["years"][-4:])
            print(f"       {st['n_questions']:>2}x  {st['callout_header']}  ({years_str})")


# ─────────────────────────────────── HTML ────────────────────────────────────

CSS = """
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, -apple-system, sans-serif; font-size: 13px;
       background: #f0f2f5; color: #1a1a2e; }
#sidebar { position: fixed; top: 0; left: 0; width: 240px; height: 100vh;
           background: #1a1a2e; color: #cdd6f4; overflow-y: auto; padding: 16px 0; z-index: 100; }
#sidebar h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em;
              color: #6c7086; padding: 4px 16px 8px; }
#sidebar a { display: block; padding: 5px 16px; color: #cdd6f4; text-decoration: none;
             font-size: 12px; border-left: 3px solid transparent; line-height: 1.4; }
#sidebar a:hover, #sidebar a.active { background: #313244; border-left-color: #89b4fa; color: #cdd6f4; }
#sidebar .rank-badge { float: right; background: #313244; border-radius: 10px;
                       padding: 1px 6px; font-size: 10px; color: #89b4fa; }
#main { margin-left: 240px; padding: 24px 32px; max-width: 1100px; }
.topic-section { background: #fff; border-radius: 10px; margin-bottom: 28px;
                 box-shadow: 0 1px 4px rgba(0,0,0,.08); overflow: hidden; }
.topic-header { padding: 16px 22px; background: #1a1a2e; color: #fff; }
.topic-header h2 { font-size: 16px; font-weight: 600; }
.topic-meta { font-size: 11px; color: #a6adc8; margin-top: 4px; }
.priority-HIGH { background: #c0392b; }
.priority-MEDIUM { background: #d35400; }
.priority-LOW { background: #27ae60; }
.priority-badge { display: inline-block; color: #fff; font-size: 10px; font-weight: 700;
                  padding: 2px 8px; border-radius: 10px; margin-left: 10px; vertical-align: middle; }
.subtopic { border-bottom: 1px solid #e8ecf0; }
.subtopic:last-child { border-bottom: none; }
.subtopic-header { padding: 12px 22px; cursor: pointer; display: flex;
                   align-items: center; gap: 10px; user-select: none; }
.subtopic-header:hover { background: #f7f9fc; }
.freq-badge { background: #e8f0fe; color: #1a73e8; border-radius: 12px;
              padding: 2px 10px; font-size: 11px; font-weight: 600; white-space: nowrap; }
.subtopic-title { font-weight: 600; font-size: 13px; flex: 1; }
.subtopic-years { font-size: 11px; color: #6c7086; }
.subtopic-body { display: none; padding: 0 22px 20px; }
.subtopic-body.open { display: block; }
.section-label { font-size: 10px; font-weight: 700; text-transform: uppercase;
                 letter-spacing: .08em; color: #6c7086; margin: 14px 0 6px; }
.key-concepts { background: #f8fafd; border-left: 3px solid #89b4fa;
                border-radius: 0 6px 6px 0; padding: 10px 14px; }
.key-concepts ul { padding-left: 18px; }
.key-concepts li { margin-bottom: 3px; line-height: 1.5; }
.key-concepts p { line-height: 1.5; margin-bottom: 6px; }
.example { background: #fafafa; border: 1px solid #e0e0e0; border-radius: 6px;
           margin-bottom: 10px; overflow: hidden; }
.example-header { background: #f0f2f5; padding: 7px 12px; font-size: 11px;
                  font-weight: 600; color: #1a1a2e; display: flex; gap: 8px; align-items: center; }
.example-body { padding: 10px 12px; }
.cmd-tag { background: #e0e7ff; color: #3730a3; border-radius: 8px;
           padding: 1px 7px; font-size: 10px; font-weight: 600; }
.q-text { color: #1a1a2e; line-height: 1.55; white-space: pre-wrap;
          font-size: 12px; }
.sol-toggle { color: #1a73e8; cursor: pointer; font-size: 11px;
              margin-top: 8px; display: inline-block; }
.sol-text { display: none; margin-top: 8px; background: #f0fdf4; border-left: 3px solid #22c55e;
            padding: 8px 12px; border-radius: 0 6px 6px 0; white-space: pre-wrap;
            font-size: 12px; line-height: 1.55; }
.untested-section { padding: 10px 22px 16px; background: #fafafa; }
.untested-section summary { font-size: 11px; color: #6c7086; cursor: pointer; }
.untested-list { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; }
.untested-tag { background: #f0f0f0; border-radius: 10px; padding: 2px 10px;
                font-size: 11px; color: #6c7086; }
.uncovered-section { border-top: 2px solid #f39c12; margin: 0; }
.uncovered-header { padding: 10px 22px; background: #fffbe6; cursor: pointer;
                    display: flex; align-items: center; gap: 8px; }
.uncovered-header:hover { background: #fff3cc; }
.uncovered-header h3 { font-size: 13px; color: #b7770d; font-weight: 600; flex: 1; }
.uncovered-body { display: none; padding: 0 22px 20px; background: #fffbe6; }
.uncovered-body.open { display: block; }
.uncovered-intro { font-size: 12px; color: #7d5a00; margin-bottom: 12px;
                   padding: 8px 12px; background: #fff3cc; border-radius: 6px;
                   border-left: 3px solid #f39c12; }
.conflict-badge { background: #fde8e8; color: #c0392b; border-radius: 8px;
                  padding: 1px 7px; font-size: 10px; font-weight: 600; }
.llm-summary { padding: 20px 22px 8px; border-bottom: 1px solid #e8ecf0; }
.llm-summary h3 { font-size: 14px; font-weight: 700; color: #1a1a2e;
                  margin: 18px 0 8px; border-bottom: 1px solid #e8ecf0; padding-bottom: 4px; }
.llm-summary h3:first-child { margin-top: 0; }
.llm-summary h4 { font-size: 13px; font-weight: 600; color: #2c3e50; margin: 12px 0 6px; }
.llm-summary ul { padding-left: 20px; margin-bottom: 10px; }
.llm-summary li { line-height: 1.65; margin-bottom: 4px; color: #1a1a2e; }
.llm-summary p { line-height: 1.65; margin-bottom: 8px; color: #333; }
.llm-badge { font-size: 10px; color: #6c7086; padding: 2px 8px;
             background: #f0f2f5; border-radius: 8px; }
.exam-examples-section { padding: 16px 22px 4px; border-bottom: 1px solid #e8ecf0; }
.exam-examples-section h3 { font-size: 13px; font-weight: 700; color: #1a1a2e; margin-bottom: 12px; }
.no-summary-note { padding: 14px 22px; background: #fffbe6; font-size: 12px;
                   color: #7d5a00; border-bottom: 1px solid #e8ecf0; }
.intro-box { background: #fff; border-radius: 10px; padding: 18px 22px;
             margin-bottom: 24px; box-shadow: 0 1px 4px rgba(0,0,0,.08);
             border-left: 4px solid #89b4fa; }
.intro-box h1 { font-size: 18px; margin-bottom: 6px; }
.intro-box p { color: #6c7086; line-height: 1.6; font-size: 12px; }
"""

JS = """
function toggleSubtopic(el) {
  const body = el.nextElementSibling;
  body.classList.toggle('open');
}
function toggleUncovered(el) {
  const body = el.nextElementSibling;
  body.classList.toggle('open');
  const arrow = el.querySelector('.uncovered-arrow');
  if (arrow) arrow.textContent = body.classList.contains('open') ? '▴' : '▾';
}
function toggleSol(btn) {
  const sol = btn.nextElementSibling;
  sol.style.display = sol.style.display === 'block' ? 'none' : 'block';
  btn.textContent = sol.style.display === 'block' ? 'Hide examiner solution ▲' : 'Show examiner solution ▼';
}
// Sidebar active tracking
window.addEventListener('scroll', () => {
  const sections = document.querySelectorAll('.topic-section');
  let active = null;
  sections.forEach(s => { if (s.getBoundingClientRect().top <= 80) active = s.id; });
  document.querySelectorAll('#sidebar a').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === '#' + active);
  });
});
"""


def _uncovered_example_html(uc: dict) -> str:
    """Render one uncovered-angle question card."""
    cmd_tags = " ".join(f'<span class="cmd-tag">{c}</span>' for c in uc["cmd_words"])
    conflict_badge = ""
    if uc.get("cluster_conflict"):
        folders = uc["cluster_conflict"].replace(";", " | ")
        conflict_badge = (f'<span class="conflict-badge" '
                          f'title="Cluster siblings assigned to: {folders}">'
                          f'&#9888; multi-topic</span>')
    sol_block = ""
    if uc["has_solution"] and uc["solution_text"].strip():
        sol_html = uc["solution_text"].replace("<", "&lt;").replace(">", "&gt;")
        sol_block = (
            f'<span class="sol-toggle" onclick="toggleSol(this)">Show examiner solution ▼</span>'
            f'<div class="sol-text">{sol_html}</div>'
        )
    q_html = uc["question_text"].replace("<", "&lt;").replace(">", "&gt;")
    method_label = {"tagged": "", "cluster_propagated": " (cluster)",
                    "inferred": " (inferred)", "inferred_low_conf": " (low-conf)"
                    }.get(uc["method"], "")
    return f"""
    <div class="example">
      <div class="example-header">
        <span>{uc['year']} {uc['session']} — {uc['qid'].split('_')[-1]}{method_label}</span>
        {cmd_tags}
        {conflict_badge}
        <span style="margin-left:auto;font-size:10px;color:#6c7086">best-note sim={uc['best_score']} → {uc['best_note_title'][:40]}</span>
      </div>
      <div class="example-body">
        <div class="q-text">{q_html}</div>
        {sol_block}
      </div>
    </div>"""


def _uncovered_section_html(uncovered: list) -> str:
    if not uncovered:
        return ""
    cards = "".join(_uncovered_example_html(uc) for uc in uncovered)
    n = len(uncovered)
    return f"""
  <div class="uncovered-section">
    <div class="uncovered-header" onclick="toggleUncovered(this)">
      <span style="font-size:16px">&#9888;</span>
      <h3>Exam angles not yet covered by your notes ({n} question{'s' if n != 1 else ''})</h3>
      <span class="uncovered-arrow" style="color:#b7770d;font-size:16px">▾</span>
    </div>
    <div class="uncovered-body">
      <div class="uncovered-intro">
        These questions were assigned to this topic but no note in this folder matched
        with similarity &ge; {SUBTOPIC_SIM_THRESHOLD}. They may test sub-angles the
        examiner emphasises that your notes don't yet cover. Review them alongside
        the examiner solutions to identify gaps.
      </div>
      {cards}
    </div>
  </div>"""


def _priority_badge(rec_score: float, n_q: int) -> str:
    if float(rec_score) >= 3.0 or n_q >= 12:
        level = "HIGH"
    elif float(rec_score) >= 1.5 or n_q >= 7:
        level = "MEDIUM"
    else:
        level = "LOW"
    return f'<span class="priority-badge priority-{level}">{level}</span>'


def _example_html(ex: dict, idx: int) -> str:
    cmd_tags = " ".join(f'<span class="cmd-tag">{c}</span>' for c in ex["cmd_words"])
    sol_block = ""
    if ex["has_solution"] and ex["solution_text"].strip():
        sol_html = ex["solution_text"].replace("<", "&lt;").replace(">", "&gt;")
        sol_block = (
            f'<span class="sol-toggle" onclick="toggleSol(this)">Show examiner solution ▼</span>'
            f'<div class="sol-text">{sol_html}</div>'
        )
    q_html = ex["question_text"].replace("<", "&lt;").replace(">", "&gt;")
    return f"""
    <div class="example">
      <div class="example-header">
        <span>{ex['year']} {ex['session']} — {ex['qid'].split('_')[-1]}</span>
        {cmd_tags}
        <span style="margin-left:auto;font-size:10px;color:#6c7086">sim={ex['score']}</span>
      </div>
      <div class="example-body">
        <div class="q-text">{q_html}</div>
        {sol_block}
      </div>
    </div>"""


def _subtopic_html(st: dict) -> str:
    years_str = " · ".join(str(y) for y in st["years"])
    note_html = format_note_text(st["note_text"])
    examples_html = "".join(_example_html(ex, i) for i, ex in enumerate(st["examples"]))
    if not examples_html:
        examples_html = '<p style="color:#6c7086;font-size:12px">No matched exam questions above threshold.</p>'

    return f"""
  <div class="subtopic">
    <div class="subtopic-header" onclick="toggleSubtopic(this)">
      <span class="freq-badge">{st['n_questions']}x</span>
      <span class="subtopic-title">{st['callout_header']}</span>
      <span class="subtopic-years">tested: {years_str}</span>
      <span style="color:#aaa;font-size:16px">▾</span>
    </div>
    <div class="subtopic-body">
      <div class="section-label">Key concepts to understand</div>
      <div class="key-concepts">{note_html}</div>
      <div class="section-label">Exam examples ({len(st['examples'])} shown)</div>
      {examples_html}
    </div>
  </div>"""


def _topic_section_html(folder: str, sec: dict, rank_data: dict) -> str:
    n_q = sec["n_questions"]
    rec = float(rank_data.get("recency_score", 0))
    last = rank_data.get("last_tested_year", "")
    rank = rank_data.get("priority_rank", "")
    badge = _priority_badge(rec, n_q)

    subtopics_html = "".join(_subtopic_html(st) for st in sec["subtopics"])

    untested_html = ""
    if sec["untested"]:
        tags = " ".join(
            f'<span class="untested-tag">{u["callout_header"]}</span>'
            for u in sec["untested"]
        )
        untested_html = f"""
  <div class="untested-section">
    <details>
      <summary>Sub-topics in notes with no matched exam questions ({len(sec['untested'])})</summary>
      <div class="untested-list">{tags}</div>
    </details>
  </div>"""

    uncovered_html = _uncovered_section_html(sec.get("uncovered", []))

    n_uncovered = len(sec.get("uncovered", []))
    uncovered_meta = f" &nbsp;|&nbsp; <span style='color:#b7770d'>⚠ {n_uncovered} uncovered angles</span>" if n_uncovered else ""

    section_id = folder.replace(" ", "_").replace(".", "").replace("&", "and")
    return f"""
<div class="topic-section" id="{section_id}">
  <div class="topic-header">
    <h2>#{rank} &nbsp; {folder} {badge}</h2>
    <div class="topic-meta">
      {n_q} exam questions matched &nbsp;|&nbsp; last tested {last} &nbsp;|&nbsp;
      recency score {rec:.2f} &nbsp;|&nbsp; {len(sec['subtopics'])} sub-topics tested{uncovered_meta}
    </div>
  </div>
  {subtopics_html}
  {untested_html}
  {uncovered_html}
</div>"""


def _sidebar_item(folder: str, rank_data: dict, sec: dict) -> str:
    rank = rank_data.get("priority_rank", "?")
    n_q = sec.get("n_questions", 0)
    section_id = folder.replace(" ", "_").replace(".", "").replace("&", "and")
    # Short name: strip leading number
    short = re.sub(r"^\d+\.\s*", "", folder)
    return f'<a href="#{section_id}">{short}<span class="rank-badge">#{rank} · {n_q}q</span></a>'


def _write_html(
    folders_ordered: list,
    folder_sections: dict,
    topic_ranks: list,
    topic_summaries: dict | None = None,
) -> None:
    rank_lookup = {r["folder"]: r for r in topic_ranks}

    sidebar_items = "".join(
        _sidebar_item(f, rank_lookup.get(f, {}), folder_sections.get(f, {"n_questions": 0}))
        for f in folders_ordered
        if f in folder_sections
    )

    sections_html = "".join(
        _topic_section_html(f, folder_sections[f], rank_lookup.get(f, {}))
        for f in folders_ordered
        if f in folder_sections
    )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>F102 Study Guide — Informed by Past Exams</title>
<style>{CSS}</style>
</head>
<body>
<nav id="sidebar">
  <h2>Topics by Priority</h2>
  {sidebar_items}
</nav>
<main id="main">
  <div class="intro-box">
    <h1>F102 Study Guide — Informed by Past Exams</h1>
    <p>
      Topics are ranked by <strong>exam frequency</strong> —
      how many distinct past exam questions test each topic (most tested first).
      Each sub-topic shows: the <strong>key concepts from your notes</strong> (what to study)
      and <strong>real past exam questions + examiner solutions</strong> (how it is tested).
      Sub-topics within each topic are ordered by how many exam questions
      were matched to them, using within-folder similarity only to avoid
      cross-topic false positives.
    </p>
    <p style="margin-top:8px">
      Click any sub-topic row to expand. Click <em>Show examiner solution</em>
      to reveal the model answer.
      <br><span style="color:#b7770d;font-weight:600">⚠ Uncovered angles</span> —
      each topic also shows exam questions that don't match any note above the
      similarity threshold. These reveal examiner angles your notes don't yet cover.
    </p>
  </div>
  {sections_html}
</main>
<script>{JS}</script>
</body>
</html>"""

    out = RESULTS / "study_guide.html"
    out.write_text(html, encoding="utf-8")


if __name__ == "__main__":
    main()
