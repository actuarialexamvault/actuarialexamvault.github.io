---
name: "Phase 1: Improve check_url (retries, HEAD→GET fallback, delay/backoff)"
about: "Make HTTP checking more robust and polite to remote servers." 
title: "[backend][small] Phase1: Improve check_url (retries, HEAD→GET fallback, delay/backoff)"
labels: backend, small
assignees: ""
---

Summary
-------
Improve the `check_url()` helper to retry failures with exponential backoff, try GET when HEAD fails or is disallowed, and support a configurable delay between requests.

Acceptance criteria
- [ ] check_url retries transient errors up to N times and uses exponential backoff.
- [ ] HEAD fallback to GET when appropriate.
- [ ] Scripts accept `--delay-ms` to sleep between requests to the site.

Tasks
- [ ] Implement retry/backoff and GET fallback.
- [ ] Add tests with mocked responses.

Estimate: S
