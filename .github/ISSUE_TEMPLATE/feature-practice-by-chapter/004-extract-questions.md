title: Extract questions from past papers — build-time vs runtime (recommendation)

body: |
  Summary
  -------
  We need to extract individual questions from past paper PDFs so Practice-by-Chapter can show the exact question text (rendered as Markdown). Two approaches were proposed:

  1. Pre-extract at build-time: download PDFs and convert each question into a standalone Markdown file (saved in the repo or in resources/markdown_questions/...).
  2. Extract on demand at runtime: parse the PDF in the browser (or call a server-side extractor) and render question text when requested.

  Recommendation
  --------------
  Choose approach (1) — pre-extract questions at build time and store them as per-question Markdown.

  Rationale (why build-time)
  --------------------------
  - Performance: Clients can fetch small Markdown chunks quickly; rendering is instant and works offline/with weak connections.
  - Complexity: Avoids brittle and heavy client-side PDF parsing and heuristics in the browser; parsing and OCR (if needed) are done once during build.
  - Stability & testability: Extractor scripts run in a controlled environment where failures can be retried, inspected, and fixed (e.g., adjust regexes, OCR settings).
  - Searchability and indexing: Pre-extracted Markdown is easy to index (for search or full-text features) and to version-control.
  - Caching: No repeated CPU/IO costs for users; storage cost is the only trade-off.

  Trade-offs and considerations
  ----------------------------
  - Storage: The repo (or `resources/`) will grow as Markdown files are added. Mitigation: compress or keep only derived data in a `resources/markdown_questions/` folder and exclude extremely large auxiliary files from the repo (or use a release/asset store).
  - Build-time work: Regeneration is required when new PDFs are added; mitigations: incremental scripts that only process new/changed PDFs.
  - Extraction quality: Some PDFs may require OCR or manual post-editing. The extractor should provide a `--verify` mode and produce diagnostics indicating questionable segments.

  Hybrid option
  -------------
  If minimizing repo size is a priority, a hybrid approach can be used: server-side on-demand extraction with caching. This keeps the client lightweight and avoids storing all extracted content in the repo, but requires a server component (and hosting) and adds latency on first-request.

  Implementation plan (build-time)
  --------------------------------
  1. Reuse/extend existing tooling in `resources/pdfs/convert_pdf_to_markdown.py` (or create `tools/extract_questions.py`) to:
     - Take a PDF path and a paper identifier (subject/session/year/paper).
     - Convert the PDF to Markdown (or text) and split it into question blocks using heuristics (e.g., detect lines starting with `Q1`, `Question 1`, or large numbered headings). The CSV mapping you already have (F102_question_papers_melted.csv) helps correlate which page/section contains which question and can be used to verify splits.
     - Output per-question Markdown files named like `resources/markdown_questions/F102/Jun-2010_Paper1_Q1.md` with a small YAML frontmatter containing metadata { subject, session, year, paper, question, chapter(s) }.
  2. Add a small manifest `resources/markdown_questions/manifest_F102.json` listing all generated files and metadata for fast lookup (and to avoid scanning directories at runtime).
  
   1a. Repurpose `resources/pdfs/download_papers.py` (or add a wrapper) so the extractor can reliably download PDFs using `resources/pdfs/exam_links.json` and `resources/pdfs/memo-links.json` as inputs. The downloader should produce a predictable directory layout and support `--force` and retry logging.
  3. Add a smoke-test script `tools/tests/test_extract_questions.py` that runs the extractor on a small sample and asserts the generated Markdown contains non-empty content and expected metadata.
  4. Frontend wiring:
     - Add `js/question-fetcher.js` that fetches the per-question Markdown via simple fetch and renders it (Markdown -> HTML) using the existing site styles (or a lightweight client-side Markdown renderer like marked.js if not already present).
     - Improve `pages/practice.html` / `js/practice-script.js` so each mapped paper/question has a "View question" button that fetches and displays the Markdown in a modal or side panel.
  5. Documentation: `resources/practice/README.md` describing regeneration steps and any manual post-edit steps for problematic PDFs.

  Acceptance criteria
  -------------------
  - The repo contains generated per-question Markdown for F102 (or a guideline to generate them) and a manifest.
  - Opening a chapter->paper->question in `pages/practice.html?subject=F102` displays the rendered question quickly (client-side fetch + render).
  - Tests for the extractor pass locally.

  PR checklist
  ------------
  - [ ] `tools/extract_questions.py` (or extend existing converter).
  - [ ] `resources/markdown_questions/F102/...` generated Markdown files (or a small sample + script to generate the rest).
  - [ ] `resources/markdown_questions/manifest_F102.json`.
  - [ ] `js/question-fetcher.js` and UI updates to `pages/practice.html`.
  - [ ] Tests and `resources/practice/README.md`.
   - [ ] Repurpose `resources/pdfs/download_papers.py` to download source PDFs from `exam_links.json`/`memo-links.json`.

labels: decision, enhancement, backend, frontend
