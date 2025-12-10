# Actuarial Exam Vault

**Vault Over The Hurdles. Unlock Your Future.** 🔐

A web-based exam preparation platform for actuarial students, providing timed practice exams, progress tracking, and comprehensive past paper coverage.

## Features

- 🔒 **Secure Authentication** - Firebase-powered user accounts
- ⏱️ **Timed Exams** - Realistic 3.5-hour exam simulations with auto-save
- 📊 **Progress Tracking** - Monitor attempts and performance across all subjects
- 📄 **241 Past Papers** - Comprehensive coverage from 2018-2025
- 💾 **IndexedDB Storage** - Offline-capable local file management
- 🎯 **15 Subjects** - Associate to Fellowship level coverage

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

## Getting Started

1. Clone the repository
2. Set up Firebase project and add your config to `js/firebase-config.js`
3. Open `index.html` in a web browser or serve with Live Server
4. Sign up and start practicing!

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
- Improving exam timer accuracy
- Enhancing progress analytics
- Mobile responsiveness

---

*Built with ❤️ for actuarial students | December 2025*
