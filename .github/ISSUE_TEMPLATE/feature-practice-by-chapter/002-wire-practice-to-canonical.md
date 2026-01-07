title: Wire Practice page to canonical `exam_links.json`

body: |
  Summary
  -------
  Connect the Practice-by-Chapter page to the canonical `resources/pdfs/exam_links.json` so it can show available PDFs for chapters.

  Goals
  -----
  - Load `resources/pdfs/exam_links.json` at runtime (reuse `js/pdf-links.js` or similar).
  - Define a mapping format for chapter → list of (subject, session, year, paper, question-range) entries.
  - Provide an API or small JSON file `resources/practice/chapter_map.json` to store chapter mappings.
  - Show availability badges based on whether PDF/memo exists for mapped items.

  Acceptance criteria
  -------------------
  - `pages/practice.html` displays items with PDF availability.
  - A sample `resources/practice/chapter_map.json` is included for one subject as an example.

  Notes
  -----
  - If automatic mapping generation is desired, create a separate tool to analyze past-paper questions and tag them by chapter; this is out of scope for this task but should be tracked.

  Labels: enhancement, backend, data
