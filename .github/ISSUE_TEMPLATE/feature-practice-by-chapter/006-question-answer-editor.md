title: Question & Answer page with embedded Markdown editor, autosave, and timed sessions

body: |
  Summary
  -------
  Add a Question & Answer page that displays a selected question (rendered from pre-extracted Markdown) alongside an embedded Markdown editor where the user writes their answer. The editor should autosave drafts and support a timed session where the allocated time is derived from the question's mark allocation (minutes = marks * 1.8).

  Goals
  -----
  - Display question content (Markdown) fetched from `resources/markdown_questions/...`.
  - Provide an embedded Markdown editor with syntax highlighting and a live preview.
  - Autosave drafts locally (IndexedDB or localStorage) at regular intervals and on change.
  - Timer automatically sets duration = marks * 1.8 minutes and counts down during an active session.
  - Optionally allow manual start/stop for practice mode and full 'exam' mode that locks editing when time expires.

  Implementation notes
  --------------------
  - Use a lightweight client-side Markdown editor (e.g., SimpleMDE or a minimal in-house textarea + marked.js) to avoid heavy dependencies.
  - Store drafts per-user and per-question using a key like `draft_{userId}_{subject}_{year}_{session}_P{paper}_Q{question}` in IndexedDB for reliability. Provide localStorage fallback for browsers without IndexedDB.
  - Autosave strategy: debounce on input (e.g., 1s) and then persist; also save on visibility change and beforeunload.
  - Timer behavior:
    - Compute total minutes = Math.round(marks * 1.8).
    - Show remaining time prominently; persist session start time so refreshing doesn't reset progress.
    - On time expiry in exam mode, lock the editor and optionally prompt to upload/submit.
  - Offline considerations: editor works offline with cached Markdown; syncing submissions requires being online.

  Acceptance criteria
  -------------------
  - Opening `question-grading.html?subject=F102&session=Jun&year=2010&paper=1&question=Q1` shows the question and an editor on the same page.
  - Drafts autosave and persist across reloads; timer resumes after refresh and locks the editor when time expires in exam mode.
  - A user can manually save/export their answer (download as .md or .docx) and/or upload it via existing submission workflow.

  PR checklist
  ------------
  - [ ] Add `js/question-editor.js` implementing the editor, autosave, and timer logic.
  - [ ] Add UI to `pages/question-grading.html` to include editor and preview area.
  - [ ] Use IndexedDB helper (`indexeddb-storage.js`) for draft persistence; add migration/fallback logic.
  - [ ] Add unit tests for timer calculations and autosave debounce logic.
  - [ ] Update docs in `resources/practice/README.md` describing editor behavior and offline notes.
  - [ ] The Webapp should check if the user finished the question within the time limit by checking the countdown timer and keep a record of record time finishes vs going over time on questions. This will be a good statistics for giving feedback to the student. 


labels: enhancement, frontend, ux, backend
