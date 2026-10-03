#!/usr/bin/env python3
"""Round-trip talk/script.md <-> editor section documents (JSON).

  export  script.md -> one JSON file per section (the editor's `sections` docs)
  import  JSON section files (as saved by ArtifactData --out_dir) -> script.md,
          taking each section's approvedBody

Usage:
  script_sync.py export <script.md> <out_dir>
  script_sync.py import <script.md> <sections_dir>
"""
import json
import re
import sys
from pathlib import Path

WPM = 130
HEADING = re.compile(r"^##\s+(?P<label>[^:]+?)\s*:\s*(?P<title>.*)$")
DURATION = re.compile(r"^\*\*משך משוער:\*\*")
OPTIONAL = re.compile(r"\{([^}]*)\}")
PENDING = "_ממתין לתוכן_"


def word_count(text: str) -> int:
    text = re.sub(r"\[[^\]]*\]", " ", text).replace("/", " ")
    return sum(1 for w in text.split() if re.search(r"\w", w))


def optional_count(text: str) -> int:
    """Words inside {...}: thoughts that may or may not be said on stage."""
    return sum(word_count(m) for m in OPTIONAL.findall(text))


def split_script(md: str):
    """Return (header, [ {label, title, body} ]) preserving section order."""
    lines = md.splitlines()
    first = next((i for i, l in enumerate(lines) if HEADING.match(l)), len(lines))
    header = re.sub(r"(\s*-{3,})+\s*$", "", "\n".join(lines[:first]).rstrip())
    sections, cur = [], None
    for line in lines[first:]:
        m = HEADING.match(line)
        if m:
            cur = {"label": m["label"].strip(), "title": m["title"].strip(), "lines": []}
            sections.append(cur)
        elif cur is not None and not DURATION.match(line.strip()) and line.strip() != PENDING:
            cur["lines"].append(line)
    for s in sections:
        body = "\n".join(s.pop("lines")).strip()
        s["body"] = re.sub(r"\n*-{3,}\s*$", "", body).strip()  # drop trailing separator
    return header, sections


def render_script(header: str, sections) -> str:
    parts = []
    for s in sections:
        body = s["body"].strip()
        if body:
            n = word_count(body)
            meta = f"**משך משוער:** כ-{n / WPM:.1f} דק' (כ-{n} מילים)"
            if opt := optional_count(body):
                meta += f" · בלי המחשבות האופציונליות: כ-{(n - opt) / WPM:.1f} דק'"
            parts.append(f"## {s['label']}: {s['title']}\n{meta}\n\n{body}")
        else:
            parts.append(f"## {s['label']}: {s['title']}\n{PENDING}")
    return header + "\n\n---\n\n" + "\n\n---\n\n".join(parts) + "\n"


def export(script: Path, out: Path):
    _, sections = split_script(script.read_text(encoding="utf-8"))
    out.mkdir(parents=True, exist_ok=True)
    for i, s in enumerate(sections, 1):
        doc = {"order": i, "label": s["label"], "title": s["title"], "body": s["body"],
               "approvedBody": s["body"], "syncedBody": s["body"]}
        (out / f"s{i}.json").write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"exported {len(sections)} sections to {out}")


def import_(script: Path, src: Path):
    header, current = split_script(script.read_text(encoding="utf-8"))
    by_label = {s["label"]: s for s in current}
    docs = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(src.rglob("*.json"))]
    docs = [d.get("data", d) for d in docs]  # tolerate {id, version, data} envelopes
    docs.sort(key=lambda d: d.get("order", 0))
    merged = []
    for d in docs:
        body = d.get("approvedBody")
        if body is None:  # never approved: keep what the repo has
            body = by_label.get(d["label"], {}).get("body", "")
        merged.append({"label": d["label"], "title": d["title"], "body": body})
    script.write_text(render_script(header, merged), encoding="utf-8")
    print(f"wrote {len(merged)} sections to {script}")


if __name__ == "__main__":
    if len(sys.argv) != 4 or sys.argv[1] not in ("export", "import"):
        sys.exit(__doc__)
    cmd, script, path = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
    (export if cmd == "export" else import_)(script, path)
