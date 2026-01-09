---
name: "Feature: Timed Exam Simulator with Focus Mode"
about: "Integrate existing timer, focus-mode, tab-switch warnings, and upload reminders."
title: "[feature][high] Timed Exam Simulator with Focus Mode"
labels: feature, frontend, high-priority
assignees: ""
---

## Summary

Refined Timed Exam Simulator: integrate the existing countdown timer into an exam flow that supports focus-mode, tab-switch warnings, prominent '5 minutes remaining' alerts, and an explicit upload/reminder workflow for users to author answers externally (e.g., MS Word). 

## Why

Practicing under exam-like conditions increases familiarity with timing pressures and improves time management. Focus mode reduces distractions and the timeout alerts help users practice finishing under constrained time, which is proven to improve exam performance.

## Scope (MVP)

- Integrate existing countdown timer into the start-exam flow.
- Provide a focus-mode toggle to hide header/nav and non-essential UI during the exam.
- Show tab-switch warnings (toast) when visibility changes; optionally count switches for analytics.
- Display a prominent 5-minute remaining banner and optional audio cue.
- Show an explicit Upload Reminder CTA before and after the exam session; provide a clear post-exam upload flow.
- On timeout: record session metadata (start, end, duration, status) and show upload instructions. Do NOT attempt to capture answer text in-browser.

## Acceptance criteria

- [ ] The existing timer integrates with the exam start/stop flow and remains visible during the session.
- [ ] Focus-mode hides non-essential UI and can be toggled at exam start.
- [ ] Tab switches show a one-time visual warning; repeated switches are tracked (optional).
- [ ] A prominent 5-minute remaining banner appears with optional audio cue.
- [ ] Before the exam starts, a reminder explains that answers are written externally and the user will need to upload a file after submission.
- [ ] After timeout or manual submission, the UI shows a clear Upload call-to-action and a saved/submitted state with timestamp; session metadata persists to Firestore.
- [ ] Unit tests cover timer integration, visibility/tab-switch behavior, and the upload/reminder flow.

## Implementation notes

- Data: store session metadata (startTime, duration, status, events count) in localStorage under `examSession:{uid}:{paperId}`; persist final metadata to Firestore at `users/{uid}/attempts/{attemptId}`. Do NOT store answer content.
- Integrate with existing timer module (do not reimplement core timing logic). Create `js/exam-simulator.js` to orchestrate focus-mode, visibility hooks, and upload prompts.
- Use Page Visibility API for tab-switch detection, Notification API for optional reminders, and beforeunload to warn on accidental close.
- UI changes primarily on `pages/exam.html` (or paper runner) and small CSS additions in `css/styles.css`.

## Tasks

- [ ] Design: wireframe compact exam view and upload CTA.
- [ ] Integrate: hook existing timer into the exam start/stop lifecycle.
- [ ] Implement: focus-mode CSS & toggle, visibility handlers and switch counting.
- [ ] Notifications: 5-minute banner + optional audio cue.
- [ ] Upload flow: pre/post exam reminder and final upload CTA; save metadata to Firestore.
- [ ] Tests: add unit tests for integration points and upload reminder behavior.
- [ ] Docs: update README with the refined flow and user guidance.

## Estimate

- Size: M (one sprint)

## Notes

- Autosave of full answer text is intentionally omitted because authors use external editors. If later a browser-based editor is added, autosave can be revisited.
- Clarify policy on early submissions (e.g., preventing submissions within first X minutes) before implementing restrictions.

---

Use this template to create a focused issue that matches current app behaviour and user workflows.


