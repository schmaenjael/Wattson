#!/usr/bin/env python3
"""
Extract clean text from PDF files for the Wattson knowledge base.

Usage:
    python scripts/pdf-to-text.py report.pdf agenda.pdf
    python scripts/pdf-to-text.py *.pdf --out config/knowledge
    python scripts/pdf-to-text.py report.pdf --translate

By default, output .txt files are written next to each PDF.
Pass --out <dir> to redirect all output to a specific directory.
Pass --translate to translate non-English text to English (Google Translate).

Requires: pip install pymupdf
Optional:  pip install deep-translator langdetect  (only needed with --translate)
"""

import argparse
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

try:
    import fitz  # pymupdf
except ImportError:
    print("error: pymupdf not installed. Run: pip install pymupdf", file=sys.stderr)
    sys.exit(1)


def extract_pages(pdf_path: Path) -> list[str]:
    doc = fitz.open(pdf_path)
    pages = []
    for page in doc:
        # get_text("text") preserves reading order better than raw copy-paste
        text = page.get_text("text")
        pages.append(text)
    doc.close()
    return pages


def clean(raw: str) -> str:
    lines = raw.splitlines()
    cleaned: list[str] = []

    for line in lines:
        line = line.rstrip()

        # drop lines that are purely numeric (page numbers, section counters)
        if re.fullmatch(r"\s*\d+\s*", line):
            continue

        # drop lines that are only punctuation / whitespace noise
        if re.fullmatch(r"[\s\-–—_=*.·•◦▪▸►]+", line):
            continue

        cleaned.append(line)

    text = "\n".join(cleaned)

    # merge hyphenated line-breaks: "compli-\ncated" → "complicated"
    text = re.sub(r"-\n(\S)", lambda m: m.group(1), text)

    # collapse 3+ consecutive blank lines to 2
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


_PAGE_SEP = "\n\n---\n\n"
_MAX_CHUNK = 4500  # Google Translate hard limit is 5000 chars


def _chunk(text: str) -> list[str]:
    """Split text into chunks ≤ _MAX_CHUNK, breaking on paragraph then sentence boundaries."""
    chunks: list[str] = []
    current = ""
    for para in text.split("\n\n"):
        if len(para) > _MAX_CHUNK:
            if current:
                chunks.append(current)
                current = ""
            for sent in re.split(r"(?<=[.!?])\s+", para):
                if len(current) + len(sent) + 1 > _MAX_CHUNK:
                    if current:
                        chunks.append(current)
                    current = sent
                else:
                    current = (current + " " + sent).strip() if current else sent
        elif len(current) + len(para) + 2 > _MAX_CHUNK:
            if current:
                chunks.append(current)
            current = para
        else:
            current = (current + "\n\n" + para).strip() if current else para
    if current:
        chunks.append(current)
    return chunks


def _translate_chunk(chunk: str) -> str:
    from deep_translator import GoogleTranslator
    return GoogleTranslator(source="auto", target="en").translate(chunk)


def translate_text(text: str) -> str:
    try:
        from langdetect import detect, LangDetectException
    except ImportError:
        print("error: pip install deep-translator langdetect", file=sys.stderr)
        sys.exit(1)

    pages = text.split(_PAGE_SEP)
    out: list[str] = []

    for page in pages:
        if not page.strip():
            out.append(page)
            continue
        try:
            lang = detect(page)
        except LangDetectException:
            out.append(page)
            continue
        if lang == "en":
            out.append(page)
            continue
        chunks = _chunk(page)
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = {pool.submit(_translate_chunk, c): i for i, c in enumerate(chunks)}
            results: dict[int, str] = {}
            for fut in as_completed(futures):
                results[futures[fut]] = fut.result()
        translated = "\n\n".join(results[i] for i in range(len(chunks)))
        out.append(translated)

    return _PAGE_SEP.join(out)


def convert(pdf_path: Path, out_dir: Path | None, translate: bool = False) -> Path:
    pages = extract_pages(pdf_path)
    joined = "\f".join(pages)          # form-feed as page separator before cleaning
    joined = joined.replace("\f", "\n\n---\n\n")  # readable page break marker
    result = clean(joined)

    if translate:
        result = translate_text(result)

    dest_dir = out_dir if out_dir else pdf_path.parent
    dest = dest_dir / (pdf_path.stem + ".txt")
    dest.write_text(result, encoding="utf-8")
    return dest


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert PDFs to clean text.")
    parser.add_argument("pdfs", nargs="+", type=Path, help="PDF files to convert")
    parser.add_argument("--out", type=Path, default=None, help="Output directory (default: same as each PDF)")
    parser.add_argument("--translate", action="store_true", help="Translate non-English pages to English (requires deep-translator langdetect)")
    args = parser.parse_args()

    if args.out:
        args.out.mkdir(parents=True, exist_ok=True)

    ok = 0
    skip = 0
    fail = 0
    for pdf in args.pdfs:
        if not pdf.is_file():
            print(f"skip: {pdf} (not found)", file=sys.stderr)
            fail += 1
            continue
        dest_dir = args.out if args.out else pdf.parent
        dest = dest_dir / (pdf.stem + ".txt")
        if dest.exists():
            print(f"skip: {pdf} (already exists: {dest})")
            skip += 1
            continue
        try:
            dest = convert(pdf, args.out, translate=args.translate)
            print(f"ok:   {pdf} → {dest}")
            ok += 1
        except Exception as e:
            print(f"fail: {pdf}: {e}", file=sys.stderr)
            fail += 1

    print(f"\n{ok} converted, {skip} skipped, {fail} failed.")
    if fail:
        sys.exit(1)


if __name__ == "__main__":
    main()
