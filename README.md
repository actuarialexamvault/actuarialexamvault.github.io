# ExamVault

**Vault Over The Hurdles. Unlock Your Future.** 🔐

A web-based exam preparation platform for actuarial students, providing timed practice exams, progress tracking, and comprehensive past paper coverage.

## Supported Subjects

**Associate Level:**

- A211: Actuarial Mathematics
- A311: Actuarial Risk Management
- N211: Non-Life Insurance

**Fellowship Principles:**

- F101: Health and Care
- F102: Life Insurance
- F103: General Insurance
- F104: Pensions and Other Benefits
- F105: Finance and Investment
- F108: Enterprise Risk Management

**Fellowship Specialist Advanced:**

- F201-F205: Life, General, Finance, Health & Care, Pensions

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES6 modules)
- **Backend**: Firebase (Auth, Firestore)
- **Storage**: IndexedDB for local files
- **Styling**: Custom CSS with gradients and animations

## Project Structure

```
├── pages/          # HTML pages (dashboard, subjects, exam views)
├── js/             # JavaScript modules (auth, storage, exam logic)
├── css/            # Stylesheets for each page
├── resources/      # PDF links, markdown papers, scraping scripts
└── index.html      # Landing page
```

## Contributing

Contributions welcome! Focus areas:

- Adding more past paper and memo links
- Adding features

---

*Built with ❤️ for students*

## Planned features (requested)

1. Calendar / Study Plan & Countdown (Priority: High)
   
   - Let users add their future exam date and generate a personalised study plan.
   - Show a live countdown (days remaining) on the dashboard and study pages.
   - The study plan should suggest practice papers and topics each week based on available time and historical performance.

2. Schedule Practice Exams (Priority: High)
   
   - Allow users to schedule timed practice sessions inside ExamVault and reserve slots on their study calendar.
   - Export or sync scheduled sessions with Google Calendar and Outlook (OAuth-backed calendar events).
   - Send scheduled reminders (browser notifications / optional email) for upcoming practice sessions or milestones.

3. Timed Exam Simulator with Focus Mode (Priority: Very High)
   
   - Simulated timed exams that replicate exam conditions.
   - Optional focus-mode that hides non-essential UI, warns on tab switches, and shows timeout notifications (including a prominent '5 minutes remaining' alert).
   - Autosubmit or prompt submission on timeout to preserve exam integrity. (cnnot submit after exam timer is over, cannot submit in the first 20mins)

Implementation notes:

- These features will use a combination of client-side scheduling, Firestore user metadata, and browser Notification APIs. Calendar sync requires OAuth credentials (Google/Outlook) and secure handling of tokens.
