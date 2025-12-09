# Website File Organization

## New Folder Structure

```
Actuarial-Exam-Book-main/
│
├── index.html                          # Landing page (root level)
│
├── css/                                # All stylesheets
│   ├── styles.css                      # Landing page styles
│   ├── signin-styles.css               # Sign in/up page styles
│   ├── dashboard-styles.css            # Dashboard styles
│   ├── subjects-styles.css             # Subjects page styles
│   ├── papers-styles.css               # Papers page styles
│   ├── subject-papers-styles.css       # Subject papers page styles
│   └── exam-instructions-styles.css    # Exam instructions page styles
│
├── js/                                 # All JavaScript files
│   ├── auth.js                         # Authentication manager
│   ├── pdf-links.js                    # PDF links mapping
│   ├── landing-script.js               # Landing page functionality
│   ├── signin-script.js                # Sign in page functionality
│   ├── signup-script.js                # Sign up page functionality
│   ├── dashboard-script.js             # Dashboard functionality
│   ├── subjects-script.js              # Subjects page functionality
│   ├── papers-script.js                # Papers page functionality
│   ├── subject-papers-script.js        # Subject papers page functionality
│   ├── year-papers-script.js           # Year papers page functionality
│   └── exam-instructions-script.js     # Exam instructions functionality
│
└── pages/                              # All secondary HTML pages
    ├── signin.html                     # Sign in page
    ├── signup.html                     # Sign up page
    ├── dashboard.html                  # User dashboard
    ├── subjects.html                   # Subjects selection
    ├── papers.html                     # Papers overview
    ├── subject-papers.html             # Subject-specific papers
    ├── year-papers.html                # Year-specific papers
    └── exam-instructions.html          # Exam instructions and timer

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
3. **Dashboard** → Subjects (pages/subjects.html)
4. **Subjects** → Subject Papers (pages/subject-papers.html)
5. **Subject Papers** → Exam Instructions (pages/exam-instructions.html)
6. **Exam Instructions** → Opens PDF + Timer

### JavaScript Redirects:

All JS files correctly reference:
- Pages within `pages/` folder: Use relative paths like `dashboard.html`
- Root index: Use `../index.html` when called from pages folder
- Pages from root (landing-script.js): Use `pages/[filename].html`

## Benefits of This Structure:

1. ✅ **Clean separation of concerns** - HTML, CSS, and JS are organized
2. ✅ **Easy to maintain** - Related files are grouped together
3. ✅ **Scalable** - Easy to add new pages/styles/scripts
4. ✅ **Professional structure** - Follows web development best practices
5. ✅ **Better version control** - Changes are easier to track
6. ✅ **Improved performance** - Browser caching is more efficient

## All Links Have Been Updated:

- ✅ HTML `<link>` tags for CSS
- ✅ HTML `<script>` tags for JS
- ✅ HTML `<a>` navigation links
- ✅ JavaScript `window.location.href` redirects
- ✅ Relative paths corrected for new structure
