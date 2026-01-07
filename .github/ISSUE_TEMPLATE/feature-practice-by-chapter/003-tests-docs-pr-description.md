title: Add tests, documentation, and PR description for Practice-by-Chapter

body: |
  Summary
  -------
  Create tests, documentation, and a clear PR description for the Practice-by-Chapter feature.

  Goals
  -----
  - Add unit tests covering the mapping loader and availability logic.
  - Add an integration smoke test that verifies the practice page can load the chapter map and show availability badges.
  - Update `README.md` with a short section describing the Practice-by-Chapter feature and how to extend chapter mappings.
  - Prepare a PR description template that lists implemented features, how to test, and known limitations.

  Acceptance criteria
  -------------------
  - New tests exist under `tests/` and run with the project's test command (or provide a small `pytest` harness if none exists).
  - `README.md` contains a Practice-by-Chapter section.
  - A ready-to-use PR description is available in `.github/PR_DESCRIPTIONS/practice_by_chapter.md`.

  Labels: docs, testing, ci
