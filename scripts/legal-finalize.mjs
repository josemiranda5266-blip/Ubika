import fs from 'node:fs';

const p = 'server.ts';
let s = fs.readFileSync(p, 'utf8');
const marker = '      company: newCompany\n    });';
if (!s.includes('Al registrarse, usted acepta nuestros Términos y Condiciones')) {
  if (!s.includes(marker)) throw new Error('Registration response marker not found');
  s = s.replace(marker, '      company: newCompany,\n      message: "Al registrarse, usted acepta nuestros Términos y Condiciones y autoriza el tratamiento de sus datos personales según nuestra Política de Privacidad (Ley 25.326)."\n    });');
}
fs.writeFileSync(p, s, 'utf8');
console.log('Final legal correction applied.');
