import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourcePath = path.join(root, 'scripts', 'apply-legal-compliance-v2.mjs');
const fixedPath = path.join(root, 'scripts', '.apply-legal-compliance-fixed.mjs');
let source = fs.readFileSync(sourcePath, 'utf8');

// Make the legacy migration tolerant of UBIKA's current db.createUser signature.
source = source.replace(/db = once\(db, '  createUser:[\s\S]*?'createUser normalization'\);\n/, '');
// Strip literal backticks embedded in the README template before parsing the migration.
source = source.replace(/\\+`digitalComplaintBookUrl\\+`/g, 'digitalComplaintBookUrl');
fs.writeFileSync(fixedPath, source, 'utf8');

try {
  await import('file://' + fixedPath);
} finally {
  fs.rmSync(fixedPath, { force: true });
}

// Apply the createUser normalization after the legacy migration has written server/db.ts.
const dbPath = path.join(root, 'server', 'db.ts');
let db = fs.readFileSync(dbPath, 'utf8');
if (db.includes('privacyPolicyAccepted: boolean;') && !db.includes('UserRecordInput')) {
  db = db.replace('  createdAt: number;\n  active: boolean;\n}', '  createdAt: number;\n  active: boolean;\n  privacyPolicyAccepted: boolean;\n  privacyPolicyAcceptedAt: number;\n  termsOfServiceAccepted: boolean;\n  termsOfServiceAcceptedAt?: number;\n}\n\nexport type UserRecordInput = Omit<UserRecord, \'privacyPolicyAccepted\' | \'privacyPolicyAcceptedAt\' | \'termsOfServiceAccepted\'> & Partial<Pick<UserRecord, \'privacyPolicyAccepted\' | \'privacyPolicyAcceptedAt\' | \'termsOfServiceAccepted\' | \'termsOfServiceAcceptedAt\'>>;');
}
const createUserPattern = /  createUser: \(user: UserRecord\)[^\{]*\{[\s\S]*?\n  \},/;
if (createUserPattern.test(db)) {
  db = db.replace(createUserPattern, "  createUser: (user: UserRecordInput): UserRecord => {\n    const createdAt = user.createdAt || Date.now();\n    const normalized: UserRecord = { ...user, privacyPolicyAccepted: user.privacyPolicyAccepted ?? true, privacyPolicyAcceptedAt: user.privacyPolicyAcceptedAt ?? createdAt, termsOfServiceAccepted: user.termsOfServiceAccepted ?? true, termsOfServiceAcceptedAt: user.termsOfServiceAcceptedAt ?? createdAt };\n    dbState.users.push(normalized);\n    saveDatabaseSync();\n    return normalized;\n  },");
}
fs.writeFileSync(dbPath, db, 'utf8');
console.log('UBIKA legal compliance migration completed.');
