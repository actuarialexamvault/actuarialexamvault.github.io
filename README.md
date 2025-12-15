# Actuarial Exam Vault

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
- Adding more past paper links
- Adding features
- Enhancing progress analytics
- Improving storage mechanics

---

## Forgot Password (Password Reset)

A new "Forgot Password" flow has been added to allow users to request a password reset email.

- Location: `pages/forgot-password.html`
- Client script: `js/forgot-password.js`
- Styling: `css/forgot-password-styles.css`
- Integrates with Firebase Authentication's `sendPasswordResetEmail` when Firebase is configured.

Key points:
- The flow validates email addresses on the client and shows a generic success message (to avoid account enumeration).
- If Firebase Auth is initialized in the app, the page will call Firebase's `sendPasswordResetEmail(email)` and display success/error messages accordingly.
- The page respects the app theme (reads `localStorage` `theme` or `userTheme`) and updates the logo to match the selected theme.

Manual testing:
- Open `pages/forgot-password.html` in a browser and submit a valid/invalid email to see behavior.
- When Firebase is configured, sending should trigger the Firebase email flow for registered accounts.

If you need this feature adapted (custom templates, rate limiting, server-side logging), that can be added in a follow-up.

*Built with ❤️ for actuarial students | December 2025*
