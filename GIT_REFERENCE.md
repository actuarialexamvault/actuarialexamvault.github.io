# Git Repository Setup - Quick Reference

## Repository Information

**Repository Location:** 
```
C:\Users\lmdunge\OneDrive - Deloitte (O365D)\Documents\2. Studies\Actuarial_Exam_book\Actuarial-Exam-Book-main
```

**Branch:** `master`

**Git User:**
- Name: lmdunge
- Email: lmdunge@deloitte.co.za

## Initial Commit Details

**Commit Hash:** `6871107`
**Date:** December 9, 2025
**Files Tracked:** 30 files, 5,127 lines of code

### Files Included:
- ✅ All HTML files (index.html + 8 pages)
- ✅ All CSS files (7 stylesheets)
- ✅ All JavaScript files (11 scripts)
- ✅ Configuration files (.gitignore, README.md, WEBSITE_STRUCTURE.md)

### Files Excluded (in .gitignore):
- ❌ resources/ folder (contains large PDFs and generated content)
- ❌ exports/ folder
- ❌ OS files (.DS_Store, Thumbs.db)
- ❌ Editor files (.vscode/, .idea/)
- ❌ Temporary and backup files

## Common Git Commands for This Project

### View Status
```bash
git status
git status --short  # Compact view
```

### View History
```bash
git log
git log --oneline
git log --oneline --graph --all
```

### Make Changes
```bash
# Stage specific files
git add filename.html

# Stage all changes
git add .

# Commit changes
git commit -m "Your commit message here"
```

### View Changes
```bash
# See what changed
git diff

# See staged changes
git diff --staged

# See changes in a specific file
git diff filename.html
```

### Branching (for future features)
```bash
# Create new branch
git branch feature-name

# Switch to branch
git checkout feature-name

# Create and switch in one command
git checkout -b feature-name

# List branches
git branch
```

### Undo Changes
```bash
# Unstage a file
git reset filename.html

# Discard changes in working directory
git checkout -- filename.html

# Undo last commit (keep changes)
git reset --soft HEAD~1
```

## Best Practices

1. **Commit Frequently** - Make small, logical commits
2. **Write Clear Messages** - Describe what and why
3. **Review Before Committing** - Use `git status` and `git diff`
4. **Use Branches** - For new features or experiments
5. **Keep .gitignore Updated** - Don't track unnecessary files

## Current Project Structure (Tracked)

```
Actuarial-Exam-Book-main/
├── .gitignore
├── README.md
├── WEBSITE_STRUCTURE.md
├── index.html
├── css/          (7 files)
├── js/           (11 files)
└── pages/        (8 files)
```

## Next Steps

### To Push to GitHub (when ready):
```bash
# Create repository on GitHub first, then:
git remote add origin https://github.com/yourusername/actuarial-exam-vault.git
git branch -M main
git push -u origin main
```

### To Create a Backup:
```bash
# The entire .git folder contains your history
# Simply copy the project folder to backup
```

### To Track Future Changes:
```bash
# After making edits:
git add .
git commit -m "Description of changes"

# View what you've done:
git log --oneline
```

## Notes

- The `resources/` folder is intentionally excluded to keep the repository size manageable
- All web application files (HTML, CSS, JS) are tracked for version control
- The project uses LocalStorage for data persistence (no backend database tracked)
- PDF links are tracked in `js/pdf-links.js` but actual PDFs are not

---
**Repository Initialized:** December 9, 2025  
**Initial Commit:** 30 files, 5,127 insertions
