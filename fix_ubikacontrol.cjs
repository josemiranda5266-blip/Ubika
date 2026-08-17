const fs = require('fs');
let code = fs.readFileSync('src/components/control/UbikaControl.tsx', 'utf-8');

if (!code.includes('UsersManagementView')) {
  code = code.replace(
    /import \{ AuditEventsView \} from '\.\/AuditEventsView';/,
    `import { AuditEventsView } from './AuditEventsView';
import { UsersManagementView } from './UsersManagementView';`
  );

  code = code.replace(
    /type TabType = 'dashboard' \| 'history' \| 'map' \| 'drivers' \| 'routes' \| 'audit';/,
    `type TabType = 'dashboard' | 'history' | 'map' | 'drivers' | 'routes' | 'audit' | 'users';`
  );

  code = code.replace(
    /<div className="space-y-2">/,
    `<div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setCurrentTab('users');
                  setIsMoreMenuOpen(false);
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-orange-50 text-slate-900 font-bold text-sm border border-slate-100 transition-colors min-h-[48px]"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <span>Personal y Accesos</span>
                    <p className="text-[11px] text-slate-400 font-medium">Cuentas de empleados</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>`
  );

  code = code.replace(
    /\{currentTab === 'audit' && <AuditEventsView companyId={selectedCompanyId} \/>\}/,
    `{currentTab === 'audit' && <AuditEventsView companyId={selectedCompanyId} />}
          {currentTab === 'users' && <UsersManagementView />}`
  );

  // Note: we need User icon import for the sidebar if not already present
  if (!code.includes('User,') && !code.includes(' User ')) {
     code = code.replace(/Users,/, 'Users, User,');
  }

  fs.writeFileSync('src/components/control/UbikaControl.tsx', code);
  console.log("Updated UbikaControl");
}
