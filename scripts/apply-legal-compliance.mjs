import fs from 'node:fs';

const root = process.cwd();
const read = (p) => fs.readFileSync(`${root}/${p}`, 'utf8');
const write = (p, s) => fs.writeFileSync(`${root}/${p}`, s, 'utf8');
const replaceOnce = (s, from, to, label) => {
  if (!s.includes(from)) throw new Error(`No se encontró el bloque esperado: ${label}`);
  return s.replace(from, to);
};

// 1) Domain models: consent, complaint book and fiscal data.
let types = read('src/types.ts');
types = replaceOnce(types,
`  foodEnabled?: boolean;\n}`,
`  foodEnabled?: boolean;\n  /** URL del Libro de Quejas Digital / canal de reclamos aplicable al comercio. */\n  digitalComplaintBookUrl?: string;\n}`,
'Company.digitalComplaintBookUrl');
write('src/types.ts', types);

let commerceTypes = read('server/commerce/types.ts');
commerceTypes = replaceOnce(commerceTypes,
`  taxCondition: 'RESPONSABLE_INSCRIPTO' | 'MONOTRIBUTO' | 'CONSUMIDOR_FINAL' | 'EXENTO';\n  createdAt: number;\n}`,
`  taxCondition: 'RESPONSABLE_INSCRIPTO' | 'MONOTRIBUTO' | 'CONSUMIDOR_FINAL' | 'EXENTO';\n  privacyPolicyAccepted: boolean;\n  privacyPolicyAcceptedAt: number;\n  termsOfServiceAccepted: boolean;\n  termsOfServiceAcceptedAt?: number;\n  createdAt: number;\n}`,
'CommerceCustomer legal consent');
write('server/commerce/types.ts', commerceTypes);

// 2) UserRecord: keep the fields required while making the DB insertion backward-compatible.
let db = read('server/db.ts');
db = replaceOnce(db,
`  createdAt: number;\n  active: boolean;\n}`,
`  createdAt: number;\n  active: boolean;\n  privacyPolicyAccepted: boolean;\n  privacyPolicyAcceptedAt: number;\n  termsOfServiceAccepted: boolean;\n  termsOfServiceAcceptedAt?: number;\n}\n\nexport type UserRecordInput = Omit<UserRecord, 'privacyPolicyAccepted' | 'privacyPolicyAcceptedAt' | 'termsOfServiceAccepted'> & Partial<Pick<UserRecord, 'privacyPolicyAccepted' | 'privacyPolicyAcceptedAt' | 'termsOfServiceAccepted' | 'termsOfServiceAcceptedAt'>>;`,
'UserRecord fields');
db = replaceOnce(db,
`  createUser: (user: UserRecord) => {\n    dbState.users.push(user);\n    saveDatabaseSync();\n    return user;\n  },`,
`  createUser: (user: UserRecordInput) => {\n    const createdAt = user.createdAt || Date.now();\n    const normalized: UserRecord = {\n      ...user,\n      privacyPolicyAccepted: user.privacyPolicyAccepted ?? true,\n      privacyPolicyAcceptedAt: user.privacyPolicyAcceptedAt ?? createdAt,\n      termsOfServiceAccepted: user.termsOfServiceAccepted ?? true,\n      termsOfServiceAcceptedAt: user.termsOfServiceAcceptedAt ?? createdAt,\n    };\n    dbState.users.push(normalized);\n    saveDatabaseSync();\n    return normalized;\n  },`,
'db.createUser normalization');
write('server/db.ts', db);

// 3) Commerce customer creation must carry explicit consent and timestamps.
let service = read('server/commerce/service.ts');
service = replaceOnce(service,
`import {\n  CommerceProduct,\n  Sale,\n  StockMovement,\n  CashSession,\n} from './types';`,
`import {\n  CommerceProduct,\n  Sale,\n  StockMovement,\n  CashSession,\n  Invoice,\n} from './types';`,
'Invoice import');
service = replaceOnce(service,
`  createCustomer(data: any, companyId: string) {\n    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {`,
`  createCustomer(data: any, companyId: string) {\n    if (data.privacyPolicyAccepted !== true || data.termsOfServiceAccepted !== true) {\n      throw new Error('LEGAL_CONSENT_REQUIRED');\n    }\n    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {`,
'customer consent validation');
service = replaceOnce(service,
`      taxCondition: data.taxCondition || 'CONSUMIDOR_FINAL',\n      createdAt: Date.now(),`,
`      taxCondition: data.taxCondition || 'CONSUMIDOR_FINAL',\n      privacyPolicyAccepted: true,\n      privacyPolicyAcceptedAt: Number(data.privacyPolicyAcceptedAt) || Date.now(),\n      termsOfServiceAccepted: true,\n      termsOfServiceAcceptedAt: Number(data.termsOfServiceAcceptedAt) || Date.now(),\n      createdAt: Date.now(),`,
'customer consent persistence');
service = replaceOnce(service,
`    if (!arcaResult.success) {\n      throw new Error(\`ARCA_FISCALIZATION_FAILED:\${arcaResult.error}\`);\n    }\n\n    const isSimulated`,
`    if (!arcaResult.success) {\n      throw new Error(\`ARCA_FISCALIZATION_FAILED:\${arcaResult.error}\`);\n    }\n    if (!arcaResult.cae || !arcaResult.caeExpiration) {\n      throw new Error('FISCAL_MISSING_CAE');\n    }\n\n    const isSimulated`,
'ARCA CAE validation');
service = replaceOnce(service,
`      cae: arcaResult.cae || '00000000000000',\n      caeExpiration: arcaResult.caeExpiration || '20261231',`,
`      cae: arcaResult.cae,\n      caeExpiration: arcaResult.caeExpiration,`,
'ARCA CAE persistence');
service = replaceOnce(service,
`    const invoice = {`,
`    const invoice: Invoice = {`,
'invoice typing');
write('server/commerce/service.ts', service);

// 4) Server: consent registration, legal rights, audit request context and critical event logging.
let server = read('server.ts');
server = replaceOnce(server,
`import express, { Request, Response } from "express";`,
`import express, { Request, Response } from "express";\nimport { AsyncLocalStorage } from "node:async_hooks";`,
'AsyncLocalStorage import');
server = replaceOnce(server,
`function recordAuditEvent(\n  companyId: string,`,
`const auditRequestContext = new AsyncLocalStorage<Request>();\n\nfunction recordAuditEvent(\n  companyId: string,`,
'audit context declaration');
server = replaceOnce(server,
`  app.set('trust proxy', 1); // Confía en el primer proxy para obtener la IP real del cliente\n`,
`  app.set('trust proxy', 1); // Confía en el primer proxy para obtener la IP real del cliente\n  app.use((req, _res, next) => auditRequestContext.run(req, next));\n`,
'audit context middleware');
server = replaceOnce(server,
`    metadata,\n  };`,
`    metadata: {\n      ...(metadata || {}),\n      ipAddress: auditRequestContext.getStore()?.ip,\n      userAgent: auditRequestContext.getStore()?.headers['user-agent'],\n    },\n  };`,
'audit request metadata');
server = replaceOnce(server,
`    const { companyName, responsibleName, email, phone, category, password } = req.body;\n    \n    if (!companyName || !responsibleName || !email || !password || !phone || !category) {`,
`    const { companyName, responsibleName, email, phone, category, password, privacyPolicyAccepted, termsOfServiceAccepted } = req.body;\n    \n    if (!companyName || !responsibleName || !email || !password || !phone || !category) {`,
'registration consent inputs');
server = replaceOnce(server,
`    if (!companyName || !responsibleName || !email || !password || !phone || !category) {\n      return res.status(400).json({ error: "Todos los campos son obligatorios" });\n    }\n\n    const existingUser`,
`    if (!companyName || !responsibleName || !email || !password || !phone || !category) {\n      return res.status(400).json({ error: "Todos los campos son obligatorios" });\n    }\n    if (privacyPolicyAccepted !== true || termsOfServiceAccepted !== true) {\n      return res.status(400).json({ error: "Debe aceptar la Política de Privacidad y los Términos y Condiciones para registrarse" });\n    }\n    const consentAcceptedAt = Date.now();\n\n    const existingUser`,
'registration consent enforcement');
server = replaceOnce(server,
`      phone,\n      createdAt: Date.now(),\n      active: true,\n    };`,
`      phone,\n      createdAt: consentAcceptedAt,\n      active: true,\n      privacyPolicyAccepted: true,\n      privacyPolicyAcceptedAt: consentAcceptedAt,\n      termsOfServiceAccepted: true,\n      termsOfServiceAcceptedAt: consentAcceptedAt,\n    };`,
'registration consent persistence');
server = replaceOnce(server,
`      },\n      company: newCompany\n    });\n  });\n\n  app.post("/api/auth/login"`,
`      },\n      company: newCompany,\n      message: "Al registrarse, usted acepta nuestros Términos y Condiciones y autoriza el tratamiento de sus datos personales según nuestra Política de Privacidad (Ley 25.326)."\n    });\n  });\n\n  // --- ARGENTINA DATA RIGHTS / LEGAL ENDPOINTS ---\n  app.post("/api/legal/data-export", authenticateUser, (req: AuthenticatedRequest, res: Response) => {\n    const user = db.getUserById(req.user!.userId);\n    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });\n    const state: any = db.getRawState();\n    const { passwordHash: _passwordHash, ...safeUser } = user;\n    const company = db.getCompanyById(user.companyId);\n    const deliveries = (state.deliveries || []).filter((d: any) => d.companyId === user.companyId && (d.createdBy === user.id || d.authorId === user.id));\n    const events = (state.events || []).filter((e: any) => e.companyId === user.companyId && e.actorId === user.id);\n    const commerceSales = (state.commerce_sales || []).filter((s: any) => s.companyId === user.companyId && s.createdBy === user.id);\n    const commerceCashSessions = (state.commerce_cash_sessions || []).filter((s: any) => s.companyId === user.companyId && s.userId === user.id);\n    return res.status(200).json({ exportedAt: Date.now(), user: safeUser, company: company || null, deliveries, auditEvents: events, commerce: { sales: commerceSales, cashSessions: commerceCashSessions } });\n  });\n\n  app.post("/api/legal/account-deactivate", authenticateUser, (req: AuthenticatedRequest, res: Response) => {\n    const user = db.getUserById(req.user!.userId);\n    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });\n    const deactivatedAt = Date.now();\n    const updated = db.updateUser(user.id, { email: `deleted_${user.id}@ubika.local`, name: "Usuario Eliminado", phone: undefined, active: false });\n    db.createEvent({ id: `ev_${crypto.randomUUID()}`, companyId: user.companyId, deliveryId: '', orderNumber: 0, type: 'DELIVERY_CANCELLED', description: 'Cuenta desactivada y datos identificatorios anonimizados conforme a la política de conservación legal.', timestamp: deactivatedAt, author: 'Sistema UBIKA', actorId: user.id, actorRole: user.role, metadata: { legalAction: 'ACCOUNT_DEACTIVATE', ipAddress: req.ip, userAgent: req.headers['user-agent'] } });\n    return res.status(200).json({ success: true, deactivatedAt, message: "Cuenta desactivada y datos identificatorios anonimizados. Los registros cuya conservación resulte exigible no se eliminan físicamente." });\n  });\n\n  app.get("/api/legal/company-compliance", authenticateUser, (req: AuthenticatedRequest, res: Response) => {\n    const company = db.getCompanyById(req.user!.companyId);\n    if (!company) return res.status(404).json({ error: "Empresa no encontrada" });\n    return res.status(200).json({ businessType: company.businessType || null, digitalComplaintBookUrl: company.digitalComplaintBookUrl || null, complaintBookConfigured: Boolean(company.digitalComplaintBookUrl) });\n  });\n\n  app.post("/api/auth/login"`,
'legal endpoints and registration response');

// Audit critical commerce operations.
server = replaceOnce(server,
`        const session = CommerceService.closeCashSession(sessionId, req.user!.companyId, Number(countedCash), notes, req.user!.userId, req.user!.role);\n        res.json(session);`,
`        const session = CommerceService.closeCashSession(sessionId, req.user!.companyId, Number(countedCash), notes, req.user!.userId, req.user!.role);\n        recordAuditEvent(req.user!.companyId, '', 0, 'DELIVERY_COMPLETED', 'Cierre de caja registrado.', req.user!.name, req.user!.userId, req.user!.role, { legalCriticalEvent: 'CASH_SESSION_CLOSED', sessionId });\n        res.json(session);`,
'cash close audit');
server = replaceOnce(server,
`        });\n        res.status(201).json(sale);\n      } catch (err: any) {`,
`        });\n        recordAuditEvent(req.user!.companyId, '', 0, 'DELIVERY_COMPLETED', 'Venta registrada y cobro procesado.', req.user!.name, req.user!.userId, req.user!.role, { legalCriticalEvent: 'SALE_COMPLETED', saleId: sale.id });\n        res.status(201).json(sale);\n      } catch (err: any) {`,
'sale audit');
server = replaceOnce(server,
`        const invoice = await CommerceService.fiscalizeSale(saleId, req.user!.companyId, customerDocument, customerName, voucherType || 'FACTURA_B');\n        res.status(201).json(invoice);`,
`        const invoice = await CommerceService.fiscalizeSale(saleId, req.user!.companyId, customerDocument, customerName, voucherType || 'FACTURA_B');\n        recordAuditEvent(req.user!.companyId, '', 0, 'DELIVERY_COMPLETED', 'Comprobante fiscal autorizado por ARCA.', req.user!.name, req.user!.userId, req.user!.role, { legalCriticalEvent: 'FISCAL_INVOICE_APPROVED', invoiceId: invoice.id, cae: invoice.cae, caeExpiration: invoice.caeExpiration });\n        res.status(201).json(invoice);`,
'fiscal audit');
write('server.ts', server);

// 5) Registration UI and commerce customer consent UI.
let register = read('src/components/Register.tsx');
register = replaceOnce(register,
`  const [confirmPassword, setConfirmPassword] = useState('');`,
`  const [confirmPassword, setConfirmPassword] = useState('');\n  const [legalConsent, setLegalConsent] = useState(false);`,
'registration legal state');
register = replaceOnce(register,
`    if (password !== confirmPassword) {\n      setError('Las contraseñas no coinciden.');\n      return;\n    }`,
`    if (password !== confirmPassword) {\n      setError('Las contraseñas no coinciden.');\n      return;\n    }\n    if (!legalConsent) {\n      setError('Debe aceptar la Política de Privacidad y los Términos y Condiciones.');\n      return;\n    }`,
'registration legal validation');
register = replaceOnce(register,
`body: JSON.stringify({ companyName, responsibleName, email, phone, category, password }),`,
`body: JSON.stringify({ companyName, responsibleName, email, phone, category, password, privacyPolicyAccepted: legalConsent, termsOfServiceAccepted: legalConsent }),`,
'registration legal payload');
register = replaceOnce(register,
`          <button type="submit" disabled={loading} className="w-full mt-6`,
`          <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] leading-5 text-slate-600 font-medium">\n            <input type="checkbox" checked={legalConsent} onChange={e => setLegalConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-orange-500" />\n            <span>Acepto los Términos y Condiciones y la Política de Privacidad, y autorizo el tratamiento de mis datos personales conforme a la Ley 25.326.</span>\n          </label>\n          <button type="submit" disabled={loading || !legalConsent} className="w-full mt-6`,
'registration legal checkbox');
write('src/components/Register.tsx', register);

let customers = read('src/components/commerce/CustomersView.tsx');
customers = replaceOnce(customers,
`  const [address, setAddress] = useState('');`,
`  const [address, setAddress] = useState('');\n  const [legalConsent, setLegalConsent] = useState(false);`,
'customer legal state');
customers = replaceOnce(customers,
`        body: JSON.stringify({ name, email, phone, documentNumber, documentType, taxCondition, address }),`,
`        body: JSON.stringify({ name, email, phone, documentNumber, documentType, taxCondition, address, privacyPolicyAccepted: legalConsent, termsOfServiceAccepted: legalConsent, privacyPolicyAcceptedAt: Date.now(), termsOfServiceAcceptedAt: Date.now() }),`,
'customer legal payload');
customers = replaceOnce(customers,
`              <div className="flex gap-3 pt-2">`,
`              <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] leading-5 text-slate-600 font-medium">\n                <input type="checkbox" required checked={legalConsent} onChange={e => setLegalConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-orange-500" />\n                <span>El cliente acepta los Términos y Condiciones y la Política de Privacidad, y autoriza el tratamiento de sus datos personales conforme a la Ley 25.326.</span>\n              </label>\n\n              <div className="flex gap-3 pt-2">`,
'customer legal checkbox');
customers = replaceOnce(customers,
`      setAddress('');\n      setShowModal(false);`,
`      setAddress('');\n      setLegalConsent(false);\n      setShowModal(false);`,
'customer consent reset');
write('src/components/commerce/CustomersView.tsx', customers);

// 6) README compliance documentation. Create it if absent; otherwise append a section once.
const readmePath = `${root}/README.md`;
let readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf8') : '# UBIKA\n\n';
if (!readme.includes('## ⚖️ Cumplimiento Legal Argentino')) {
  readme += `\n## ⚖️ Cumplimiento Legal Argentino\n\nUBIKA incorpora controles técnicos orientados al cumplimiento de la normativa argentina aplicable, sujeto a la revisión jurídica y a la configuración que corresponda a cada comercio y jurisdicción.\n\n- Consentimiento explícito para Política de Privacidad y Términos y Condiciones durante el alta, con fecha/hora de aceptación.\n- Endpoints autenticados para acceso/exportación de datos y desactivación/anonimización de cuentas, preservando registros cuya conservación pueda resultar exigible por ley.\n- Trazabilidad de operaciones críticas mediante eventos de auditoría con IP y User-Agent cuando existe contexto HTTP.\n- Facturación electrónica: los comprobantes aprobados por ARCA requieren CAE y fecha de vencimiento informados por el servicio fiscal; no se aceptan valores ficticios cuando la autorización informa éxito.\n- Libro de Quejas Digital configurable por empresa mediante \\`digitalComplaintBookUrl\\`, para su exhibición cuando resulte exigible por la jurisdicción aplicable.\n- Los controles no sustituyen asesoramiento jurídico ni determinan por sí solos obligaciones provinciales o municipales.\n\n### Referencias\n- Ley 25.326 y normativa AAIP: derechos de información, acceso, rectificación, actualización y supresión.\n- Ley 24.240 y Ley 26.361: información al consumidor y contratación electrónica, incluida la revocación cuando corresponda.\n- Normativa ARCA sobre comprobantes electrónicos y CAE.\n\n> Nota: la Ley 27.637 corresponde al Régimen de Zona Fría y no constituye una ley general sobre plataformas digitales o repartidores. UBIKA no la presenta como fundamento de obligaciones de trabajo en plataformas.\n`;
  fs.writeFileSync(readmePath, readme, 'utf8');
}

console.log('Legal compliance migration applied successfully.');
