title: Implement frontend logic for Practice-by-Chapter

body: |
  Summary
  -------
  Implement the frontend UI and logic for the "Practice by Chapter" feature.

  Goals
  -----
  - Provide a subject selector and a chapter/topic list for each subject.
  - Display available practice items (questions/papers) for each chapter.
  - Support UX flows:
    - Selecting a subject updates the chapter list.
    - Selecting a chapter shows a list of relevant past-paper questions or entire papers.
    - Ability to start a timed practice session or open the PDF directly.
  - Ensure accessibility and mobile responsiveness.

  Acceptance criteria
  -------------------
  - A new page `pages/practice.html` can list subjects and chapters.
  - Clicking a chapter displays a list of items with availability badges (PDF/memo).
  - Items can be opened in a new tab or used to start a timed practice session.

  Notes
  -----
  - The mapping from chapter → questions is not yet defined; this issue focuses on UI scaffolding and stubbed data structures. A follow-up issue will handle mapping.
  - Work on `feature/practice-by-chapter` branch.

  Labels: enhancement, frontend, help wanted
