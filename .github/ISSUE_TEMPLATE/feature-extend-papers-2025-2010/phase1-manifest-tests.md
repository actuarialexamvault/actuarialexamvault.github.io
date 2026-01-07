---
name: "Phase 1: Structured JSON manifest output + tests"
about: "Save results in JSON manifests and add tests/dry-run mode for safe runs." 
title: "[backend][med] Phase1: Structured JSON manifest output + tests"
labels: backend, testing, medium-priority
assignees: ""
---

Summary
-------
Produce structured JSON manifests for discovered PDF links and add tests/dry-run mode so runs are safe and automatable.

Acceptance criteria
- [ ] Scripts save `resources/pdfs/new_links_{start}_{end}.json` with structured records.
- [ ] `--dry-run` option builds candidate URL manifests without network requests.
- [ ] Unit tests validate parsing, URL generation, and manifest schema.

Tasks
- [ ] Implement manifest writer and dry-run mode.
- [ ] Add unit tests using pytest and fixtures.

Estimate: M
