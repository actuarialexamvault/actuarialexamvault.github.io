"""
Step 1: Load and clean Obsidian notes from obsidian-summaries/.

Parses each file at CALLOUT BLOCK level rather than file level.
Each > [!type] Header ... block becomes one chunk, preserving the
callout header as semantic context for the embedding.

Output: results/notes_data.json
"""

import re
import json
from pathlib import Path
from collections import Counter

NOTES_DIR = Path(__file__).parent / "obsidian-summaries"
OUTPUT = Path(__file__).parent / "results" / "notes_data.json"

# Navigation callouts are layout-only; skip them
SKIP_CALLOUT_TYPES = {'nav-back', 'nav-next', 'nav'}


def clean_inline(text: str) -> str:
    """Strip inline Obsidian/markdown formatting from a single line."""
    text = re.sub(r'\*{3}(.+?)\*{3}', r'\1', text)
    text = re.sub(r'\*{2}(.+?)\*{2}', r'\1', text)
    text = re.sub(r'\*(.+?)\*', r'\1', text)
    text = re.sub(r'`(.+?)`', r'\1', text)
    text = re.sub(r'\[\[([^\]|]+)\|([^\]]+)\]\]', r'\2', text)
    text = re.sub(r'\[\[([^\]]+)\]\]', r'\1', text)
    text = re.sub(r'(?<!\w)#(?!\s)\w+', '', text)  # hashtag-style tags
    return text.strip()


def parse_callout_blocks(raw_text: str) -> list:
    """
    Parse Obsidian callout blocks from markdown text.

    Returns a list of dicts: {callout_type, callout_header, content}
    Falls back to an empty list if no callouts are found.
    """
    blocks = []
    current_type = None
    current_header = None
    current_lines = []
    skipping = False

    for line in raw_text.splitlines():
        # Callout opener: > [!type] optional header text
        m = re.match(r'>\s*\[!([\w-]+)\]\s*(.*)', line)
        if m:
            # Flush the previous block
            if current_header is not None and not skipping:
                content = '\n'.join(current_lines).strip()
                if content:
                    blocks.append({
                        'callout_type': current_type,
                        'callout_header': current_header,
                        'content': content,
                    })

            ctype = m.group(1).lower()
            cheader = clean_inline(m.group(2).strip()) or ctype
            skipping = ctype in SKIP_CALLOUT_TYPES
            current_type = ctype
            current_header = cheader
            current_lines = []
            continue

        if re.match(r'^>', line):
            if not skipping and current_header is not None:
                content_line = re.sub(r'^>\s?', '', line)
                current_lines.append(clean_inline(content_line))
        else:
            # Non-blockquote line ends the current callout
            if current_header is not None and not skipping:
                content = '\n'.join(current_lines).strip()
                if content:
                    blocks.append({
                        'callout_type': current_type,
                        'callout_header': current_header,
                        'content': content,
                    })
            current_type = None
            current_header = None
            current_lines = []
            skipping = False

    # Flush the last block
    if current_header is not None and not skipping:
        content = '\n'.join(current_lines).strip()
        if content:
            blocks.append({
                'callout_type': current_type,
                'callout_header': current_header,
                'content': content,
            })

    return blocks


def load_notes() -> list:
    records = []

    for md_file in sorted(NOTES_DIR.rglob("*.md")):
        rel = md_file.relative_to(NOTES_DIR)
        parts = rel.parts
        folder = parts[0]           # e.g. "20. Monitoring experience"
        file_heading = md_file.stem  # e.g. "1. Reasons for monitoring"

        raw = md_file.read_text(encoding="utf-8", errors="ignore")
        blocks = parse_callout_blocks(raw)

        if blocks:
            for block in blocks:
                # Embedding text = file concept name + callout header + content.
                # The prefix anchors short callout bodies to their topic context.
                chunk_text = (
                    f"{file_heading} — {block['callout_header']}:\n"
                    f"{block['content']}"
                )
                if len(chunk_text) < 20:
                    continue
                records.append({
                    "file": str(rel).replace("\\", "/"),
                    "folder": folder,
                    "heading": file_heading,
                    "callout_header": block['callout_header'],
                    "callout_type": block['callout_type'],
                    "text": chunk_text,
                    "chunk_type": "callout",
                })
        else:
            # File has no callouts — use the whole file as one chunk
            lines = []
            for line in raw.splitlines():
                if re.match(r'>\s*\[!', line):
                    continue
                line = re.sub(r'^>\s?', '', line)
                lines.append(clean_inline(line))
            clean = re.sub(r'\n{3,}', '\n\n', '\n'.join(lines)).strip()
            if len(clean) < 20:
                continue
            records.append({
                "file": str(rel).replace("\\", "/"),
                "folder": folder,
                "heading": file_heading,
                "callout_header": None,
                "callout_type": None,
                "text": f"{file_heading}:\n{clean}",
                "chunk_type": "file",
            })

    return records


def main():
    if not NOTES_DIR.exists():
        raise FileNotFoundError(f"Notes directory not found: {NOTES_DIR}")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    records = load_notes()
    OUTPUT.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8")

    total_callout = sum(1 for r in records if r["chunk_type"] == "callout")
    total_file = sum(1 for r in records if r["chunk_type"] == "file")
    print(
        f"Loaded {len(records)} chunks "
        f"({total_callout} callout blocks, {total_file} file-level) -> {OUTPUT}"
    )
    print()

    counts = Counter(r["folder"] for r in records)
    for folder, n in sorted(counts.items()):
        print(f"  {n:3d}  {folder}")


if __name__ == "__main__":
    main()
