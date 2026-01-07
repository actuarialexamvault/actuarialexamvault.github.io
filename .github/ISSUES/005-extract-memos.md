title: Download and extract examiner reports (memos) — build-time extraction

body: |
  Summary
  -------
  Extract examiner reports (memos) and make solution content available in the Practice-by-Chapter flow. The goal is to download memos referenced in `resources/pdfs/memo-links.json` and extract useful solution text per question or per paper.

  Recommendation
  --------------
  Perform build-time extraction (same rationale as question extraction): download memos, convert to Markdown, split into solution blocks per question where feasible, and create a manifest for fast lookup.

  Goals
  -----
  - Download examiner reports using `resources/pdfs/memo-links.json` as input (repurpose `resources/pdfs/download_papers.py` or add a wrapper).
  - Convert memos to Markdown and split them into per-question solution files where the memo structure allows.
  - Store memos/solutions under `resources/memos_markdown/<subject>/...` and generate `resources/memos_markdown/manifest_<subject>.json`.

  Implementation steps
  --------------------
  1. Repurpose `resources/pdfs/download_papers.py` (or write `tools/download_memos.py`) to download memo PDFs referenced in `memo-links.json` into `resources/pdfs/memos/<subject>/<session>-<year>/`.
  2. Reuse or extend `tools/extract_questions.py` (or create `tools/extract_memos.py`) to:
     - Convert memo PDFs to Markdown.
     - Attempt to split by question using heuristics (e.g. matching question numbers or known question headings). If granular splitting fails, at minimum create per-paper memo Markdown files.
     - Produce per-question solution files where possible: `resources/memos_markdown/F102/Jun-2010_Paper1_Q1_solution.md` with YAML frontmatter linking to question metadata.
  3. Create `resources/memos_markdown/manifest_F102.json` mapping paper->question->solution file path for fast lookup.
  4. Frontend wiring: add `js/memo-fetcher.js` (or extend existing `js/memo-links.js`) to fetch memo Markdown and render it alongside the question in the Practice UI.
  5. Add tests and QA: smoke tests to ensure solutions are non-empty and manifest entries resolve to files.

  Acceptance criteria
  -------------------
  - Examiner reports are downloaded and stored under `resources/pdfs/memos/`.
  - Per-paper or per-question Markdown solutions exist in `resources/memos_markdown/` with a manifest.
  - Practice UI can fetch and render memo content for mapped questions/papers.

  PR checklist
  ------------
  - [ ] `tools/download_memos.py` (or repurpose `download_papers.py`).
  - [ ] `tools/extract_memos.py` to convert memos to Markdown and split where possible.
  - [ ] `resources/memos_markdown/<subject>/...` generated files and `manifest_<subject>.json`.
  - [ ] `js/memo-fetcher.js` and UI integration.
  - [ ] Tests and `resources/practice/README.md` updates describing memo extraction.

labels: enhancement, backend, data, frontend
