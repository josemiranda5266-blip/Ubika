const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(
  /const businessType = category === 'Gastronomía' \|\| category === 'Restaurante \/ Comidas' \? 'FOOD' : 'LOGISTICS';/,
  "const businessType: 'FOOD' | 'LOGISTICS' = category === 'Gastronomía' || category === 'Restaurante / Comidas' ? 'FOOD' : 'LOGISTICS';"
);

fs.writeFileSync('server.ts', code);
