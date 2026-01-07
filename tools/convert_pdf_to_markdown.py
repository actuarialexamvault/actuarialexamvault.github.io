import os
import re
import json
from pathlib import Path
import logging
import argparse

PDF_LIBRARY = None

def detect_pdf_library():
    global PDF_LIBRARY
    if PDF_LIBRARY:
        return PDF_LIBRARY
    try:
        import pdfplumber  # type: ignore
        PDF_LIBRARY = 'pdfplumber'
        logger = logging.getLogger(__name__)
        logger.info('Using pdfplumber for PDF extraction')
        return PDF_LIBRARY
    except Exception:
        try:
            import PyPDF2  # type: ignore
            PDF_LIBRARY = 'pypdf2'
            logger = logging.getLogger(__name__)
            logger.info('Using PyPDF2 for PDF extraction')
            return PDF_LIBRARY
        except Exception:
            return None

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def extract_text_pdfplumber(pdf_path):
    """Extract text from PDF using pdfplumber"""
    # import lazily to avoid hard dependency at import-time of the module
    try:
        import pdfplumber
    except Exception as e:
        logger.error('pdfplumber is not installed; cannot extract with pdfplumber')
        return None
    try:
        with pdfplumber.open(pdf_path) as pdf:
            text = ""
            for page_num, page in enumerate(pdf.pages, 1):
                page_text = page.extract_text()
                if page_text:
                    text += f"\n\n--- Page {page_num} ---\n\n"
                    text += page_text
            return text
    except Exception as e:
        logger.error(f"Error extracting text from {pdf_path} with pdfplumber: {e}")
        return None

def extract_text_pypdf2(pdf_path):
    """Extract text from PDF using PyPDF2"""
    try:
        import PyPDF2
    except Exception:
        logger.error('PyPDF2 is not installed; cannot extract with PyPDF2')
        return None
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            text = ""
            for page_num, page in enumerate(pdf_reader.pages, 1):
                page_text = page.extract_text()
                if page_text:
                    text += f"\n\n--- Page {page_num} ---\n\n"
                    text += page_text
            return text
    except Exception as e:
        logger.error(f"Error extracting text from {pdf_path} with PyPDF2: {e}")
        return None

def clean_text(text):
    """Clean and format extracted text for markdown"""
    if not text:
        return ""
    
    # Remove excessive whitespace
    text = re.sub(r'\n\s*\n\s*\n', '\n\n', text)
    text = re.sub(r' +', ' ', text)
    
    # Fix common issues
    text = text.replace('\x00', '')  # Remove null characters
    text = text.replace('\r\n', '\n')  # Normalize line endings
    text = text.replace('\r', '\n')
    
    # Add proper markdown formatting for page breaks
    text = re.sub(r'--- Page (\d+) ---', r'## Page \1', text)
    
    return text.strip()

def generate_markdown_header(pdf_path):
    """Generate markdown header with metadata"""
    from datetime import datetime
    
    filename = os.path.basename(pdf_path)
    exam_code = year = session = paper = doc_type = "Unknown"

    # Try to extract metadata from the path if possible
    try:
        p = Path(pdf_path)
        # expect structure like <in_dir>/<subject>/<session>/<year>/<type>/filename.pdf
        parts = p.parts
        # get last 5 parts
        if len(parts) >= 5:
            # filename is last, type is -2, year -3, session -4, subject -5
            filename_only = parts[-1]
            doc_type = parts[-2]
            year = parts[-3]
            session = parts[-4]
            exam_code = parts[-5]
        else:
            # fallback to parsing filename tokens
            tokens = filename.replace('.pdf', '').split('_')
            if len(tokens) >= 5:
                exam_code = tokens[0]
                year = tokens[1]
                session = tokens[2]
                paper = tokens[3]
                doc_type = tokens[4]
    except Exception:
        pass
    
    header = f"""# {filename.replace('.pdf', '')}

## Document Information
- **Exam Code**: {exam_code}
- **Year**: {year}
- **Session**: {session}
- **Paper**: {paper}
- **Document Type**: {doc_type.replace('_', ' ')}
- **Original File**: {filename}
- **Converted**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

"""
    return header

def convert_pdf_to_markdown(pdf_path, markdown_path):
    """Convert a single PDF to markdown"""
    logger.info(f"Converting: {os.path.basename(pdf_path)}")
    
    # Ensure we detect which PDF library to use at runtime
    lib = detect_pdf_library()
    if lib == 'pdfplumber':
        text = extract_text_pdfplumber(pdf_path)
    elif lib == 'pypdf2':
        text = extract_text_pypdf2(pdf_path)
    else:
        logger.error('No PDF extraction library available (pdfplumber or PyPDF2). Install one and retry.')
        return False
    
    if text is None:
        logger.error(f"Failed to extract text from {pdf_path}")
        return False
    
    # Clean the text
    text = clean_text(text)
    
    if not text.strip():
        logger.warning(f"No text extracted from {pdf_path}")
        return False
    
    # Generate markdown content
    import datetime
    header = generate_markdown_header(pdf_path)
    markdown_content = header + text
    
    # Write markdown file
    try:
        os.makedirs(os.path.dirname(markdown_path), exist_ok=True)
        with open(markdown_path, 'w', encoding='utf-8') as f:
            f.write(markdown_content)
        logger.info(f"✓ Created: {os.path.basename(markdown_path)}")
        return True
    except Exception as e:
        logger.error(f"Error writing markdown file {markdown_path}: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description='Convert downloaded PDFs to per-paper Markdown')
    parser.add_argument('--in-dir', type=Path, default=Path('resources/pdfs/sample_downloads'), help='Input downloads directory')
    parser.add_argument('--out-dir', type=Path, default=Path('resources/markdown_questions/sample'), help='Output markdown directory')
    parser.add_argument('--manifest', type=Path, default=None, help='Path to write manifest.json (defaults to out-dir/manifest.json)')
    parser.add_argument('--dry-run', action='store_true', help='Do not write files, just report')
    args = parser.parse_args()

    downloaded_papers_dir = args.in_dir
    markdown_output_dir = args.out_dir

    if not downloaded_papers_dir.exists():
        logger.error(f"Directory '{downloaded_papers_dir}' not found!")
        return
    
    # Find all PDF files
    pdf_files = []
    for root, dirs, files in os.walk(downloaded_papers_dir):
        for file in files:
            if file.lower().endswith('.pdf'):
                pdf_path = Path(root) / file
                # Create corresponding markdown path (mirror directory under out-dir)
                rel_path = pdf_path.relative_to(downloaded_papers_dir)
                markdown_path = markdown_output_dir.joinpath(rel_path).with_suffix('.md')
                pdf_files.append((pdf_path, markdown_path))
    
    if not pdf_files:
        logger.warning("No PDF files found!")
        return
    
    logger.info(f"Found {len(pdf_files)} PDF files to convert")
    
    # Convert each PDF
    successful = 0
    failed = 0
    manifest = []
    
    for pdf_path, markdown_path in pdf_files:
        # convert and record metadata
        ok = False
        if args.dry_run:
            logger.info(f"[dry-run] Would convert: {pdf_path} -> {markdown_path}")
            ok = True
        else:
            ok = convert_pdf_to_markdown(pdf_path, markdown_path)

        # derive simple metadata
        rel = pdf_path.relative_to(downloaded_papers_dir)
        parts = rel.parts
        meta = {
            'source_pdf': str(pdf_path),
            'output_md': str(markdown_path),
            'status': 'ok' if ok else 'failed'
        }
        if len(parts) >= 4:
            meta.update({'subject': parts[0], 'session': parts[1], 'year': parts[2], 'doc_type': parts[3]})
        manifest.append(meta)

        if ok:
            successful += 1
        else:
            failed += 1
    
    # Summary
    logger.info(f"\n=== Conversion Summary ===")
    logger.info(f"Total PDFs processed: {len(pdf_files)}")
    logger.info(f"Successful conversions: {successful}")
    logger.info(f"Failed conversions: {failed}")
    logger.info(f"Markdown files saved to: {os.path.abspath(markdown_output_dir)}")
    
    # Show directory structure
    if successful > 0:
        logger.info(f"\nMarkdown directory structure:")
        for root, dirs, files in os.walk(markdown_output_dir):
            level = root.replace(str(markdown_output_dir), '').count(os.sep)
            indent = ' ' * 2 * level
            logger.info(f"{indent}{os.path.basename(root)}/")
            subindent = ' ' * 2 * (level + 1)
            for file in files:
                logger.info(f"{subindent}{file}")

    # write manifest
    manifest_path = args.manifest or (markdown_output_dir / 'manifest.json')
    try:
        markdown_output_dir.mkdir(parents=True, exist_ok=True)
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)
        logger.info(f"Wrote manifest to: {manifest_path}")
    except Exception as e:
        logger.error(f"Failed to write manifest: {e}")

if __name__ == "__main__":
    main()
