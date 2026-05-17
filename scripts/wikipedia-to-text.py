#!/usr/bin/env python3
"""
Fetch Wikipedia pages and save them as clean plain text for the knowledge base.

Usage:
    python scripts/wikipedia-to-text.py --file urls.txt [--out config/knowledge]
    python scripts/wikipedia-to-text.py URL [URL ...] [--out config/knowledge]

URL file format (one URL per line, lines starting with # are skipped):
    # This is a comment
    https://en.wikipedia.org/wiki/Volt_Europa
    https://de.wikipedia.org/wiki/Volt_Deutschland

Output files are named after the page title (e.g. Volt_Europa.txt).
No third-party libraries required — only the standard library.
"""

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

RETRY_DELAYS = [45, 90, 240]  # seconds to wait on successive 429s

# Sections that add noise and no factual value for the knowledge base.
STRIP_SECTIONS = {
    "references", "see also", "external links", "notes", "bibliography",
    "further reading", "sources", "footnotes", "citations",
    # German
    "einzelnachweise", "weblinks", "literatur", "siehe auch",
    # French
    "références", "voir aussi", "liens externes", "bibliographie",
}


def parse_url(url: str) -> tuple[str, str]:
    """Return (api_base, page_title) from a Wikipedia article URL."""
    parsed = urllib.parse.urlparse(url)
    # https://en.wikipedia.org/wiki/Page_Title → api on same host
    api_base = f"{parsed.scheme}://{parsed.netloc}/w/api.php"
    # /wiki/Page_Title → Page_Title (URL-decoded)
    path = parsed.path
    if "/wiki/" not in path:
        raise ValueError(f"Not a Wikipedia article URL: {url}")
    title = urllib.parse.unquote(path.split("/wiki/", 1)[1])
    return api_base, title


def fetch_plaintext(api_base: str, title: str) -> str:
    """Call MediaWiki API with explaintext=true — returns raw wikitext-free plain text."""
    params = urllib.parse.urlencode({
        "action": "query",
        "titles": title,
        "prop": "extracts",
        "explaintext": "true",
        "exsectionformat": "plain",
        "format": "json",
        "formatversion": "2",
    })
    req = urllib.request.Request(
        f"{api_base}?{params}",
        headers={"User-Agent": "wattson-knowledge-builder/1.0 (contact: wattson-bot)"},
    )

    for attempt, delay in enumerate(RETRY_DELAYS + [None]):
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            break
        except urllib.error.HTTPError as e:
            if e.code == 429 and delay is not None:
                print(f"  429 rate-limited — waiting {delay}s before retry {attempt + 1}/{len(RETRY_DELAYS)}…",
                      file=sys.stderr)
                time.sleep(delay)
            else:
                raise

    pages = data.get("query", {}).get("pages", [])
    if not pages:
        raise ValueError("Empty response from API.")

    page = pages[0]
    if page.get("missing"):
        raise ValueError(f"Page not found: {title!r}")

    return page.get("extract", "")


def strip_trailing_sections(text: str) -> str:
    """Remove References, See also, External links, etc. and everything after."""
    lines = text.splitlines()
    out: list[str] = []
    for line in lines:
        stripped = line.strip().lower().rstrip("=").strip()
        if stripped in STRIP_SECTIONS:
            break
        out.append(line)
    return "\n".join(out)


def clean(raw: str) -> str:
    text = strip_trailing_sections(raw)

    # Section headers come as plain text lines from explaintext — normalize them
    # (MediaWiki wraps them in == == markers when exsectionformat=plain is off,
    # but with plain they're just bare lines — leave them as-is, just trim)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = "\n".join(line.rstrip() for line in text.splitlines())
    return text.strip()


def safe_filename(title: str) -> str:
    return re.sub(r'[\\/:*?"<>|]', "_", title) + ".txt"


def convert(url: str, out_dir: Path) -> tuple[Path, bool]:
    """Returns (dest_path, skipped). skipped=True when file already existed."""
    api_base, title = parse_url(url)
    dest = out_dir / safe_filename(title)
    if dest.exists():
        return dest, True
    raw = fetch_plaintext(api_base, title)
    text = clean(raw)
    dest.write_text(text, encoding="utf-8")
    return dest, False


def load_urls_from_file(path: Path) -> list[str]:
    urls: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("#"):
            urls.append(stripped)
    return urls


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch Wikipedia pages as plain text.")
    parser.add_argument("urls", nargs="*", help="Full Wikipedia article URLs")
    parser.add_argument("--file", type=Path, metavar="FILE",
                        help="Text file with one URL per line (lines starting with # are skipped)")
    parser.add_argument("--out", type=Path, default=Path("config/knowledge"),
                        help="Output directory (default: config/knowledge)")
    args = parser.parse_args()

    urls: list[str] = list(args.urls)
    if args.file:
        urls.extend(load_urls_from_file(args.file))

    if not urls:
        parser.error("Provide at least one URL or a --file with URLs.")

    args.out.mkdir(parents=True, exist_ok=True)

    ok = 0
    skipped = 0
    fail = 0
    for i, url in enumerate(urls):
        try:
            dest, was_skipped = convert(url, args.out)
            if was_skipped:
                print(f"skip: {url}\n      → {dest} (already exists)")
                skipped += 1
            else:
                print(f"ok:   {url}\n      → {dest}")
                ok += 1
                if i < len(urls) - 1:
                    time.sleep(1)
        except Exception as e:
            print(f"fail: {url}\n      {e}", file=sys.stderr)
            fail += 1

    print(f"\n{ok} fetched, {skipped} skipped, {fail} failed.")
    if fail:
        sys.exit(1)


if __name__ == "__main__":
    main()
