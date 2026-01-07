---
name: "Epic: Extend past-paper coverage to 2010–2025"
about: "Parent epic tracking Phase 1 (scraper/pdf-links) and Phase 2 (UI) work to extend coverage to 2010–2025."
title: "[epic][high] Extend past-paper coverage to 2010–2025 (Phases: Scraping → UI)"
labels: epic, high-priority, data
assignees: ""
---

Summary
-------
This epic coordinates work to extend the repository's past-paper coverage from the current range up to 2018–2025 so it includes 2010–2025. Work is split into two phases:

- Phase 1: Pdf links & scraping updates — make the scripts robust, parameterised, and able to discover links across 2010–2025.
- Phase 2: UI updates — surface the newly-discovered years and handle missing papers gracefully.

Acceptance criteria
-------------------
- Phase 1 issues created and completed (CLI, URL generation, parsing, robust network checks, manifests, tests).
- Phase 2 issues created and completed (UI year enumeration, missing-state handling, integration tests).
- A run for one subject (A311) yields a verified manifest for 2010–2025.
- PR(s) merge scripts + small UI changes and updated README documenting year coverage.

Child issues (suggested order)
-----------------------------
Phase 1 (Scraping & pdf-links)
1. `--start-year/--end-year` CLI and config
2. URL filename generator & month-folder heuristics
3. Robust parser for `js/pdf-links.js` (existing link extraction)
4. check_url improvements (HEAD→GET fallback, retries, delay/backoff)
5. Structured JSON manifest output and optional js fragment
6. Tests & dry-run mode

Phase 2 (UI)
7. Expand year lists to 2010–2025 and manifest-driven UI
8. Graceful missing-state UI and tests
9. Docs & PR notes

Estimate: L (epic)
