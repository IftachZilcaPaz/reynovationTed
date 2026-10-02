// Build an editable, right-to-left Word file from the proofread reading version.
// usage: NODE_PATH=<dir with docx> node tools/build_docx.cjs talk/reading-version.md <out.docx>
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');

const PART_TITLES = ['לפני', 'ההחלטה', 'הקוד שירשנו', 'לתכנת את המוח', 'הקפיצה', 'אליכם'];
const FONT = { ascii: 'Arial', hAnsi: 'Arial', cs: 'Arial' };

const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error('usage: build_docx.cjs <reading-version.md> <out.docx>'); process.exit(2); }

const parts = fs.readFileSync(src, 'utf8').split(/\n-{3,}\n/).map((part) =>
  part.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean));

const run = (text, extra = {}) => new TextRun({ text, rightToLeft: true, font: FONT, ...extra });
const heading = (text, level) => new Paragraph({
  heading: level, bidirectional: true, alignment: AlignmentType.START, children: [run(text)],
});
const body = (text) => new Paragraph({
  bidirectional: true, alignment: AlignmentType.BOTH, spacing: { after: 160, line: 360 }, children: [run(text)],
});

const children = [heading('לתכנת את המוח', HeadingLevel.TITLE)];
parts.forEach((paras, i) => {
  children.push(heading(`חלק ${i + 1} · ${PART_TITLES[i] || ''}`.trim(), HeadingLevel.HEADING_1));
  paras.forEach((p) => children.push(body(p)));
});

const doc = new Document({
  creator: 'reynovationTed',
  title: 'לתכנת את המוח',
  styles: {
    default: { document: { run: { font: FONT, size: 24, sizeComplexScript: 24, rightToLeft: true } } },
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', run: { size: 52, sizeComplexScript: 52, bold: true, boldComplexScript: true, font: FONT }, paragraph: { spacing: { after: 360 } } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', run: { size: 32, sizeComplexScript: 32, bold: true, boldComplexScript: true, font: FONT, color: 'C4610A' }, paragraph: { spacing: { before: 480, after: 200 }, outlineLevel: 0 } },
    ],
  },
  sections: [{ properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, children }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(out, buf); console.log('wrote', out, parts.length, 'parts'); });
