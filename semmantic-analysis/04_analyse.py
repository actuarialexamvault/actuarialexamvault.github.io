"""
Step 4: Compute cosine similarity matrix and derive analysis results.

Requires outputs from steps 1-3 (JSON data files + .npy embeddings).

Outputs:
  results/similarity_matrix.npy       full (N_notes x N_questions) matrix
  results/question_top_matches.json   per-question top-5 note matches
  results/note_coverage.json          per-note aggregate coverage stats
  results/heatmap_data.json           (topic folder, year, session) -> mean similarity
  results/validation_report.json      accuracy vs known chapter tags (2010-2019 questions)
"""

import json
import numpy as np
from pathlib import Path
from collections import defaultdict

RESULTS = Path(__file__).parent / "results"
TOP_K = 5
STRONG_MATCH_THRESHOLD = 0.60  # only count as strong match if similarity >= 0.60

# Maps known chapter tag strings (from YAML frontmatter) to obsidian folder names.
# Used only for validation against the 2010-2019 tagged questions.
CHAPTER_TAG_TO_FOLDER = {
    # Exact tags found in the question YAML frontmatter (from 02_load_questions.py output)
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
    "Supervisory Reserves and Capital Requirements":"10. Reserving",
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


def safe_weight(q: dict) -> float:
    try:
        return float(q["time_minutes"]) if q.get("time_minutes") else 1.0
    except (ValueError, TypeError):
        return 1.0


def main():
    # --- Load data ---
    notes = json.loads((RESULTS / "notes_data.json").read_text(encoding="utf-8"))
    questions = json.loads((RESULTS / "questions_data.json").read_text(encoding="utf-8"))
    note_embs = np.load(RESULTS / "embeddings_notes.npy")       # (N_notes, dim)
    q_embs = np.load(RESULTS / "embeddings_questions.npy")      # (N_questions, dim)

    print(f"Notes: {len(notes)}  |  Questions: {len(questions)}")
    print(f"Embeddings: notes={note_embs.shape}  questions={q_embs.shape}")

    # Sanity check
    assert note_embs.shape[0] == len(notes), \
        "notes_data.json row count != embeddings_notes.npy row count — re-run 03_embed.py"
    assert q_embs.shape[0] == len(questions), \
        "questions_data.json row count != embeddings_questions.npy row count — re-run 03_embed.py"

    # --- Cosine similarity matrix ---
    # Vectors are L2-normalised from 03_embed.py, so cosine sim = dot product.
    print("Computing similarity matrix...")
    sim_matrix = note_embs @ q_embs.T      # shape: (N_notes, N_questions)
    np.save(RESULTS / "similarity_matrix.npy", sim_matrix)
    print(f"  Saved similarity_matrix.npy  shape={sim_matrix.shape}")

    # --- Per-question: top-K note matches ---
    print("Building per-question top matches...")
    question_top_matches = []
    for q_idx, q in enumerate(questions):
        scores = sim_matrix[:, q_idx]
        top_idxs = np.argsort(scores)[::-1][:TOP_K]
        matches = [
            {
                "rank": int(rank + 1),
                "note_file": notes[i]["file"],
                "note_folder": notes[i]["folder"],
                "note_heading": notes[i]["heading"],
                "note_callout": notes[i].get("callout_header"),
                "chunk_type": notes[i].get("chunk_type", "callout"),
                "similarity": float(scores[i]),
            }
            for rank, i in enumerate(top_idxs)
        ]
        question_top_matches.append({
            "id": q["id"],
            "year": q["year"],
            "session": q["session"],
            "question": q["question"],
            "chapters_tagged": q["chapters"],
            "top_matches": matches,
        })

    (RESULTS / "question_top_matches.json").write_text(
        json.dumps(question_top_matches, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"  Saved question_top_matches.json ({len(question_top_matches)} questions)")

    # --- Per-note: aggregate coverage ---
    print("Computing per-note coverage stats...")
    weights = np.array([safe_weight(q) for q in questions])  # (N_questions,)

    note_coverage = []
    for n_idx, note in enumerate(notes):
        scores = sim_matrix[n_idx, :]   # (N_questions,)
        note_coverage.append({
            "note_file": note["file"],
            "note_folder": note["folder"],
            "note_heading": note["heading"],
            "note_callout": note.get("callout_header"),
            "weighted_coverage": float(np.sum(scores * weights)),
            "mean_similarity": float(np.mean(scores)),
            "max_similarity": float(np.max(scores)),
            "n_strong_matches": int(np.sum(scores >= STRONG_MATCH_THRESHOLD)),
        })

    note_coverage.sort(key=lambda x: x["weighted_coverage"], reverse=True)
    (RESULTS / "note_coverage.json").write_text(
        json.dumps(note_coverage, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"  Saved note_coverage.json ({len(note_coverage)} notes)")

    # --- Heatmap data: (folder, year, session) -> mean of per-question best-folder similarity ---
    print("Building heatmap data...")
    folders = sorted(set(n["folder"] for n in notes))
    years = sorted(set(q["year"] for q in questions))
    sessions = ["JUNE", "NOVEMBER"]

    # Build lookup: folder -> list of note indices
    folder_to_indices = defaultdict(list)
    for i, n in enumerate(notes):
        folder_to_indices[n["folder"]].append(i)

    heatmap_rows = []
    for year in years:
        for session in sessions:
            q_indices = [
                i for i, q in enumerate(questions)
                if q["year"] == year and q["session"] == session
            ]
            if not q_indices:
                continue
            for folder in folders:
                n_indices = folder_to_indices.get(folder, [])
                if not n_indices:
                    continue
                # sub-matrix: (notes_in_folder, questions_in_session)
                sub = sim_matrix[np.ix_(n_indices, q_indices)]
                # For each question: best matching note in this folder
                best_per_question = sub.max(axis=0)   # shape: (n_questions_in_session,)
                heatmap_rows.append({
                    "year": year,
                    "session": session,
                    "folder": folder,
                    "mean_max_similarity": float(best_per_question.mean()),
                    "n_questions": len(q_indices),
                })

    (RESULTS / "heatmap_data.json").write_text(
        json.dumps(heatmap_rows, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"  Saved heatmap_data.json ({len(heatmap_rows)} rows)")

    # --- Validation against existing chapter tags (2010-2019) ---
    print("\nValidating against existing chapter tags (2010-2019 questions)...")
    tagged_qs = [q for q in question_top_matches if q["chapters_tagged"]]

    top1_correct = 0
    top3_correct = 0
    n_matchable = 0

    for q in tagged_qs:
        expected_folders = set()
        for tag in q["chapters_tagged"]:
            folder = CHAPTER_TAG_TO_FOLDER.get(tag)
            if folder:
                expected_folders.add(folder)
        if not expected_folders:
            continue
        n_matchable += 1
        top_folders = [m["note_folder"] for m in q["top_matches"][:3]]
        if top_folders[0] in expected_folders:
            top1_correct += 1
        if any(f in expected_folders for f in top_folders):
            top3_correct += 1

    top1_acc = top1_correct / n_matchable if n_matchable else None
    top3_acc = top3_correct / n_matchable if n_matchable else None

    if n_matchable:
        print(f"  Top-1 accuracy: {top1_correct}/{n_matchable} = {top1_acc:.1%}")
        print(f"  Top-3 accuracy: {top3_correct}/{n_matchable} = {top3_acc:.1%}")
    else:
        print("  No matchable tagged questions found.")

    validation = {
        "n_tagged_questions": len(tagged_qs),
        "n_matchable": n_matchable,
        "top1_correct": top1_correct,
        "top3_correct": top3_correct,
        "top1_accuracy": top1_acc,
        "top3_accuracy": top3_acc,
        "note": (
            "A top-1 accuracy above ~50% on actuarial text with a general-purpose model "
            "is considered reasonable. Top-3 > 70% means the embeddings are working well."
        ),
    }
    (RESULTS / "validation_report.json").write_text(
        json.dumps(validation, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"  Saved validation_report.json")

    # --- Quick console summary ---
    print("\n=== TOP 10 MOST TESTED NOTE SECTIONS ===")
    for rank, row in enumerate(note_coverage[:10], 1):
        folder_num = row["note_folder"].split(".")[0].strip()
        print(
            f"  {rank:2d}. [{folder_num:>2}] {row['note_heading']:<50} "
            f"strong={row['n_strong_matches']:3d}  "
            f"weighted={row['weighted_coverage']:.1f}"
        )

    print("\n=== LEAST TESTED NOTE SECTIONS (bottom 10) ===")
    for row in note_coverage[-10:]:
        folder_num = row["note_folder"].split(".")[0].strip()
        print(
            f"       [{folder_num:>2}] {row['note_heading']:<50} "
            f"strong={row['n_strong_matches']:3d}  "
            f"weighted={row['weighted_coverage']:.1f}"
        )


if __name__ == "__main__":
    main()
