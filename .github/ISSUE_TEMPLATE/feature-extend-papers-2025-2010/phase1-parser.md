---
name: "Phase 1: Robust parser for js/pdf-links.js extraction"
about: "Replace brittle regex extraction with a tolerant parser to avoid re-checking existing links." 
title: "[backend][med] Phase1: Robust parser for js/pdf-links.js extraction"
labels: backend, enhancement
assignees: ""
---

Summary
-------
Improve parsing of `js/pdf-links.js` so the scripts reliably extract existing links and avoid re-checking them.

Scope (MVP)
- Implement a tolerant parser that extracts subject/session/year/paper -> URL entries.
- Consider converting the JS object to JSON for easier parsing.

Acceptance criteria
- [ ] Existing links are correctly detected for multiple subjects including A311 and F102.
- [ ] No false negatives due to parsing errors.

Tasks
- [ ] Implement parser, add tests against current `js/pdf-links.js`.
- [ ] Replace existing load_existing_links() with new parser.

Estimate: M
