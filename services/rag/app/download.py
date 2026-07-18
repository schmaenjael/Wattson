"""
Knowledge auto-download. Runs before ingestion: reads the Wikipedia URL list and
fetches every page as clean plain text into /config/knowledge, skipping any file
that already exists.

Mirrors scripts/wikipedia-to-text.py, but built for unattended container startup:
transient failures (network errors, timeouts, HTTP 429/5xx) are retried forever
with capped exponential backoff — the step never gives up and never aborts the
pipeline. Only a logically missing page (the API reports it does not exist) is
skipped, since no amount of retrying would make it appear.
"""

import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

KNOWLEDGE_DIR = Path(os.getenv("KNOWLEDGE_DIR", "/config/knowledge"))
KNOWLEDGE_LIST = Path(os.getenv("KNOWLEDGE_LIST", "/config/knowledge-wikipedia-list.txt"))

# Exponential backoff: delay = min(MAX_DELAY, BASE_DELAY * 2**attempt) + jitter.
BASE_DELAY = float(os.getenv("RAG_DOWNLOAD_BASE_DELAY", "5"))
MAX_DELAY = float(os.getenv("RAG_DOWNLOAD_MAX_DELAY", "300"))
# Politeness pause between successful fetches to stay friendly to the API.
POLITE_DELAY = float(os.getenv("RAG_DOWNLOAD_POLITE_DELAY", "1"))

USER_AGENT = "wattson-knowledge-builder/1.0 (contact: wattson-bot)"

# Sections that add noise and no factual value for the knowledge base.
STRIP_SECTIONS = {
    "references", "see also", "external links", "notes", "bibliography",
    "further reading", "sources", "footnotes", "citations",
    # German
    "einzelnachweise", "weblinks", "literatur", "siehe auch",
    # French
    "références", "voir aussi", "liens externes", "bibliographie",
}


class PageMissing(Exception):
    """The page does not exist — a permanent condition, so we skip it."""


def parse_url(url: str) -> tuple[str, str]:
    """Return (api_base, page_title) from a Wikipedia article URL."""
    parsed = urllib.parse.urlparse(url)
    api_base = f"{parsed.scheme}://{parsed.netloc}/w/api.php"
    path = parsed.path
    if "/wiki/" not in path:
        raise ValueError(f"Not a Wikipedia article URL: {url}")
    title = urllib.parse.unquote(path.split("/wiki/", 1)[1])
    return api_base, title


def _backoff_delay(attempt: int) -> float:
    return min(MAX_DELAY, BASE_DELAY * (2 ** attempt)) + random.uniform(0, BASE_DELAY)


def fetch_plaintext(api_base: str, title: str) -> str:
    """
    Call the MediaWiki API for plain-text extract. Retries transient failures
    forever with exponential backoff; raises PageMissing for a non-existent page.
    """
    params = urllib.parse.urlencode({
        "action": "query",
        "titles": title,
        "prop": "extracts",
        "explaintext": "true",
        "exsectionformat": "plain",
        "format": "json",
        "formatversion": "2",
    })
    req = urllib.request.Request(f"{api_base}?{params}", headers={"User-Agent": USER_AGENT})

    attempt = 0
    while True:
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            pages = data.get("query", {}).get("pages", [])
            if not pages:
                raise ValueError("empty response from API")
            page = pages[0]
            if page.get("missing"):
                raise PageMissing(title)
            return page.get("extract", "")
        except PageMissing:
            raise
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError,
                ValueError, json.JSONDecodeError, OSError) as e:
            delay = _backoff_delay(attempt)
            print(f"  retry {attempt + 1} for {title!r} after {delay:.0f}s — {e}", file=sys.stderr, flush=True)
            time.sleep(delay)
            attempt += 1


def _strip_trailing_sections(text: str) -> str:
    out: list[str] = []
    for line in text.splitlines():
        if line.strip().lower().rstrip("=").strip() in STRIP_SECTIONS:
            break
        out.append(line)
    return "\n".join(out)


def clean(raw: str) -> str:
    text = _strip_trailing_sections(raw)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = "\n".join(line.rstrip() for line in text.splitlines())
    return text.strip()


def safe_filename(title: str) -> str:
    return re.sub(r'[\\/:*?"<>|]', "_", title) + ".txt"


def _load_urls(path: Path) -> list[str]:
    urls: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("#"):
            urls.append(stripped)
    return urls


def run() -> None:
    if not KNOWLEDGE_LIST.exists():
        print(f"==> No URL list at {KNOWLEDGE_LIST} — skipping knowledge download.")
        return

    KNOWLEDGE_DIR.mkdir(parents=True, exist_ok=True)
    urls = _load_urls(KNOWLEDGE_LIST)
    print(f"==> Knowledge download: {len(urls)} URL(s) from {KNOWLEDGE_LIST}")

    downloaded = skipped = missing = 0
    for url in urls:
        try:
            api_base, title = parse_url(url)
        except ValueError as e:
            print(f"  skip (bad URL): {e}", file=sys.stderr, flush=True)
            missing += 1
            continue

        dest = KNOWLEDGE_DIR / safe_filename(title)
        if dest.exists():
            skipped += 1
            continue

        try:
            text = clean(fetch_plaintext(api_base, title))
        except PageMissing:
            print(f"  skip (page missing): {title}", file=sys.stderr, flush=True)
            missing += 1
            continue

        dest.write_text(text, encoding="utf-8")
        downloaded += 1
        print(f"  ok: {title} → {dest.name}", flush=True)
        time.sleep(POLITE_DELAY)

    print(f"==> Knowledge download complete: {downloaded} downloaded, {skipped} already present, {missing} missing/invalid")


if __name__ == "__main__":
    run()
