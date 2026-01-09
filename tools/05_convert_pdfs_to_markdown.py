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
    
    # Character mapping for common PDF special characters
    # Map various bullet point characters and other special symbols to standard markdown
    char_replacements = {
        # Bullet points - various unicode representations
        '\uf0b7': '- ',  # Common PDF bullet (Private Use Area)
        '\u2022': '- ',  # Bullet point (•)
        '\u2023': '- ',  # Triangular bullet (‣)
        '\u25e6': '- ',  # White bullet (◦)
        '\u2043': '- ',  # Hyphen bullet (⁃)
        '\u2219': '- ',  # Bullet operator (∙)
        '\u25aa': '- ',  # Black small square (▪)
        '\u25ab': '- ',  # White small square (▫)
        '\u25cf': '- ',  # Black circle (●)
        '\u25cb': '- ',  # White circle (○)
        '\u25b8': '- ',  # Black right-pointing small triangle (▸)
        '\u2794': '- ',  # Heavy wide-headed rightwards arrow (➔)
        '\u00b7': '- ',  # Middle dot (·)
        '\u00d8': '- ',  # Latin capital letter O with stroke (Ø)
        
        # Dashes and hyphens
        '\u2013': '-',   # En dash (–)
        '\u2014': '--',  # Em dash (—)
        '\u2212': '-',   # Minus sign (−)
        
        # Quotes
        '\u2018': "'",   # Left single quote (')
        '\u2019': "'",   # Right single quote (')
        '\u201c': '"',   # Left double quote (")
        '\u201d': '"',   # Right double quote (")
        
        # Other common symbols
        '\u2026': '...',  # Ellipsis (…)
        '\u00a0': ' ',    # Non-breaking space
        '\u00ad': '',     # Soft hyphen (invisible)
        '\ufeff': '',     # Zero width no-break space (BOM)
        
        # Additional private use area characters that might be bullets
        '\uf0a7': '- ',   # Another common bullet variant
        '\uf0d8': '- ',   # Yet another bullet variant
        '\uf076': '- ',   # Another bullet variant
        '\uf0fc': '- ',   # Another bullet variant
    }
    
    # Apply character replacements
    for old_char, new_char in char_replacements.items():
        text = text.replace(old_char, new_char)
    
    # Replace any remaining Private Use Area characters (U+E000 to U+F8FF) with empty string
    # These are often used in PDF metadata and should be removed
    text = re.sub(r'[\ue000-\uf8ff]+', '', text)
    
    # Remove common PDF artifacts and metadata
    # Remove patterns like (cid:1)(cid:2)(cid:3) which are PDF internal character IDs
    text = re.sub(r'\(cid:\d+\)+', '', text)
    text = re.sub(r'\(cid:\d+\)\s*', '', text)
    
    # Remove lines that contain only exam codes and copyright/unicode artifacts
    # Pattern: F102 N2011 followed by unicode/cid artifacts on same or next line
    text = re.sub(r'F\d{3}\s+[NJ]\d{4}\s+\(cid:.*?\n', '\n', text, flags=re.DOTALL)
    text = re.sub(r'F\d{3}\s+[NJ]\d{4}\s*\n', '\n', text)
    
    # Remove standalone lines with only unicode artifacts
    text = re.sub(r'\n\s*\(cid:.*?\n', '\n', text)
    
    # Fix common issues first
    text = text.replace('\x00', '')  # Remove null characters
    text = text.replace('\r\n', '\n')  # Normalize line endings
    text = text.replace('\r', '\n')
    
    # Fix line breaks in the middle of sentences (hyphenated words at end of line)
    # Remove hyphen + newline when it's breaking a word
    text = re.sub(r'-\n([a-z])', r'\1', text)
    
    # Add newlines after mark allocation brackets to create paragraph breaks
    # Pattern: [number] at end of line should be followed by blank line
    text = re.sub(r'(\[\d+\])\s*\n', r'\1\n\n', text)
    
    # Join lines that are part of the same sentence/paragraph
    # (not starting with bullet, number, or after double newline)
    lines = text.split('\n')
    cleaned_lines = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Keep empty lines
        if not line:
            cleaned_lines.append('')
            i += 1
            continue
        
        # Check if this is a bullet point
        is_bullet = (
            line.startswith('- ') or 
            line.startswith('o ') or 
            line.startswith('• ')
        )
        
        # Check if this is a numbered list or heading
        is_other_list_item = (
            re.match(r'^\d+[\.)]\s', line) or  # numbered list like 1. or 1)
            re.match(r'^[ivxlcdm]+[\.)]\s', line.lower()[:5]) or  # Roman numerals like i. ii. iii.
            re.match(r'^\([ivxlcdm]+\)', line.lower()[:5])  # Parentheses format (i), (ii)
        )
        
        # Check if this is a heading or special marker
        is_heading = (
            line.startswith('#') or  # heading
            line.startswith('**') or  # bold heading
            line.isupper() or  # all caps heading
            re.match(r'^[A-Z][a-z]*:', line) or  # Label followed by colon
            line.startswith('[')  # Marks like [Total 6]
        )
        
        # Handle bullet points specially - join all content until next bullet/marker
        if is_bullet:
            current_bullet = line
            i += 1
            
            # Keep joining lines until we hit another bullet, list item, or heading
            while i < len(lines):
                next_line = lines[i].strip()
                
                # Stop if empty line
                if not next_line:
                    break
                
                # Stop if next line is a bullet, list item, or heading
                next_is_bullet = (
                    next_line.startswith('- ') or
                    next_line.startswith('o ') or
                    next_line.startswith('• ')
                )
                
                next_is_list_or_heading = (
                    re.match(r'^\d+[\.)]\s', next_line) or
                    re.match(r'^[ivxlcdm]+[\.)]\s', next_line.lower()[:5]) or
                    re.match(r'^\([ivxlcdm]+\)', next_line.lower()[:5]) or
                    next_line.startswith('#') or
                    next_line.startswith('**') or
                    next_line.isupper() or
                    next_line.startswith('[')
                )
                
                if next_is_bullet or next_is_list_or_heading:
                    break
                
                # Join this line to the current bullet
                current_bullet = current_bullet + ' ' + next_line
                i += 1
            
            cleaned_lines.append(current_bullet)
            continue
        
        # Handle other list items and headings
        if is_other_list_item or is_heading:
            cleaned_lines.append(line)
            i += 1
            continue
        
        # Build up a complete paragraph by joining lines
        current_paragraph = line
        i += 1
        
        # Keep joining lines while they're part of the same paragraph
        while i < len(lines):
            next_line = lines[i].strip()
            
            # Stop if we hit an empty line (paragraph break)
            if not next_line:
                break
            
            # Stop if next line is a list item or special marker
            next_is_special = (
                next_line.startswith('- ') or
                next_line.startswith('o ') or
                next_line.startswith('• ') or
                re.match(r'^\d+[\.)]\s', next_line) or  # numbered list like 1. or 1)
                re.match(r'^[ivxlcdm]+[\.)]\s', next_line.lower()[:5]) or  # Roman numerals like i. ii. iii.
                re.match(r'^\([ivxlcdm]+\)', next_line.lower()[:5]) or  # Parentheses format (i), (ii)
                next_line.startswith('#') or
                next_line.startswith('**') or
                next_line.isupper() or
                next_line.startswith('[')  # Marks like [Total 6]
            )
            
            if next_is_special:
                break
            
            # Stop if current paragraph ends with proper punctuation followed by capital letter
            # But don't stop if it ends with punctuation inside brackets like [4]
            if re.search(r'[.!?]\s*$', current_paragraph) and not re.search(r'\[\d+\]\s*$', current_paragraph):
                if next_line and len(next_line) > 0 and next_line[0].isupper():
                    break
            
            # Stop if current line ends with a closing bracket like [4] or [Total 10]
            # and next line starts with something else (likely a new question)
            if re.search(r'\]\s*$', current_paragraph) and next_line:
                if next_line[0].isupper() or next_line.startswith('F10') or next_line.startswith('Question'):
                    break
            
            # Join this line to the current paragraph
            current_paragraph = current_paragraph + ' ' + next_line
            i += 1
        
        cleaned_lines.append(current_paragraph)
    
    text = '\n'.join(cleaned_lines)
    
    # Fix indentation for nested bullet points (o becomes properly indented sub-bullet)
    text = re.sub(r'\no\s+', '\n  - ', text)  # Convert "o" to indented bullet
    
    # Ensure proper spacing around bullet points
    # Add blank line before bullet lists (if not already there)
    text = re.sub(r'([^\n])\n(- )', r'\1\n\n\2', text)
    
    # Add blank line after bullet lists (if not already there)
    text = re.sub(r'(- [^\n]+)\n([^\n-])', r'\1\n\n\2', text)
    
    # Remove excessive whitespace but keep double newlines for paragraphs
    text = re.sub(r'\n\s*\n\s*\n+', '\n\n', text)
    text = re.sub(r' +', ' ', text)
    text = re.sub(r'\t+', '  ', text)  # Convert tabs to 2 spaces
    
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
        # Can be two structures:
        # 1. <in_dir>/<subject>/<year>/<session>/<type>/filename.pdf (from memo-links)
        # 2. <in_dir>/<subject>/<session>/<year>/<type>/filename.pdf (from exam-links)
        parts = p.parts
        # get last 5 parts
        if len(parts) >= 5:
            # filename is last, type is -2
            filename_only = parts[-1]
            doc_type = parts[-2]
            
            # Determine structure by checking if parts[-3] is a year (4 digits) or session name
            potential_third = parts[-3]
            try:
                # Try parsing as year
                test_year = int(potential_third)
                if 2000 <= test_year <= 2100:
                    # Structure 2: Subject/Session/Year/Type/
                    year = parts[-3]
                    session = parts[-4]
                    exam_code = parts[-5]
                else:
                    raise ValueError("Not a valid year")
            except (ValueError, TypeError):
                # Structure 1: Subject/Year/Session/Type/
                session = parts[-3]
                year = parts[-4]
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
    parser.add_argument('--subject', type=str, default=None, help='Subject code (e.g., F102). If not provided, will be extracted from filename')
    parser.add_argument('--dry-run', action='store_true', help='Do not write files, just report')
    args = parser.parse_args()

    downloaded_papers_dir = args.in_dir
    markdown_output_dir = args.out_dir
    subject_override = args.subject

    if not downloaded_papers_dir.exists():
        logger.error(f"Directory '{downloaded_papers_dir}' not found!")
        return
    
    # Find all PDF files
    pdf_files = []
    for root, dirs, files in os.walk(downloaded_papers_dir):
        for file in files:
            if file.lower().endswith('.pdf'):
                pdf_path = Path(root) / file
                
                # Parse the path structure to determine subject and document type
                # Two possible structures:
                # 1. downloads/F102/Year/Session/Examiners_Report/file.pdf (memo-links, when --in-dir points to subject folder)
                # 2. downloads/F102/Session/Year/Exam/file.pdf (exam-links, when --in-dir points to subject folder)
                # OR if --in-dir is downloads/, paths include subject as first part
                rel_path = pdf_path.relative_to(downloaded_papers_dir)
                parts = rel_path.parts
                
                # Extract subject from filename (e.g., F102_2010_JUNE_1_Exam.pdf)
                filename = parts[-1]
                if subject_override:
                    subject = subject_override
                else:
                    subject = filename.split('_')[0]  # Extract F102 from F102_2010_JUNE_1_Exam.pdf
                
                # Determine output path based on document type
                if len(parts) >= 3:
                    doc_type_folder = parts[-2]  # Should be 'Exam' or 'Examiners_Report'
                    
                    # Map document type to output folder
                    if 'Exam' in doc_type_folder and 'Report' not in doc_type_folder:
                        output_subdir = 'exams'
                    elif 'Report' in doc_type_folder or 'Examiners' in doc_type_folder:
                        output_subdir = 'solutions'
                    else:
                        output_subdir = 'other'
                    
                    # Build output path: out-dir/[exams|solutions]/Subject/rest-of-path
                    # Keep the same Year/Session or Session/Year structure as input
                    # Exclude the document type folder (Exam/Examiners_Report) from the remaining path
                    remaining_path = Path(*parts[:-2], parts[-1])  # Everything except doc_type folder
                    markdown_path = markdown_output_dir / output_subdir / subject / remaining_path
                    markdown_path = markdown_path.with_suffix('.md')
                else:
                    # Fallback: mirror directory structure
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
