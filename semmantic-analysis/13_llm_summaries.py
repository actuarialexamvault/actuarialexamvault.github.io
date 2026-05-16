"""
Step 13: LLM-synthesised topic summaries.

For each exam topic (ordered by priority rank), calls the LangChain LLM to
produce a coherent, bullet-rich study summary that covers BOTH the note
material AND every examiner angle found in past questions.

One LLM call per topic (~17-19 calls total).

Output
------
  results/topic_summaries.json   {folder -> {summary_html, generated_at}}

Usage
-----
  python 13_llm_summaries.py                   # regenerate all topics
  python 13_llm_summaries.py --topic "9. Assumptions"   # single topic only
  python 13_llm_summaries.py --force            # ignore cached results
"""

import argparse
import csv
import json
import re
import sys
import textwrap
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import numpy as np

# ---------------------------------------------------------------------------
# Add the langchain-agent repo to sys.path so we can borrow its LLM plumbing
# ---------------------------------------------------------------------------
AGENT_ROOT = Path(r"C:\Users\lmdunge\dev\langchain-agent")
if str(AGENT_ROOT) not in sys.path:
    sys.path.insert(0, str(AGENT_ROOT))

from agent.core import _make_llm, load_agent_config          # noqa: E402
from langchain_core.messages import HumanMessage, SystemMessage  # noqa: E402

RESULTS = Path(__file__).parent / "results"
SUMMARIES_PATH = RESULTS / "topic_summaries.json"

# Max chars of note text to include per callout block
MAX_NOTE_CHARS = 2000
# Max question examples to include in the prompt
MAX_QUESTIONS = 8
# Max chars of each question+solution block in the prompt
MAX_Q_CHARS = 1500


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = textwrap.dedent("""\
    You are a senior actuarial exam coach helping a student prepare for the
    F102 (Life Insurance) Fellowship actuarial exam.  Your task is to write a
    COMPREHENSIVE STUDY SUMMARY for a single exam topic.

    You will be given:
    1. TOPIC NOTES — callout blocks extracted from the student's Obsidian study
       notes.  These represent the student's current understanding.
    2. PAST EXAM QUESTIONS & SOLUTIONS — real exam questions (with examiner
       solutions) that have been assigned to this topic.

    Your job is to synthesise BOTH sources into one coherent, complete summary
    that a student could use instead of going back to raw notes.

    ── STRICT OUTPUT FORMAT ──────────────────────────────────────────────────

    Use the following HTML structure EXACTLY (no markdown, only HTML):

    <h3>What You Must Know</h3>
    <p>[1–2 sentence plain-English overview of what this topic is about and
    why it appears so often in the exam.]</p>

    <h3>Core Concepts</h3>
    [For each major concept / sub-topic, write:]
    <h4>[Concept name]</h4>
    <ul>
      <li>[key point]</li>
      <li>[key point]</li>
      ...
    </ul>

    <h3>Examiner Angles — What They Actually Test</h3>
    <p>Based on past exam questions, the examiner consistently focuses on:</p>
    <ul>
      <li><strong>[angle]</strong> — [brief explanation of what to cover in an answer]</li>
      ...
    </ul>

    <h3>Common Pitfalls &amp; Exam Technique</h3>
    <ul>
      <li>[pitfall or technique point]</li>
      ...
    </ul>

    ── QUALITY REQUIREMENTS ─────────────────────────────────────────────────

    • FULL COVERAGE is mandatory. Do not omit sub-topics that appear only in
      exam questions but not in the notes — these are the biggest study gaps.
    • Use bullet points for all lists. Keep each bullet ≤ 2 lines.
    • Be specific and technical — use actuarial terminology correctly.
    • The "Examiner Angles" section must be grounded in the actual exam
      questions provided, not generic advice.
    • Do NOT add preamble, meta-commentary or closing remarks.
      Start directly with <h3>What You Must Know</h3>.
    • Do NOT use markdown (no #, *, **, `) — use HTML only.
""")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _strip_solution(text: str) -> str:
    idx = text.find("SOLUTION:")
    if idx == -1:
        idx = text.find("SOLUTION\n")
    return text[:idx].replace("QUESTION:", "").strip() if idx > 0 else text.replace("QUESTION:", "").strip()


def _solution_only(text: str) -> str:
    for marker in ("SOLUTION:", "SOLUTION\n"):
        idx = text.find(marker)
        if idx != -1:
            return text[idx + len(marker):].strip()
    return ""


def load_data():
    notes = json.loads((RESULTS / "notes_data.json").read_text(encoding="utf-8"))
    questions = json.loads((RESULTS / "questions_data.json").read_text(encoding="utf-8"))
    assignments = list(csv.DictReader((RESULTS / "question_assignments.csv").open(encoding="utf-8")))
    topic_ranks = list(csv.DictReader((RESULTS / "topic_frequency.csv").open(encoding="utf-8")))
    return notes, questions, assignments, topic_ranks


def build_prompt(folder: str, notes: list, questions: list, assignments: list) -> str:
    """Assemble the human-turn prompt for one topic."""

    # --- Notes for this folder (callout chunks only) ---
    folder_notes = [n for n in notes if n["folder"] == folder and n.get("chunk_type") == "callout"]

    notes_block = ""
    if folder_notes:
        parts = []
        for n in folder_notes:
            header = n.get("callout_header") or n.get("heading") or ""
            text = n.get("text", "").strip()
            if len(text) > MAX_NOTE_CHARS:
                text = text[:MAX_NOTE_CHARS] + "\n[... truncated]"
            parts.append(f"### {header}\n{text}")
        notes_block = "\n\n".join(parts)
    else:
        notes_block = "[No structured notes available for this topic]"

    # --- Questions assigned to this folder (high/medium confidence) ---
    q_by_id = {q["id"]: q for q in questions}
    assigned_qids = [
        a["question_id"]
        for a in assignments
        if a["folder"] == folder and a["confidence"] in ("high", "medium")
    ]
    # Deduplicate while preserving order, prefer recent questions first
    seen = set()
    unique_qids = []
    for qid in assigned_qids:
        if qid not in seen:
            seen.add(qid)
            unique_qids.append(qid)

    # Sort by year desc so most recent questions appear first
    unique_qids.sort(
        key=lambda qid: int(q_by_id[qid].get("year", 0)) if qid in q_by_id else 0,
        reverse=True,
    )
    unique_qids = unique_qids[:MAX_QUESTIONS]

    questions_block = ""
    if unique_qids:
        parts = []
        for qid in unique_qids:
            q = q_by_id.get(qid)
            if not q:
                continue
            q_text = _strip_solution(q.get("text", ""))
            sol_text = _solution_only(q.get("text", ""))
            combined = f"Q ({q.get('year')} {q.get('session')}):\n{q_text}"
            if sol_text:
                combined += f"\n\nEXAMINER SOLUTION:\n{sol_text}"
            if len(combined) > MAX_Q_CHARS:
                combined = combined[:MAX_Q_CHARS] + "\n[... truncated]"
            parts.append(combined)
        questions_block = "\n\n---\n\n".join(parts)
    else:
        questions_block = "[No exam questions assigned to this topic]"

    prompt = textwrap.dedent(f"""\
        TOPIC: {folder}

        ════════════════════════════════════════════════
        SECTION 1 — TOPIC NOTES (student's study notes)
        ════════════════════════════════════════════════

        {notes_block}

        ════════════════════════════════════════════════
        SECTION 2 — PAST EXAM QUESTIONS & SOLUTIONS
                    ({len(unique_qids)} of {len(set(assigned_qids))} questions shown)
        ════════════════════════════════════════════════

        {questions_block}

        ════════════════════════════════════════════════
        Now write the complete study summary for this topic.
        Follow the HTML format specified in your instructions exactly.
        ════════════════════════════════════════════════
    """)
    return prompt


def call_llm(llm, folder: str, prompt: str) -> str:
    """Send prompt to LLM and return the raw text response."""
    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=prompt),
    ]
    response = llm.invoke(messages)
    return response.content


def load_existing() -> dict:
    if SUMMARIES_PATH.exists():
        return json.loads(SUMMARIES_PATH.read_text(encoding="utf-8"))
    return {}


def save_summaries(data: dict) -> None:
    SUMMARIES_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--topic", help="Only regenerate this folder name (partial match ok)")
    parser.add_argument("--force", action="store_true", help="Re-generate even if cached")
    args = parser.parse_args()

    notes, questions, assignments, topic_ranks = load_data()

    # Topics ordered by priority rank, skip those with 0 questions
    folders_ordered = [r["folder"] for r in topic_ranks if int(r["n_questions"]) > 0]

    if args.topic:
        folders_ordered = [f for f in folders_ordered if args.topic.lower() in f.lower()]
        if not folders_ordered:
            print(f"No folder matched '{args.topic}'")
            return

    existing = load_existing()

    # Build LLM — read model directly from agent.yaml, bypass the model-selection
    # cache (which may hold stale rate-limit fallbacks from previous sessions).
    agent_config = load_agent_config()
    model = agent_config.get("model", "gpt-4.1")
    # Allow CLI override via env var for easy one-off testing
    import os
    model = os.environ.get("SUMMARY_MODEL", model)
    print(f"Using model: {model}")
    llm = _make_llm(model, agent_config)

    total = len(folders_ordered)
    print(f"\nGenerating summaries for {total} topics...\n{'─' * 60}")

    for idx, folder in enumerate(folders_ordered, 1):
        if not args.force and folder in existing:
            print(f"[{idx}/{total}] SKIP (cached): {folder}")
            continue

        print(f"[{idx}/{total}] Generating: {folder} ... ", end="", flush=True)
        try:
            prompt = build_prompt(folder, notes, questions, assignments)
            summary_html = call_llm(llm, folder, prompt)
            existing[folder] = {
                "summary_html": summary_html,
                "generated_at": datetime.utcnow().isoformat(),
                "model": model,
            }
            save_summaries(existing)
            print("done")
        except Exception as e:
            print(f"ERROR: {e}")
            existing[folder] = {
                "summary_html": f"<p><em>Summary generation failed: {e}</em></p>",
                "generated_at": datetime.utcnow().isoformat(),
                "model": model,
            }
            save_summaries(existing)

    print(f"\n{'─' * 60}")
    print(f"Saved {SUMMARIES_PATH}")
    print(f"Done. {sum(1 for v in existing.values() if 'Error' not in v.get('summary_html','Error'))} summaries ready.")


if __name__ == "__main__":
    main()
