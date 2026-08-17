const fs = require('fs');
let code = fs.readFileSync('src/components/Login.tsx', 'utf-8');

if (!code.includes('isRegistering')) {
  code = code.replace(
    /export const Login: React\.FC<LoginProps> = \(\{ onLoginSuccess \}\) => \{/,
    `import { Register } from './Register';
export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);`
  );

  code = code.replace(
    /return \(/,
    `if (isRegistering) {
    return <Register onRegisterSuccess={onLoginSuccess} onCancel={() => setIsRegistering(false)} />;
  }

  return (`
  );

  code = code.replace(
    /<\/form>/,
    `</form>
        <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col gap-3">
          <button type="button" onClick={() => alert('Para recuperar su contraseña, por favor contacte a soporte técnico en soporte@ubika.app (Funcionalidad en desarrollo)')} className="text-[11px] font-bold text-slate-500 hover:text-orange-500 transition-colors uppercase tracking-wider">
            ¿Olvidaste tu contraseña?
          </button>
          <div className="flex flex-col items-center gap-2 mt-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">¿Todavía no tienes una cuenta?</span>
            <button type="button" onClick={() => setIsRegistering(true)} className="w-full py-2.5 border border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-black uppercase tracking-wider transition-all">
              REGISTRAR MI COMERCIO
            </button>
          </div>
        </div>`
  );

  fs.writeFileSync('src/components/Login.tsx', code);
  console.log("Updated Login.tsx");
}
