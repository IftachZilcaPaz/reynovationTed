#!/usr/bin/env python3
"""Build a clean, printable HTML booklet of the talk (render it to PDF with tools/booklet_pdf.cjs).

Usage:
  build_booklet.py <sections_dir> <fonts_dir> <out.html> [--clean]

--clean prints only the spoken words, as flowing prose: no stage directions, screen cues,
pause marks, placeholders or tables. With --clean, <sections_dir> may instead be a proofread
text file (talk/reading-version.md: paragraphs separated by blank lines, parts by ---).

<sections_dir> holds the editor's section documents as JSON (ArtifactData --out_dir output);
each section's current `body` is the text that gets printed.
"""
import html
import json
import re
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from script_sync import WPM, optional_count, word_count  # noqa: E402

SUMMARY = {
    "לפני": "נעים מאוד, אני יפתח: אמא, אבא, העוף המוזר והדקל. הרצון לעשות אחרת, \"אי אפשר\", והרכבת.",
    "נקודת המפנה": "\"אתה לא מסוגל\" והשיפט, 7 באוקטובר בממ\"ד, הבן הבכור, הסטירות שדייקו.",
    "הקוד שירשנו": "פחדים ואמונות שירשנו. אמונה מול ידיעה. הגדרות היצרן. הקופים ואש.",
    "לתכנת את המוח": "אני מתכנת. אוטומט, טריגר-פעולה-תגמול, 66 יום. דיספנזה: חזרה מנטלית, מקורבן ליוצר. המכונית האדומה. המצנח של סינק.",
    "הקפיצה / ההחלטה": "וויל סמית, מדריך הצניחה והמצנח, הרילוקיישן, 5 הצעות עבודה, for good.",
    "אליכם": "התירוצים, שינוי שם, למות או לחיות בשבילם, 3 מתוך 5, \"מה הממ\"ד שלכם?\"",
}

OPENING = [
    ("0:00", "חושך ושקט"),
    ("0:01.5", "התמונה מ-7 באוקטובר עולה, מהבהבת וגרעינית"),
    ("0:15.5", "התראה ראשונה, והפריים נקרע בגליץ'"),
    ("0:50", "מבול התראות, הגליץ' משתלט"),
    ("0:57", "קריסה, ואז 30 שניות של שחור"),
    ("1:27.5", "עלייה לבמה"),
]

SOURCES = [
    ("Wendy Wood", "כ-43% מהיום הם הרגלים", "חלק 3"),
    ("Judson Brewer, TED", "טריגר, פעולה, תגמול", "חלק 3"),
    ("Lisa Feldman Barrett, TED", "המוח בונה את הרגשות, ואפשר לבנות אחרת", "חלק 3"),
    ("Lally et al. 2010", "הרגל חדש: בדרך כלל כ-66 יום", "חלק 3"),
    ("Askew & Field 2008", "ילדים לומדים פחד מההורים", "חלק 4"),
    ("Rachel Yehuda 2015", "טראומה אצל ילדי ניצולים (מדגם קטן)", "חלק 4"),
    ("Maier & Seligman 2016", "חוסר אונים הוא ברירת המחדל", "חלק 4"),
    ("van de Waal et al., Science 2013", "קופי ורווט: 9 מ-10 התיישרו", "חלק 4"),
    ("Asch 1951–1956", "3 מ-4 התיישרו; אדם אחד שונה: 5.5%", "חלק 4"),
    ("Will Smith", "\"הדברים הכי טובים בצד השני של האימה\"", "חלק 5"),
    ("Randi Zuckerberg, Pick Three", "3 מתוך 5", "חלק 6"),
]


def minutes(n: int) -> str:
    return f"{n / WPM:.1f}"


def optional(escaped: str) -> str:
    """{...} marks a thought that may or may not be said: shown, but set apart."""
    return re.sub(r"\{([^}]*)\}", r'<span class="opt">\1</span>', escaped)


def inline(text: str) -> str:
    """Escape, then style screen cues, stage directions, gaps and pause marks."""
    t = html.escape(text, quote=False)
    t = re.sub(r"\[מסך:\s*([^\]]*)\]", r'<span class="cue">▣ \1</span>', t)
    t = re.sub(r"\[([^\]]+)\]", r'<span class="dir">\1</span>', t)
    t = re.sub(r"‹([^›]*)›", r'<mark>\1</mark>', t)
    t = optional(t)
    t = re.sub(r"\s*//\s*", ' <span class="p2">//</span> ', t)
    t = re.sub(r"\s/\s", ' <span class="p1">/</span> ', t)
    return t.strip()


def render_body(body: str) -> str:
    out = []
    for para in re.split(r"\n\s*\n", body.strip()):
        lines = [l for l in para.splitlines() if l.strip()]
        if not lines:
            continue
        rendered = []
        for line in lines:
            cls = "line solo" if re.fullmatch(r"\s*\[[^\]]*\]\s*", line) else "line"
            rendered.append(f'<p class="{cls}">{inline(line)}</p>')
        out.append(f'<div class="para">{"".join(rendered)}</div>')
    return "\n".join(out)


def clean_text(body: str) -> list[str]:
    """Spoken words only, one string per paragraph."""
    paras = []
    for para in re.split(r"\n\s*\n", body.strip()):
        words = []
        for line in para.splitlines():
            line = re.sub(r"\[[^\]]*\]|‹[^›]*›", " ", line)   # stage directions, cues, placeholders
            line = re.sub(r"\s*/+\s*", " ", line)               # pause marks
            line = re.sub(r"\s+", " ", line).strip()
            line = re.sub(r"([.?!,])(\s*\.)+", r"\1", line)        # punctuation left behind a removed note
            if line and not re.fullmatch(r"[.?!,\s]*", line):
                words.append(line)
        if words:
            paras.append(" ".join(words))
    return paras


def status(d: dict) -> str:
    body, approved = d.get("body", ""), d.get("approvedBody")
    if not body.strip():
        return "ריק"
    if body == approved:
        return "מאושר"
    return "טיוטה, ממתין לאישור"


def faces_css(fonts: Path) -> str:
    def face(family, file, weight):
        return (f"@font-face{{font-family:'{family}';src:url('{(fonts / file).as_uri()}') format('woff2');"
                f"font-weight:{weight};font-display:block}}")
    return "\n".join([
        face("Heebo", "heebo-hebrew-400-normal.woff2", 400), face("Heebo", "heebo-latin-400-normal.woff2", 400),
        face("Heebo", "heebo-hebrew-500-normal.woff2", 500), face("Heebo", "heebo-hebrew-700-normal.woff2", 700),
        face("Heebo", "heebo-latin-700-normal.woff2", 700),
        face("Frank", "frank-ruhl-libre-hebrew-700-normal.woff2", 700),
        face("Frank", "frank-ruhl-libre-latin-700-normal.woff2", 700),
        face("Frank", "frank-ruhl-libre-hebrew-400-normal.woff2", 400),
        face("Frank", "frank-ruhl-libre-latin-400-normal.woff2", 400),
    ])


def load_docs(sections_dir: Path) -> list[dict]:
    docs = []
    for p in sorted(sections_dir.rglob("*.json")):
        d = json.loads(p.read_text(encoding="utf-8"))
        docs.append(d.get("data", d))
    return sorted(docs, key=lambda d: d.get("order", 0))


def load_clean_parts(source: Path) -> list[list[str]]:
    """Paragraphs per part, from the editor's sections or from a proofread text file (parts split by ---)."""
    if source.is_file():
        text = source.read_text(encoding="utf-8")
        return [[p.strip() for p in re.split(r"\n\s*\n", part) if p.strip()]
                for part in re.split(r"\n-{3,}\n", text)]
    return [clean_text(d.get("body", "")) for d in load_docs(source)]


def build_clean(source: Path, fonts: Path, out: Path):
    parts = load_clean_parts(source)
    body = '\n<div class="sep">✦</div>\n'.join(
        "".join(f"<p>{optional(html.escape(t, quote=False))}</p>" for t in paras) for paras in parts if paras
    )
    doc = f"""<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>לתכנת את המוח</title>
<style>
{faces_css(fonts)}
@page {{ size: A4; margin: 25mm 24mm 24mm; }}
body {{ margin: 0; font-family: Frank, 'FreeSerif', serif; font-size: 13pt; line-height: 1.75; color: #1d1f22; }}
h1 {{ font-size: 26pt; font-weight: 700; margin: 0 0 12mm; }}
p {{ margin: 0 0 4.5mm; text-align: justify; }}
.sep {{ text-align: center; color: #b7bbc0; margin: 6mm 0 7mm; font-size: 11pt; }}
.opt {{ color: #8a8f96; font-style: italic; }}
.note {{ color: #8a8f96; font-size: 10pt; margin: -6mm 0 10mm; }}
</style></head><body>
<h1>לתכנת את המוח</h1>
{'<p class="note">טקסט באפור: מחשבות שאולי ייאמרו ואולי לא.</p>' if 'class="opt"' in body else ''}
{body}
</body></html>"""
    out.write_text(doc, encoding="utf-8")
    print(f"wrote {out}: clean text, {sum(len(p) for p in parts)} paragraphs")


def build(sections_dir: Path, fonts: Path, out: Path):
    docs = load_docs(sections_dir)

    counts = [word_count(d.get("body", "")) for d in docs]
    total = sum(counts)
    opt_total = sum(optional_count(d.get("body", "")) for d in docs)
    gaps = [(d["label"], g) for d in docs for g in re.findall(r"‹([^›]*)›", d.get("body", ""))]

    rows = "".join(
        f"<tr><td class='num'>{d['label'].split()[-1]}</td><td><b>{html.escape(d['title'])}</b>"
        f"<div class='sub'>{html.escape(SUMMARY.get(d['title'], ''))}</div></td>"
        f"<td class='num'>{n}</td><td class='num'>{minutes(n)}</td><td>{status(d)}</td></tr>"
        for d, n in zip(docs, counts)
    )
    opening = "".join(f"<tr><td class='num'>{t}</td><td>{html.escape(x)}</td></tr>" for t, x in OPENING)
    parts = "".join(
        f"""<section class="part">
  <header><div class="kicker">{html.escape(d['label'])}</div><h2>{html.escape(d['title'])}</h2>
  <div class="meta">{n} מילים · כ-{minutes(n)} דק' · {status(d)}</div></header>
  {render_body(d.get('body', '')) if d.get('body', '').strip() else '<p class="empty">עוד לא נכתב.</p>'}
</section>"""
        for d, n in zip(docs, counts)
    )
    gap_items = "".join(f"<li><span class='where'>{html.escape(l)}</span>{html.escape(g)}</li>" for l, g in gaps)
    src_rows = "".join(
        f"<tr><td>{html.escape(a)}</td><td>{html.escape(b)}</td><td>{c}</td></tr>" for a, b, c in SOURCES
    )

    faces = faces_css(fonts)

    doc = f"""<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>לתכנת את המוח</title>
<style>
{faces}
:root {{ --ink:#1d1f22; --muted:#6b7077; --line:#dfe2e6; --accent:#c4610a; --cue:#1f7f93; --mark:#fff1b8; }}
@page {{ size: A4; margin: 20mm 20mm 22mm; }}
* {{ box-sizing: border-box; }}
body {{ margin:0; font-family: Heebo, 'DejaVu Sans', sans-serif; color: var(--ink); font-size: 11.5pt; line-height: 1.7; }}
h1, h2 {{ font-family: Frank, 'FreeSerif', serif; font-weight: 700; margin: 0; }}
.cover {{ height: 245mm; display: flex; flex-direction: column; justify-content: center; gap: 8mm; break-after: page; }}
.cover .kicker {{ font-size: 11pt; letter-spacing: .12em; color: var(--accent); }}
.cover h1 {{ font-size: 56pt; line-height: 1; }}
.cover .lede {{ font-size: 14pt; color: var(--muted); max-width: 130mm; }}
.cover .stats {{ display: flex; gap: 10mm; margin-top: 6mm; }}
.cover .stat b {{ display: block; font-family: Frank, serif; font-size: 26pt; line-height: 1.1; }}
.cover .stat span {{ color: var(--muted); font-size: 10pt; }}
.overview {{ break-after: page; }}
h3 {{ font-size: 13pt; margin: 9mm 0 3mm; }}
.idea {{ font-family: Frank, serif; font-size: 15pt; line-height: 1.5; border-inline-start: 3pt solid var(--accent); padding: 2mm 5mm; margin: 0; }}
table {{ width: 100%; border-collapse: collapse; font-size: 10pt; }}
th {{ text-align: start; font-weight: 500; color: var(--muted); border-bottom: 1pt solid var(--ink); padding: 2mm 2mm; }}
td {{ border-bottom: .5pt solid var(--line); padding: 2mm; vertical-align: top; }}
td.num {{ font-variant-numeric: tabular-nums; white-space: nowrap; }}
.sub {{ color: var(--muted); font-size: 9pt; }}
tfoot td {{ font-weight: 700; border-bottom: 0; }}
.part {{ break-before: page; }}
.part header {{ margin-bottom: 7mm; padding-bottom: 3mm; border-bottom: 1pt solid var(--ink); }}
.part .kicker {{ color: var(--accent); letter-spacing: .1em; font-size: 10pt; }}
.part h2 {{ font-size: 28pt; line-height: 1.1; }}
.part .meta {{ color: var(--muted); font-size: 9.5pt; }}
.para {{ margin: 0 0 4.5mm; break-inside: avoid; }}
.line {{ margin: 0; }}
.line.solo {{ margin: 1mm 0; }}
.dir {{ color: var(--muted); font-size: 9.5pt; font-style: italic; }}
.dir::before {{ content: '['; }} .dir::after {{ content: ']'; }}
.cue {{ color: var(--cue); font-size: 9.5pt; font-weight: 500; }}
mark {{ background: var(--mark); padding: 0 1mm; border-radius: 1mm; }}
.opt {{ color: var(--muted); font-style: italic; }}
.opt::before {{ content: '{{'; }} .opt::after {{ content: '}}'; }}
.p1 {{ color: #b9bdc2; }}
.p2 {{ color: var(--accent); font-weight: 700; }}
.empty {{ color: var(--muted); }}
.gaps {{ break-before: page; }}
.gaps ul {{ padding: 0; list-style: none; margin: 0; }}
.gaps li {{ padding: 2mm 0; border-bottom: .5pt solid var(--line); display: flex; gap: 5mm; }}
.gaps .where {{ color: var(--accent); white-space: nowrap; min-width: 16mm; }}
.legend {{ color: var(--muted); font-size: 9.5pt; display: flex; flex-wrap: wrap; gap: 2mm 7mm; }}
</style></head><body>

<section class="cover">
  <div class="kicker">טיוטת עבודה · {date.today().strftime('%d.%m.%Y')}</div>
  <h1>לתכנת את המוח</h1>
  <p class="lede">ב-7 באוקטובר הייתי נעול בממ"ד. אבל רק אז הבנתי שאני נעול בממ"ד כבר שנים.</p>
  <div class="stats">
    <div class="stat"><b>{len(docs)}</b><span>חלקים</span></div>
    <div class="stat"><b>{total:,}</b><span>מילים</span></div>
    <div class="stat"><b>~{round(total / WPM)}</b><span>דקות דיבור</span></div>
    <div class="stat"><b>{len(gaps)}</b><span>מקומות שמחכים לך</span></div>
  </div>
</section>

<section class="overview">
  <h3>הרעיון המרכזי</h3>
  <p class="idea">ב-7 באוקטובר הייתי נעול בממ"ד. אבל רק אז הבנתי שאני נעול בממ"ד כבר שנים. ממ"ד שנקרא "אי אפשר", "לא עכשיו", "מחר", "עוד שנה".</p>

  <h3>לפני העלייה לבמה: סרטון הפתיח (כ-1:30)</h3>
  <table><tbody>{opening}</tbody></table>

  <h3>מבנה ההרצאה</h3>
  <table>
    <thead><tr><th>#</th><th>חלק</th><th>מילים</th><th>דק'</th><th>סטטוס</th></tr></thead>
    <tbody>{rows}</tbody>
    <tfoot><tr><td></td><td>סה"כ</td><td class="num">{total:,}</td><td class="num">{minutes(total)}</td><td>{f"בלי המחשבות האופציונליות: כ-{minutes(total - opt_total)} דק'" if opt_total else ""}</td></tr></tfoot>
  </table>

  <h3>איך לקרוא את הטקסט</h3>
  <div class="legend">
    <span><span class="p1">/</span> נשימה קצרה</span>
    <span><span class="p2">//</span> עצירה</span>
    <span><span class="dir">הוראת במה</span></span>
    <span><span class="cue">▣ מה מוצג על המסך</span></span>
    <span><mark>פרט שעוד חסר</mark></span>
    <span><span class="opt">מחשבה אופציונלית</span></span>
  </div>
</section>

{parts}

<section class="gaps">
  <h2>מה עוד חסר</h2>
  <p class="sub">כל המקומות המסומנים בטקסט, לפי הסדר.</p>
  <ul>{gap_items}</ul>

  <h3>מחקרים ומקורות בטקסט</h3>
  <table><thead><tr><th>מקור</th><th>מה הוא אומר</th><th>איפה</th></tr></thead><tbody>{src_rows}</tbody></table>
  <p class="sub">הפירוט המלא, עם קישורים ורמת אמינות: sources/research-brain-programming.md</p>
</section>
</body></html>"""
    out.write_text(doc, encoding="utf-8")
    print(f"wrote {out}: {len(docs)} parts, {total} words, {len(gaps)} gaps")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--clean"]
    if len(args) != 3:
        sys.exit(__doc__)
    (build_clean if "--clean" in sys.argv else build)(Path(args[0]), Path(args[1]).resolve(), Path(args[2]))
