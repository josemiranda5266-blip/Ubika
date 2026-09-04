import fs from 'node:fs';
import path from 'node:path';

const sourcePath = path.join(process.cwd(), 'scripts', 'apply-legal-compliance-v2.mjs');
const fixedPath = path.join(process.cwd(), 'scripts', '.apply-legal-compliance-fixed.mjs');
let source = fs.readFileSync(sourcePath, 'utf8');
// Strip escaped backticks around the README identifier before parsing v2.
source = source.replace(/\\+`digitalComplaintBookUrl\\+`/g, 'digitalComplaintBookUrl');
fs.writeFileSync(fixedPath, source, 'utf8');
try {
  await import('file://' + fixedPath);
} finally {
  fs.rmSync(fixedPath, { force: true });
}
