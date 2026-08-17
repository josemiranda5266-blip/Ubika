const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const registerEndpoint = `
  app.post("/api/auth/register", rateLimit(60000, 5), (req: Request, res: Response) => {
    const { companyName, responsibleName, email, phone, category, password } = req.body;
    
    if (!companyName || !responsibleName || !email || !password || !phone || !category) {
      return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }

    const existingUser = db.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: "El correo electrónico ya está registrado" });
    }

    const businessType = category === 'Gastronomía' || category === 'Restaurante / Comidas' ? 'FOOD' : 'LOGISTICS';
    
    const companyId = \`comp_\${Date.now()}\`;
    const newCompany = {
      id: companyId,
      name: companyName,
      category,
      address: '',
      phone,
      city: '',
      activeOrdersCount: 0,
      totalDriversCount: 0,
      businessType,
      foodEnabled: businessType === 'FOOD'
    };

    db.createCompany(newCompany);

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    
    const newUser = {
      id: \`usr_\${Date.now()}\`,
      email,
      passwordHash,
      name: responsibleName,
      role: 'COMPANY_ADMIN' as const,
      companyId: companyId,
      phone,
      createdAt: Date.now(),
      active: true,
    };

    db.createUser(newUser);

    const token = generateAuthToken(newUser);

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        companyId: newUser.companyId,
      },
      company: newCompany
    });
  });
`;

if (!code.includes('/api/auth/register')) {
  code = code.replace(
    /app\.post\("\/api\/auth\/login",/,
    registerEndpoint + '\n  app.post("/api/auth/login",'
  );
  fs.writeFileSync('server.ts', code);
  console.log("Added /api/auth/register");
}
