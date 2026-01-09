---
name: "Phase 1: Add CLI args --start-year/--end-year and config"
about: "Make the smart check scripts parameterised so they accept a year range, subjects and delay settings." 
title: "[backend][med] Phase1: Add CLI flags (--start-year/--end-year, --subjects, --delay)"
labels: backend, enhancement, medium-priority
assignees: ""
---

Summary
-------
Add CLI flags to `check_papers_smart.py` and `check_examiners_reports_smart.py` so scripts can be run for custom year ranges and subject subsets without editing the source.

Scope (MVP)
- Add argparse with `--start-year`, `--end-year`, `--subjects` (comma-separated), `--delay-ms`, `--dry-run`.
- Default behaviour remains the same if flags are omitted.

Acceptance criteria
- [ ] Scripts accept the new flags and print helpful usage messages.
- [ ] Default run equals current behaviour (years 2025–2018).
- [ ] Add unit test for argument parsing.

Tasks
- [ ] Add argparse boilerplate to both scripts.
- [ ] Validate input ranges and provide clear errors.
- [ ] Add `--dry-run` path that builds candidates but does not make network requests.

Estimate: S
