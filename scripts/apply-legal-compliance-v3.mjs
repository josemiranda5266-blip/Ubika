import fs from 'node:fs';
import path from 'node:path';

const sourcePath = path.join(process.cwd(), 'scripts', 'apply-legal-compliance-v2.mjs');
const fixedPath = path.join(process.cwd(), 'scripts', '.apply-legal-compliance-fixed.mjs');
let source = fs.readFileSync(sourcePath, 'utf8');
// v2 is valid except for literal backticks embedded in its README template literal.
source = source.replaceAll('\\`digitalComplaintBookUrl\\`', 'digitalComplaintBookUrl');
fs.writeFileSync(fixedPath, source, 'utf8');
try {
  await import('file://' + fixedPath);
} finally {
  fs.rmSync(fixedPath, { force: true });
}
