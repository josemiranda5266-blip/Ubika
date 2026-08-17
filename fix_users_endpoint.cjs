const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const usersEndpoint = `
  app.get("/api/users", authenticateUser, requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
    const cid = req.user?.role === 'SUPER_ADMIN' && req.query.companyId ? req.query.companyId as string : req.user!.companyId;
    const users = db.getUsersByCompany(cid).map(u => {
      const { passwordHash, ...safeUser } = u;
      return safeUser;
    });
    res.json(users);
  });

  app.post("/api/users", authenticateUser, requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
    const { name, email, password, role, driverId, phone } = req.body;
    
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "Nombre, email, contraseña y rol son obligatorios" });
    }

    // Role restrictions: public cannot create, but this is admin. Admin can only create allowed roles.
    const allowedRoles = ['DRIVER', 'KITCHEN', 'DISPATCHER'];
    if (!allowedRoles.includes(role)) {
       return res.status(403).json({ error: "Rol no permitido. Solo puede crear empleados operativos." });
    }

    const existingUser = db.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: "El correo electrónico ya está registrado" });
    }

    const cid = req.user?.role === 'SUPER_ADMIN' && req.body.companyId ? req.body.companyId : req.user!.companyId;

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    
    const newUser = {
      id: \`usr_\${Date.now()}\`,
      email,
      passwordHash,
      name,
      role,
      companyId: cid,
      driverId: role === 'DRIVER' ? driverId : undefined,
      phone,
      createdAt: Date.now(),
      active: true,
    };

    db.createUser(newUser);

    const { passwordHash: _ph, ...safeUser } = newUser;
    res.status(201).json(safeUser);
  });
`;

if (!code.includes('/api/users')) {
  code = code.replace(
    /app\.post\("\/api\/drivers",/,
    usersEndpoint + '\n  app.post("/api/drivers",'
  );
  fs.writeFileSync('server.ts', code);
  console.log("Added /api/users endpoints");
}
