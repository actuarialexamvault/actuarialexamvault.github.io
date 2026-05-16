"""
Step 6: Generate a granular interactive heatmap.

Rows  = individual callout blocks (up to 532 note sections)
Cols  = individual exam questions  (filtered by --year / --session)

Colour = cosine similarity between that note block and that question.

Only rows with at least one similarity >= SHOW_THRESHOLD are shown
(to keep the chart readable).  Use --top N to show only the top N rows
by max similarity.

Usage:
    python 06_granular_heatmap.py [--year 2023] [--session NOVEMBER] [--top 60]

Output:
    results/granular_heatmap.html
"""

import argparse
import json
import numpy as np
from pathlib import Path

RESULTS = Path(__file__).parent / "results"
SHOW_THRESHOLD = 0.55   # row must have max >= this to appear
DEFAULT_TOP    = 60     # default: show top N rows by max similarity


def short_label(note: dict) -> str:
    """Compact row label: 'folder_num. heading — callout'"""
    folder_num = note["folder"].split(".")[0].strip()
    heading    = note.get("heading") or ""
    callout    = note.get("callout_header") or ""
    if callout and callout != heading:
        return f"[{folder_num}] {heading} — {callout}"
    return f"[{folder_num}] {heading}"


def main():
    parser = argparse.ArgumentParser(description="Granular note-block × question heatmap")
    parser.add_argument("--year",      help="Filter questions to a specific year, e.g. 2023")
    parser.add_argument("--session",   help="Filter questions to a session: JUNE or NOVEMBER")
    parser.add_argument("--top",       type=int, default=DEFAULT_TOP,
                        help=f"Show only the top N rows by max similarity (default {DEFAULT_TOP})")
    parser.add_argument("--threshold", type=float, default=SHOW_THRESHOLD,
                        help=f"Min max-similarity for a row to appear (default {SHOW_THRESHOLD})")
    args = parser.parse_args()

    # --- Load data ---
    for name in ["notes_data.json", "questions_data.json", "similarity_matrix.npy"]:
        if not (RESULTS / name).exists():
            raise FileNotFoundError(f"{name} not found. Run the pipeline first.")

    notes     = json.loads((RESULTS / "notes_data.json").read_text(encoding="utf-8"))
    questions = json.loads((RESULTS / "questions_data.json").read_text(encoding="utf-8"))
    sim_full  = np.load(str(RESULTS / "similarity_matrix.npy"))   # (N_notes, N_questions_all)

    # Filter questions if requested
    qs = questions
    if args.year:
        qs = [q for q in qs if q["year"] == args.year]
    if args.session:
        qs = [q for q in qs if q["session"].upper() == args.session.upper()]

    if not qs:
        raise ValueError(f"No questions found for year={args.year} session={args.session}. "
                         "Check that the pipeline was run with the same filter.")

    # Build column indices matching the full questions list
    all_ids   = [q["id"] for q in questions]
    filt_ids  = [q["id"] for q in qs]
    col_idxs  = [all_ids.index(qid) for qid in filt_ids]

    sim = sim_full[:, col_idxs]   # (N_notes, N_filtered_questions)

    # --- Filter rows ---
    max_sim_per_row = sim.max(axis=1)
    row_mask        = max_sim_per_row >= args.threshold
    sim_filtered    = sim[row_mask]
    notes_filtered  = [n for n, keep in zip(notes, row_mask) if keep]

    # Sort by mean similarity descending (= most consistently tested blocks), take top N
    order = np.argsort(sim_filtered.mean(axis=1))[::-1][: args.top]
    sim_top    = sim_filtered[order]
    notes_top  = [notes_filtered[i] for i in order]

    print(f"Notes shown: {len(notes_top)} / {len(notes)}  "
          f"(threshold={args.threshold}, top={args.top})")
    print(f"Questions:   {len(qs)}")

    # --- Build column labels ---
    col_labels = [f"Q{q['question']} {q['year']} {q['session'][:3]}" for q in qs]

    # --- Row labels (ranked) ---
    row_labels = [f"#{i+1} {short_label(n)}" for i, n in enumerate(notes_top)]

    # --- Build Plotly heatmap ---
    try:
        import plotly.graph_objects as go
    except ImportError:
        raise ImportError("plotly not installed. Run: pip install plotly")

    z = sim_top.tolist()

    # Hover text: include folder name and callout header for context
    hover = []
    for n in notes_top:
        folder  = n.get("folder", "")
        heading = n.get("heading", "")
        callout = n.get("callout_header") or ""
        hover.append(f"{folder}<br>{heading}<br>{callout}" if callout else f"{folder}<br>{heading}")

    customdata = [[hover[ri]] * len(col_labels) for ri in range(len(notes_top))]

    fig = go.Figure(data=go.Heatmap(
        z=z,
        x=col_labels,
        y=row_labels,
        colorscale="RdYlBu_r",
        zmin=0.45,
        zmax=0.85,
        text=[[f"{v:.2f}" for v in row] for row in z],
        texttemplate="%{text}",
        textfont={"size": 7},
        hoverongaps=False,
        customdata=customdata,
        hovertemplate=(
            "<b>%{customdata}</b><br>"
            "Question: %{x}<br>"
            "Similarity: %{z:.3f}<extra></extra>"
        ),
        colorbar=dict(
            title="Cosine<br>similarity",
            thickness=15,
            tickformat=".2f",
        ),
    ))

    # Dynamic height: ~18px per row, min 500
    height = max(500, len(notes_top) * 18 + 200)

    fig.update_layout(
        title=dict(
            text=(
                "F102 — Granular Note Block × Question Similarity (ranked by mean similarity)<br>"
                f"<sup>Showing top {len(notes_top)} note sections by max similarity"
                + (f" | {args.year} {args.session}" if args.year or args.session else "")
                + "</sup>"
            ),
            font=dict(size=14),
        ),
        xaxis=dict(
            title="Exam Question",
            tickangle=-45,
            tickfont=dict(size=10),
            side="top",
        ),
        yaxis=dict(
            title="Note section (callout block)",
            autorange="reversed",
            tickfont=dict(size=9),
        ),
        height=height,
        width=max(800, len(qs) * 90 + 550),
        margin=dict(l=420, r=100, t=130, b=60),
        font=dict(size=10),
        plot_bgcolor="white",
    )

    out_path = RESULTS / "granular_heatmap.html"
    fig.write_html(str(out_path), include_plotlyjs="cdn")
    print(f"  Saved -> {out_path}")
    print("  Open in browser.")


if __name__ == "__main__":
    main()
