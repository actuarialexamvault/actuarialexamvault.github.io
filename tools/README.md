# Tools Directory - Pipeline Documentation

This directory contains scripts for building and maintaining the actuarial exam question database. The scripts are numbered to indicate the execution order.

## 📋 Pipeline Overview

The pipeline converts exam papers and examiner reports from the actuarial society website into individual question markdown files:

```
Website → Crawl → Process → Merge → Download → Convert → Split
```

## 🔢 Scripts in Execution Order

### Step 1: Crawl Website for PDFs
**Script:** `01_crawl_site_for_pdfs.py`

Crawls the actuarial society website to discover all available PDF links for a specific subject.

**Usage:**
```bash
python tools/01_crawl_site_for_pdfs.py --subject F102
```

**Output:** `resources/pdfs/crawl_results_F102.json`

**Options:**
- `--subject` (required): Subject code (e.g., F102, F103, A311)
- `--output`: Custom output path (default: resources/pdfs/crawl_results_{SUBJECT}.json)

---

### Step 2a: Process Exam Papers
**Script:** `02a_process_exam_papers.py`

Extracts exam paper URLs from crawl results and compares with existing canonical data.

**Usage:**
```bash
python tools/02a_process_exam_papers.py --crawl resources/pdfs/crawl_results_F102.json
```

**Output:** `resources/pdfs/papers_manifest.json`

**What it does:**
- Parses exam paper URLs from crawl results
- Filters for PDF files only
- Compares with `resources/pdfs/exam_links.json`
- Reports NEW entries (empty slots) and CHANGED URLs (improvements)

**Options:**
- `--crawl` (required): Path to crawl results JSON file
- `--manifest`: Output manifest path (default: resources/pdfs/papers_manifest.json)
- `--canonical`: Canonical exam links path (default: resources/pdfs/exam_links.json)

---

### Step 2b: Process Examiner Reports
**Script:** `02b_process_examiner_reports.py`

Extracts examiner report (memo) URLs from crawl results.

**Usage:**
```bash
python tools/02b_process_examiner_reports.py --crawl resources/pdfs/crawl_results_F102.json
```

**Output:** `resources/pdfs/examiners_manifest.json`

**What it does:**
- Parses examiner report URLs from crawl results
- Handles multiple URL formats (SUBJECT-SESSION-YEAR and SUBJECT-YEAR-SESSION)
- Filters for PDF files only
- Compares with existing examiner reports
- Reports NEW and CHANGED URLs

**URL Format Support:**
- Pattern 1: `F102-JUNE-2024` (standard)
- Pattern 1b: `F102-2010-NOV` (older format)
- Pattern 2: `F102_S1_2024` (S1/S2 format)

**Options:**
- `--crawl` (required): Path to crawl results JSON file
- `--manifest`: Output manifest path (default: resources/pdfs/examiners_manifest.json)

---

### Step 3: Merge Manifests to Canonical
**Script:** `03_merge_manifest_to_canonical.py`

Merges discovered papers/reports into canonical JSON files used by the frontend and downloaders.

**Usage:**
```bash
# Dry run (preview changes)
python tools/03_merge_manifest_to_canonical.py \
    --manifest resources/pdfs/papers_manifest.json \
    --canonical resources/pdfs/exam_links.json

# Apply changes automatically
python tools/03_merge_manifest_to_canonical.py \
    --manifest resources/pdfs/papers_manifest.json \
    --canonical resources/pdfs/exam_links.json \
    --apply --auto
```

**What it does:**
- Compares manifest entries with canonical JSON
- Shows differences (NEW or CHANGED URLs)
- Prompts for approval (unless `--auto` flag used)
- Creates timestamped backup before modifying
- Auto-calls `03b_regenerate_memo_links.py` after merging exam papers

**Options:**
- `--manifest` (required): Path to manifest JSON (papers_manifest.json or examiners_manifest.json)
- `--canonical` (required): Path to canonical JSON (exam_links.json or memo-links.json)
- `--apply`: Apply changes (default: dry-run only)
- `--auto`: Auto-accept all changes without prompts

**Important Notes:**
- Always run with exam papers first: `papers_manifest.json` → `exam_links.json`
- Memo links are auto-regenerated from `examiners_manifest.json` (no manual merge needed)
- Backups are saved as: `exam_links.json.bak.YYYYMMDDTHHMMSSZ`

---

### Step 3b: Regenerate Memo Links (Auto-executed)
**Script:** `03b_regenerate_memo_links.py`

Regenerates `memo-links.json` from `examiners_manifest.json`. **This script is automatically called by Step 3** - you don't need to run it manually.

**Manual Usage (if needed):**
```bash
python tools/03b_regenerate_memo_links.py
```

**What it does:**
- Converts list-format examiner manifest to canonical memo-links format
- Performs deep merge with existing memo-links.json
- Normalizes subject keys and session/year ordering
- Creates backup before overwriting

---

### Step 4: Download PDFs
**Script:** `04_download_pdfs.py`

Downloads exam papers and examiner reports from canonical JSON files.

**Usage:**
```bash
# Download only NEW files (skip existing)
python tools/04_download_pdfs.py \
    --exam-json resources/pdfs/exam_links.json \
    --memo-json resources/pdfs/memo-links.json \
    --out-dir resources/pdfs/downloads

# Force re-download all files
python tools/04_download_pdfs.py \
    --exam-json resources/pdfs/exam_links.json \
    --memo-json resources/pdfs/memo-links.json \
    --out-dir resources/pdfs/downloads \
    --force
```

**Output Structure:**
```
resources/pdfs/downloads/
├── F102/
│   ├── JUNE/
│   │   └── 2024/
│   │       └── Exam/
│   │           └── F102_JUNE_2024_1_Exam.pdf
│   └── 2024/
│       └── JUNE/
│           └── Examiners_Report/
│               └── F102_2024_JUNE_general_Examiners_Report.pdf
```

**What it does:**
- Reads exam_links.json and memo-links.json
- Downloads PDFs to organized folder structure
- Skips existing files by default (use `--force` to overwrite)
- Retries failed downloads (3 attempts by default)
- Creates `download_manifest.json` with status tracking

**Options:**
- `--exam-json`: Path to exam_links.json (default: resources/pdfs/exam_links.json)
- `--memo-json`: Path to memo-links.json (default: resources/pdfs/memo-links.json)
- `--out-dir`: Output directory (default: resources/pdfs/downloads)
- `--force`: Overwrite existing files
- `--retries`: Number of retry attempts (default: 3)
- `--timeout`: Download timeout in seconds (default: 30)

---

### Step 5: Convert PDFs to Markdown
**Script:** `05_convert_pdfs_to_markdown.py`

Converts downloaded PDFs to markdown format using OCR and text extraction.

**Usage:**
```bash
python tools/05_convert_pdfs_to_markdown.py \
    --in-dir resources/pdfs/downloads \
    --out-dir resources/markdown_questions/all
```

**What it does:**
- Recursively processes all PDFs in input directory
- Converts PDF content to markdown format
- Preserves folder structure in output directory
- Creates conversion manifest with status tracking

**Output Structure:**
```
resources/markdown_questions/all/
├── F102/
│   ├── JUNE/
│   │   └── 2024/
│   │       └── Exam/
│   │           └── F102_JUNE_2024_1_Exam.md
│   └── 2024/
│       └── JUNE/
│           └── Examiners_Report/
│               └── F102_2024_JUNE_general_Examiners_Report.md
└── manifest.json
```

**Options:**
- `--in-dir`: Input directory containing PDFs (default: resources/pdfs/sample_downloads)
- `--out-dir`: Output directory for markdown files (default: resources/markdown_questions/sample)

---

### Step 6: Split Papers to Questions
**Script:** `06_split_papers_to_questions.py`

Splits full paper markdown files into individual question files.

**Usage:**
```bash
python tools/06_split_papers_to_questions.py \
    --in-dir resources/markdown_questions/all \
    --subject F102 \
    --out-dir resources/markdown_questions \
    --chapter-map resources/practice/chapter_map_F102.json
```

**What it does:**
- Splits exam papers into individual questions
- Splits examiner reports into individual solutions
- Maps questions to chapters (if chapter-map provided)
- Creates separate question and solution folder structures

**Output Structure:**
```
resources/markdown_questions/
├── F102/
│   ├── JUNE/
│   │   └── 2024/
│   │       └── Paper1/
│   │           └── questions/
│   │               ├── F102_JUNE_2024_Paper1_Q1.md
│   │               ├── F102_JUNE_2024_Paper1_Q2.md
│   │               └── ...
│   └── manifest_questions.json
│
resources/solutions/
└── F102/
    └── 2024/
        └── JUNE/
            └── Papergeneral/
                ├── F102_JUNE_2024_Papergeneral_Q1.md
                ├── F102_JUNE_2024_Papergeneral_Q2.md
                └── ...
```

**Options:**
- `--in-dir` (required): Input directory containing paper markdown files
- `--subject` (required): Subject code (e.g., F102)
- `--out-dir`: Output directory (default: resources/markdown_questions)
- `--chapter-map`: Path to chapter mapping JSON (optional)

---

## 🚀 Complete Workflow Example

Here's how to process a new subject (e.g., F102) from scratch:

```bash
# Step 1: Crawl the website
python tools/01_crawl_site_for_pdfs.py --subject F102

# Step 2a: Process exam papers
python tools/02a_process_exam_papers.py --crawl resources/pdfs/crawl_results_F102.json

# Step 2b: Process examiner reports
python tools/02b_process_examiner_reports.py --crawl resources/pdfs/crawl_results_F102.json

# Step 3: Merge exam papers (with auto-approval)
python tools/03_merge_manifest_to_canonical.py \
    --manifest resources/pdfs/papers_manifest.json \
    --canonical resources/pdfs/exam_links.json \
    --apply --auto

# Note: Memo links are auto-regenerated by step 3, no manual step needed

# Step 4: Download PDFs (incremental - skips existing)
python tools/04_download_pdfs.py \
    --exam-json resources/pdfs/exam_links.json \
    --memo-json resources/pdfs/memo-links.json \
    --out-dir resources/pdfs/downloads

# Step 5: Convert to markdown
python tools/05_convert_pdfs_to_markdown.py \
    --in-dir resources/pdfs/downloads \
    --out-dir resources/markdown_questions/all

# Step 6: Split into questions
python tools/06_split_papers_to_questions.py \
    --in-dir resources/markdown_questions/all \
    --subject F102 \
    --out-dir resources/markdown_questions \
    --chapter-map resources/practice/chapter_map_F102.json
```

---

## 📁 Key Files and Directories

### Input Files
- `resources/pdfs/crawl_results_{SUBJECT}.json` - Raw crawl results per subject
- `resources/pdfs/exam_links.json` - Canonical exam paper URLs (used by frontend)
- `resources/pdfs/memo-links.json` - Canonical examiner report URLs (used by frontend)
- `resources/practice/chapter_map_{SUBJECT}.json` - Question to chapter mappings (optional)

### Intermediate Files
- `resources/pdfs/papers_manifest.json` - Discovered exam papers awaiting merge
- `resources/pdfs/examiners_manifest.json` - Discovered examiner reports

### Output Directories
- `resources/pdfs/downloads/` - Downloaded PDF files
- `resources/markdown_questions/all/` - Full paper markdown files
- `resources/markdown_questions/{SUBJECT}/` - Individual question files
- `resources/solutions/{SUBJECT}/` - Individual solution files

### Backup Files
- `*.json.bak.YYYYMMDDTHHMMSSZ` - Timestamped backups created before modifications

---

## 🔍 Troubleshooting

### Common Issues

**1. "Invalid URL 'None'" errors during download**
- **Cause:** Empty URLs in canonical JSON files
- **Solution:** Run steps 1-3 again for that subject to discover and merge proper URLs

**2. "Failed to parse existing JSON" warnings**
- **Cause:** Malformed JSON file
- **Solution:** Check JSON syntax, restore from backup if needed

**3. Download failures with connection errors**
- **Cause:** Network issues or website rate limiting
- **Solution:** Retry with increased timeout: `--timeout 60`

**4. No questions found after splitting**
- **Cause:** Markdown format doesn't match expected patterns
- **Solution:** Check markdown files manually, verify PDF conversion quality

**5. Merge shows CHANGED URLs for existing papers**
- **Cause:** Improved URLs discovered (e.g., direct PDF link instead of document page)
- **Solution:** Review changes and accept if new URL is better quality

---

## 🛡️ Safety Features

- **Backups:** All modifications to canonical files create timestamped backups
- **Dry-run mode:** Merge script shows changes without applying (default behavior)
- **Incremental downloads:** Skip existing files by default (use `--force` to override)
- **PDF filtering:** Only processes PDF files, ignores HTML/document pages
- **Retry logic:** Failed downloads are retried automatically (3 attempts default)
- **Manifest tracking:** Each step creates manifests tracking success/failure status

---

## 📝 Notes

- The pipeline is **incremental** - you can run steps multiple times safely
- Steps 1-3 are **metadata only** - no large file downloads
- Steps 4-6 process **actual content** - may take significant time for large subjects
- **Always review changes** before using `--auto` flag in merge step
- Keep backups of canonical JSON files before major updates
- The `archived/` directory contains old script versions - ignore these

---

## 🆘 Getting Help

If you encounter issues:
1. Check the script's `--help` output for detailed options
2. Review the output logs for specific error messages
3. Check backup files to restore if needed
4. Verify input files exist and are valid JSON

For questions or issues, refer to the repository documentation or open an issue on GitHub.
