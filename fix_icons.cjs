const fs = require('fs');
let code = fs.readFileSync('src/components/control/UbikaControl.tsx', 'utf-8');

if (!code.includes(' User,')) {
  code = code.replace(/Users,/, 'Users, User,');
  fs.writeFileSync('src/components/control/UbikaControl.tsx', code);
}
