title: Implement OCR for scanned PDF exam papers

body: |
  Summary
  -------
  Several exam papers from 2010-2019 are scanned images and contain no extractable text. These PDFs need OCR (Optical Character Recognition) processing to extract question content and make them available in the Practice-by-Chapter flow.

  Background
  ----------
  During the 2010-2014 question extraction work, the following F102 exam PDFs failed text extraction:
  - F102_2010_JUNE_1_Exam.pdf
  - F102_2011_JUNE_1_Exam.pdf
  - F102_2016_NOVEMBER_1_Exam.pdf
  - F102_2017_NOVEMBER_1_Exam.pdf
  - F102_2018_NOVEMBER_1_Exam.pdf
  - F102_2019_NOVEMBER_1_Exam.pdf

  These PDFs are likely scanned images rather than text-based PDFs. Without OCR, questions from these papers cannot be split and tagged with chapters.

  Goals
  -----
  - Detect scanned/image-based PDFs during conversion process
  - Apply OCR to extract text from scanned PDFs
  - Integrate OCR output into the existing conversion pipeline
  - Ensure OCR-extracted content has similar quality to text-based PDFs

  Proposed Solution
  -----------------
  Enhance `tools/05_convert_pdfs_to_markdown.py` to:
  1. Detect when a PDF has no extractable text (already implemented as WARNING)
  2. Fallback to OCR processing using a library like:
     - **Tesseract OCR** (via `pytesseract`) - open source, widely used
     - **pdf2image** to convert PDF pages to images
     - **Pillow** for image preprocessing to improve OCR accuracy
  3. Extract text using OCR and save to markdown format
  4. Add command-line flag `--enable-ocr` and `--ocr-lang` (default: 'eng') for control

  Implementation Steps
  --------------------
  1. **Add OCR dependencies**:
     - Install Tesseract OCR system dependency
     - Add Python packages: `pytesseract`, `pdf2image`, `Pillow`
     - Update requirements.txt or document installation steps

  2. **Update conversion script** (`tools/05_convert_pdfs_to_markdown.py`):
     - Add new function `extract_text_with_ocr(pdf_path)`:
       - Convert PDF pages to images using `pdf2image`
       - Apply image preprocessing (deskew, denoise, contrast adjustment)
       - Run Tesseract OCR on each page
       - Combine page text with page breaks
     - Modify `convert_pdf_to_markdown()` to:
       - First attempt text extraction with pdfplumber (current method)
       - If no text extracted, check if `--enable-ocr` flag is set
       - If yes, call `extract_text_with_ocr()` as fallback
       - Log OCR usage for tracking

  3. **Add OCR quality improvements**:
     - Image preprocessing pipeline:
       - Convert to grayscale
       - Apply adaptive thresholding
       - Deskewing for rotated images
       - Noise reduction
     - Page layout detection to preserve question structure
     - Confidence scoring to flag low-quality extractions

  4. **Testing and validation**:
     - Re-run conversion on known scanned PDFs
     - Manually review OCR output for accuracy
     - Compare question splitting results with text-based PDFs
     - Document any limitations or known issues

  5. **Documentation**:
     - Update `tools/README.md` with OCR setup instructions
     - Document Tesseract installation for Windows/Mac/Linux
     - Add troubleshooting section for OCR issues
     - Note performance impact (OCR is slower than text extraction)

  Acceptance Criteria
  -------------------
  - [ ] Tesseract OCR integrated into conversion pipeline
  - [ ] Script detects scanned PDFs and applies OCR when enabled
  - [ ] Successfully extracts text from the 6 identified scanned F102 PDFs
  - [ ] OCR-extracted questions can be split and tagged with chapters
  - [ ] Command-line flags `--enable-ocr` and `--ocr-lang` functional
  - [ ] Performance is acceptable (document expected time for OCR processing)
  - [ ] Documentation updated with OCR setup and usage instructions

  Technical Considerations
  -------------------------
  - **Performance**: OCR is significantly slower than text extraction (minutes vs seconds per file)
  - **Quality**: OCR may introduce text recognition errors, especially with:
    - Mathematical symbols and equations
    - Tables and structured data
    - Poor scan quality or low resolution
  - **Dependencies**: Tesseract requires system-level installation, not just pip install
  - **Language support**: Default to English but allow configuration for other languages

  Alternative Approaches
  ----------------------
  1. **Cloud OCR services** (Google Vision API, Azure Computer Vision):
     - Pros: Higher accuracy, handles complex layouts better
     - Cons: Requires API keys, costs money, internet dependency
  
  2. **Manual transcription**:
     - Pros: Perfect accuracy
     - Cons: Labor intensive, not scalable

  3. **EasyOCR** (alternative to Tesseract):
     - Pros: Python-native, supports 80+ languages
     - Cons: Slower than Tesseract, larger model downloads

  PR Checklist
  ------------
  - [ ] OCR libraries added to requirements (`pytesseract`, `pdf2image`, `Pillow`)
  - [ ] `extract_text_with_ocr()` function implemented in conversion script
  - [ ] `--enable-ocr` and `--ocr-lang` command-line arguments added
  - [ ] Image preprocessing pipeline for quality improvement
  - [ ] Updated README with Tesseract installation instructions
  - [ ] Tested on all 6 identified scanned PDFs
  - [ ] Performance benchmarks documented
  - [ ] Known limitations documented

  Related Issues
  --------------
  - Original issue: Questions from 2010-2014 missing from chapter view
  - Root cause: Mixed PDF types (text-based vs scanned images)

labels: enhancement, backend, data, ocr, infrastructure

