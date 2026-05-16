"""
Step 5: Generate human-readable reports and an interactive heatmap.

Requires outputs from step 4.

Outputs:
  results/question_top_matches.csv   per-question top-5 note matches (flat CSV)
  results/note_coverage.csv          per-note coverage stats, sorted by exam weight
  results/temporal_trends.csv        topic folder x year similarity scores
  results/topic_heatmap.html         interactive plotly heatmap (open in browser)
"""

import csv
import json
from pathlib import Path
from collections import defaultdict

RESULTS = Path(__file__).parent / "results"


def write_csv(path: Path, rows: list, fieldnames: list):
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    print(f"  Saved {path.name} ({len(rows)} rows)")


def main():
    for name in ["question_top_matches.json", "note_coverage.json", "heatmap_data.json"]:
        if not (RESULTS / name).exists():
            raise FileNotFoundError(
                f"{name} not found. Run 04_analyse.py first."
            )

    question_matches = json.loads((RESULTS / "question_top_matches.json").read_text(encoding="utf-8"))
    note_coverage = json.loads((RESULTS / "note_coverage.json").read_text(encoding="utf-8"))
    heatmap_data = json.loads((RESULTS / "heatmap_data.json").read_text(encoding="utf-8"))

    # --- 1. question_top_matches.csv ---
    # Flat table: one row per (question, rank) pair
    q_rows = []
    for q in question_matches:
        for match in q["top_matches"]:
            q_rows.append({
                "question_id":    q["id"],
                "year":           q["year"],
                "session":        q["session"],
                "question":       q["question"],
                "chapters_tagged": "; ".join(q["chapters_tagged"]),
                "rank":           match["rank"],
                "note_folder":    match["note_folder"],
                "note_heading":   match["note_heading"],
                "note_callout":   match.get("note_callout") or "",
                "note_file":      match["note_file"],
                "similarity":     f"{match['similarity']:.4f}",
            })
    write_csv(
        RESULTS / "question_top_matches.csv",
        q_rows,
        ["question_id", "year", "session", "question", "chapters_tagged",
         "rank", "note_folder", "note_heading", "note_callout", "note_file", "similarity"],
    )

    # --- 2. note_coverage.csv ---
    cov_rows = [
        {
            "note_folder":            r["note_folder"],
            "note_heading":           r["note_heading"],
            "note_callout":           r.get("note_callout") or "",
            "note_file":              r["note_file"],
            "weighted_coverage":      f"{r['weighted_coverage']:.2f}",
            "mean_similarity":        f"{r['mean_similarity']:.4f}",
            "max_similarity":         f"{r['max_similarity']:.4f}",
            "n_strong_matches":       r["n_strong_matches"],
        }
        for r in note_coverage
    ]
    write_csv(
        RESULTS / "note_coverage.csv",
        cov_rows,
        ["note_folder", "note_heading", "note_callout", "note_file",
         "weighted_coverage", "mean_similarity", "max_similarity", "n_strong_matches"],
    )

    # --- 3. temporal_trends.csv ---
    trend_rows = [
        {
            "folder":               r["folder"],
            "year":                 r["year"],
            "session":              r["session"],
            "mean_max_similarity":  f"{r['mean_max_similarity']:.4f}",
            "n_questions":          r["n_questions"],
        }
        for r in sorted(heatmap_data, key=lambda x: (x["folder"], x["year"], x["session"]))
    ]
    write_csv(
        RESULTS / "temporal_trends.csv",
        trend_rows,
        ["folder", "year", "session", "mean_max_similarity", "n_questions"],
    )

    # --- 4. Interactive heatmap ---
    try:
        import plotly.graph_objects as go
    except ImportError:
        print("  plotly not installed — skipping heatmap. Run: pip install plotly")
        return

    # Build pivot: folders (y) x year-session (x) -> mean_max_similarity
    year_sessions = sorted(set(f"{r['year']} {r['session'][:3]}" for r in heatmap_data))

    # Rank folders by mean similarity across all year-sessions (highest = most tested)
    from collections import defaultdict as _dd
    _folder_scores = _dd(list)
    for r in heatmap_data:
        _folder_scores[r["folder"]].append(r["mean_max_similarity"])
    folders = sorted(
        _folder_scores.keys(),
        key=lambda f: sum(_folder_scores[f]) / len(_folder_scores[f]),
        reverse=True,
    )

    score_lookup = {
        (r["folder"], f"{r['year']} {r['session'][:3]}"): r["mean_max_similarity"]
        for r in heatmap_data
    }

    z = [
        [score_lookup.get((f, ys), 0.0) for ys in year_sessions]
        for f in folders
    ]

    # Dynamic colour scale: use 5th/95th percentile of non-zero values
    # so the full palette is spread across the actual data range.
    all_vals = [v for row in z for v in row if v > 0]
    all_vals_sorted = sorted(all_vals)
    p5_idx  = max(0, int(len(all_vals_sorted) * 0.05))
    p95_idx = min(len(all_vals_sorted) - 1, int(len(all_vals_sorted) * 0.95))
    z_lo = all_vals_sorted[p5_idx]
    z_hi = all_vals_sorted[p95_idx]

    fig = go.Figure(data=go.Heatmap(
        z=z,
        x=year_sessions,
        y=folders,
        colorscale="RdYlBu_r",
        zmin=round(z_lo, 3),
        zmax=round(z_hi, 3),
        text=[[f"{v:.2f}" for v in row] for row in z],
        texttemplate="%{text}",
        textfont={"size": 8},
        hoverongaps=False,
        hovertemplate=(
            "<b>%{y}</b><br>"
            "%{x}<br>"
            "Similarity: %{z:.3f}<extra></extra>"
        ),
        colorbar=dict(
            title="Mean<br>similarity",
            thickness=15,
            tickformat=".3f",
        ),
    ))

    fig.update_layout(
        title=dict(
            text="F102 Exam Topic Coverage — Similarity of Exam Questions to Obsidian Note Sections",
            font=dict(size=14),
        ),
        xaxis=dict(
            title="Year / Session",
            tickangle=-60,
            tickfont=dict(size=10),
        ),
        yaxis=dict(
            title="Topic (Obsidian folder) — ranked by mean similarity",
            autorange="reversed",
            tickfont=dict(size=10),
        ),
        height=900,
        width=1500,
        margin=dict(l=320, r=100, t=80, b=130),
        font=dict(size=11),
        plot_bgcolor="white",
    )

    html_path = RESULTS / "topic_heatmap.html"
    fig.write_html(str(html_path), include_plotlyjs="cdn")
    print(f"  Saved topic_heatmap.html  (open in browser)")

    # --- Console summary ---
    print("\n=== TOP 10 MOST TESTED NOTE SECTIONS (by exam weight) ===")
    for rank, row in enumerate(note_coverage[:10], 1):
        folder_num = row["note_folder"].split(".")[0].strip()
        print(
            f"  {rank:2d}. [{folder_num:>2}] {row['note_heading']:<52} "
            f"strong_matches={row['n_strong_matches']:3d}  "
            f"weighted={float(row['weighted_coverage']):6.1f}"
        )

    print("\n=== LEAST TESTED NOTE SECTIONS (bottom 10) ===")
    for row in note_coverage[-10:]:
        folder_num = row["note_folder"].split(".")[0].strip()
        print(
            f"       [{folder_num:>2}] {row['note_heading']:<52} "
            f"strong_matches={row['n_strong_matches']:3d}  "
            f"weighted={float(row['weighted_coverage']):6.1f}"
        )

    # Folder-level summary
    print("\n=== TOPIC FOLDER RANKING (by total weighted coverage) ===")
    folder_totals = defaultdict(float)
    for row in note_coverage:
        folder_totals[row["note_folder"]] += float(row["weighted_coverage"])
    for rank, (folder, total) in enumerate(
        sorted(folder_totals.items(), key=lambda x: x[1], reverse=True), 1
    ):
        print(f"  {rank:2d}. {folder:<55} {total:8.1f}")


if __name__ == "__main__":
    main()
