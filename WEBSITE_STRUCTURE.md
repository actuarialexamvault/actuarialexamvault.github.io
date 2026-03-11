# Website File Organization

## Current Folder Structure (With Firebase Integration)

```
Actuarial-Exam-Book-main/
│
├── index.html                          # Landing page (root level)
├── firebase-test.html                  # Firebase connection test page
│
├── css/                                # All stylesheets
│   ├── styles.css                      # Landing page styles
│   ├── signin-styles.css               # Sign in/up page styles
│   ├── dashboard-styles.css            # Dashboard styles
│   ├── subjects-styles.css             # Subjects page styles
│   ├── papers-styles.css               # Papers page styles
│   ├── subject-papers-styles.css       # Subject papers page styles
│   ├── exam-instructions-styles.css    # Exam instructions page styles
│   ├── exam-review-styles.css          # Exam review page styles
│   └── help-support-styles.css         # Help & Support page styles
│
├── js/                                 # All JavaScript files (ES6 Modules)
│   ├── auth.js                         # Legacy authentication (deprecated)
│   ├── firebase-config.js              # Firebase configuration & initialization
│   ├── firebase-auth.js                # Firebase Authentication service
│   ├── firebase-data.js                # Firestore Database service
│   ├── firebase-storage.js             # Firebase Storage service (deprecated)
│   ├── indexeddb-storage.js            # IndexedDB local storage service
│   ├── activity-monitor.js             # 30-minute auto-logout monitor
│   ├── pdf-links.js                    # PDF links mapping
│   ├── landing-script.js               # Landing page functionality
│   ├── signin-script.js                # Sign in page with Firebase Auth
│   ├── signup-script.js                # Sign up page with Firebase Auth
│   ├── dashboard-script.js             # Dashboard with Firebase profile
│   ├── subjects-script.js              # Subjects page with Firebase Auth
│   ├── papers-script.js                # Papers page with Firebase Auth
│   ├── subject-papers-script.js        # Subject papers with Firebase Auth
│   ├── year-papers-script.js           # Year papers functionality
│   ├── exam-instructions-script.js     # Exam instructions with IndexedDB upload
│   ├── exam-review-script.js           # Exam review with Firestore data
│   └── help-support-script.js          # Help & Support page functionality
│
├── pages/                              # All secondary HTML pages
│   ├── signin.html                     # Sign in page (Firebase Auth)
│   ├── signup.html                     # Sign up page (Firebase Auth)
│   ├── dashboard.html                  # User dashboard (Firebase profile)
│   ├── practice.html                   # Practice by chapter (new)
│   ├── papers.html                     # Papers overview
│   ├── year-papers.html                # Year-specific papers
│   ├── exam-instructions.html          # Exam setup, upload, and timer
│   ├── exam-review.html                # Review exam submissions
│   ├── past-exams.html                 # Past exam papers and progress
│   ├── question-grading.html           # Grade individual questions
│   ├── help-support.html               # Help & Support with contact form
│   └── test-download.html              # Download test page
│
└── templates/                          # Document templates
    └── Exam practice template.docx     # Exam template for users


```

## Path References

### From index.html (root):
- CSS files: `css/styles.css`
- JS files: `js/auth.js`, `js/landing-script.js`
- Pages: `pages/signin.html`, `pages/dashboard.html`

### From pages/*.html:
- CSS files: `../css/[filename].css`
- JS files: `../js/[filename].js`
- Root: `../index.html`
- Other pages: `[filename].html` (same folder)

### Navigation Flows:

1. **Landing (index.html)** → Sign In (pages/signin.html)
2. **Sign In** → Dashboard (pages/dashboard.html) or Sign Up (pages/signup.html)
3. **Dashboard** → 
    - Past Exams (pages/past-exams.html)
    - Practice by Chapter (pages/practice.html)
    - Help & Support (pages/help-support.html)
4. **Past Exams** → Papers (pages/papers.html)
5. **Papers** → Exam Instructions (pages/exam-instructions.html)
6. **Subject Papers** → Exam Instructions (pages/exam-instructions.html)
7. **Exam Instructions** → Upload file + Timer → Exam Review
8. **Past Exams** → Exam Review (pages/exam-review.html)
9. **Exam Review** → Question Grading (pages/question-grading.html)

### JavaScript Module Structure:

All JS files use ES6 modules with imports:
- **Firebase Config**: Imported by all Firebase services
- **Firebase Auth**: Used by all authenticated pages
- **Firebase Data**: Used for Firestore operations
- **IndexedDB Storage**: Used for local file storage
- **Activity Monitor**: Imported by all authenticated pages for auto-logout

### Firebase Integration:

**Authentication:**
- Email/Password authentication via Firebase Auth
- onAuthStateChanged listeners on all protected pages
- 30-minute auto-logout with 28-minute warning
- User profile stored in Firestore

**Data Storage:**
- **Firestore Database**: User profiles, exam submissions metadata, question gradings
- **IndexedDB**: Local file storage (exam PDFs/documents)
- Files stored locally but metadata syncs across devices

**Collections:**
- `users`: User profile data (fullname, email, created timestamp)
- `examSubmissions`: Exam metadata (subject, year, paper, timestamp)
- `questionGradings`: Individual question grades and marks

## Benefits of This Structure:

1. ✅ **Clean separation of concerns** - HTML, CSS, and JS are organized
2. ✅ **Easy to maintain** - Related files are grouped together
3. ✅ **Scalable** - Easy to add new pages/styles/scripts
4. ✅ **Professional structure** - Follows web development best practices
5. ✅ **Better version control** - Changes are easier to track
6. ✅ **Improved performance** - Browser caching is more efficient
7. ✅ **Firebase backend** - Cloud authentication and data sync
8. ✅ **Offline capability** - IndexedDB for local file storage
9. ✅ **Secure** - Firebase Auth with activity monitoring
10. ✅ **Cross-device sync** - Metadata available on all devices

## Migration Status:

### ✅ Completed:
- Firebase project setup (actuarial-exam-vault)
- Firebase Authentication (Email/Password)
- Firestore Database (test mode)
- IndexedDB local storage implementation
- Activity monitor (30-min auto-logout)
- All pages migrated to Firebase auth
- Exam submission to Firestore
- Exam review from Firestore
- Help & Support page with contact form

### 🚧 In Progress:
- Question grading to Firestore (partial)
- Year-papers page Firebase migration

### 📋 Pending:
- Firebase security rules (production mode)
- GitHub Pages deployment
- Cross-device testing
