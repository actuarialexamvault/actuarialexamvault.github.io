---
name: "Phase 1: URL filename generator & month-folder heuristics"
about: "Generate candidate filename permutations and try month/year upload folders to find archived PDFs." 
title: "[backend][med] Phase1: URL filename generator & month-folder heuristics"
labels: backend, enhancement
assignees: ""
---

Summary
-------
Replace the hard-coded URL patterns with a generator that yields likely filename variants and constructs candidate URLs across possible upload-month folders and formats.

Scope (MVP)
- Implement `build_candidate_urls(subject, session, year, paper)` that yields full candidate URLs.
- Try multiple month folders (try no-month, 01..12, plausible months 06/07/11/12 first).

Acceptance criteria
- [ ] Candidate generator covers existing observed filename patterns.
- [ ] Scripts can find older files that previously failed when month folder was missing/changed.

Tasks
- [ ] Implement generator and add unit tests for common cases.
- [ ] Update scripts to use generator instead of static lists.

Estimate: M
