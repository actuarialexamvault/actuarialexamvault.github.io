"""Temporary: print the exact prompt sent to the LLM for a given topic."""
import json, csv
from pathlib import Path
from collections import defaultdict

RESULTS = Path(__file__).parent / "results"
MAX_NOTE_CHARS = 2000
MAX_QUESTIONS = 8
MAX_Q_CHARS = 1500

notes = json.loads((RESULTS / "notes_data.json").read_text(encoding="utf-8"))
questions = json.loads((RESULTS / "questions_data.json").read_text(encoding="utf-8"))
assignments = list(csv.DictReader((RESULTS / "question_assignments.csv").open(encoding="utf-8")))

folder = "12. Surrender values"
folder_notes = [n for n in notes if n["folder"] == folder and n.get("chunk_type") == "callout"]

print(f"NOTES SENT ({len(folder_notes)} callout blocks):")
for n in folder_notes:
    header = n.get("callout_header") or n.get("heading") or ""
    text = n.get("text", "").strip()
    truncated = "(truncated)" if len(text) > MAX_NOTE_CHARS else ""
    print(f"  [{header}]  {len(text)} chars {truncated}")

q_by_id = {q["id"]: q for q in questions}
assigned_qids = [
    a["question_id"] for a in assignments
    if a["folder"] == folder and a["confidence"] in ("high", "medium")
]
unique_qids = list(dict.fromkeys(assigned_qids))
unique_qids.sort(
    key=lambda qid: int(q_by_id[qid].get("year", 0)) if qid in q_by_id else 0,
    reverse=True,
)
sent = unique_qids[:MAX_QUESTIONS]

print(f"\nQUESTIONS SENT ({len(sent)} of {len(set(assigned_qids))} assigned):")
for qid in sent:
    q = q_by_id.get(qid, {})
    yr = q.get("year", "?")
    sess = q.get("session", "?")
    tlen = len(q.get("text", ""))
    print(f"  {qid}  ({yr} {sess})  {tlen} chars")

not_sent = [qid for qid in unique_qids[MAX_QUESTIONS:]]
if not_sent:
    print(f"\nQUESTIONS NOT SENT (beyond MAX_QUESTIONS={MAX_QUESTIONS}):")
    for qid in not_sent:
        q = q_by_id.get(qid, {})
        print(f"  {qid}  ({q.get('year','?')} {q.get('session','?')})")
