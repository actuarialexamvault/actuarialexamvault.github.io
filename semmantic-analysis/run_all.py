"""
Runs the full semantic analysis pipeline end-to-end.

Steps:
  1. Load & clean Obsidian notes
  2. Load & clean exam questions
  3. Embed with BAAI/bge-large-en-v1.5  (skipped if cache is current)
  4. Compute similarity matrix & analysis
  5. Generate CSV reports & interactive heatmap

Usage:
  cd semmantic-analysis
  python run_all.py

  # Skip the embedding step (if model not yet available):
  python run_all.py --skip-embed

Dependencies:
  pip install sentence-transformers numpy pyyaml plotly
"""

import subprocess
import sys
from pathlib import Path

BASE = Path(__file__).parent

SCRIPTS = [
    "01_load_notes.py",
    "02_load_questions.py",
    "03_embed.py",
    "04_analyse.py",
    "05_report.py",
    "09_question_similarity.py",
    "10_cluster_review.py",
]


def run_script(script: str, extra_args: list = []):
    print(f"\n{'=' * 62}")
    print(f"  {script}" + (f"  {' '.join(extra_args)}" if extra_args else ""))
    print(f"{'=' * 62}")
    result = subprocess.run(
        [sys.executable, str(BASE / script)] + extra_args,
        check=False,
    )
    if result.returncode != 0:
        print(f"\nERROR: {script} failed (exit code {result.returncode}). Stopping.")
        sys.exit(1)


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Run semantic analysis pipeline")
    parser.add_argument("--skip-embed", action="store_true", help="Skip the embedding step")
    parser.add_argument("--year",    help="Filter questions to a specific year, e.g. 2012")
    parser.add_argument("--session", help="Filter questions to a specific session: JUNE or NOVEMBER")
    args = parser.parse_args()

    # Build optional filter args to pass to 02_load_questions.py
    filter_args = []
    if args.year:
        filter_args += ["--year", args.year]
    if args.session:
        filter_args += ["--session", args.session]

    label = ""
    if args.year or args.session:
        label = f" [{args.year or 'all'} {args.session or 'all'}]"
    if label:
        print(f"Filtering to:{label}")

    for script in SCRIPTS:
        if args.skip_embed and script == "03_embed.py":
            print(f"\nSkipping {script} (--skip-embed flag)")
            continue
        # Pass filter args only to the question loader
        extra = filter_args if script == "02_load_questions.py" else []
        run_script(script, extra)

    print("\n" + "=" * 62)
    print(f"  Pipeline complete!{label}")
    print(f"  Results in: {BASE / 'results'}")
    print("  Open results/topic_heatmap.html in a browser.")
    print("=" * 62)


if __name__ == "__main__":
    main()
