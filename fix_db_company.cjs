const fs = require('fs');
let code = fs.readFileSync('server/db.ts', 'utf-8');

if (!code.includes('createCompany:')) {
  code = code.replace(
    /getAllCompanies: \(\): Company\[\] => \{[\s\S]*?\},/,
    `getAllCompanies: (): Company[] => {
    return dbState.companies;
  },
  createCompany: (company: Company): Company => {
    dbState.companies.push(company);
    saveDatabaseSync();
    return company;
  },`
  );
  fs.writeFileSync('server/db.ts', code);
  console.log("Added createCompany");
}
