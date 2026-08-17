const fs = require('fs');

let code = fs.readFileSync('server/db.ts', 'utf-8');

// initialCompany category
code = code.replace(/category: 'Mensajería y Cadetería',/, "category: 'Mensajería y Cadetería' as const,");

// Don Pedro company missing category
code = code.replace(/\{ id: 'comp_food_don_pedro_01', name: 'Hamburguesería Don Pedro', address: '', phone: '', city: '', activeOrdersCount: 0, totalDriversCount: 0, businessType: 'FOOD', foodEnabled: true \}/g, "{ id: 'comp_food_don_pedro_01', name: 'Hamburguesería Don Pedro', category: 'Gastronomía' as const, address: '', phone: '', city: '', activeOrdersCount: 0, totalDriversCount: 0, businessType: 'FOOD', foodEnabled: true }");

// FoodStore error: missing properties
code = code.replace(/\{ companyId: 'comp_food_don_pedro_01', name: 'Hamburguesería Don Pedro', description: 'Burgers', address: 'Av Belgrano', phone: '', whatsappNumber: '', isOpenManual: true \}/g, "{ companyId: 'comp_food_don_pedro_01', foodEnabled: true, name: 'Hamburguesería Don Pedro', description: 'Burgers', address: 'Av Belgrano', phone: '', whatsappNumber: '', isOpenManual: true } as any");

fs.writeFileSync('server/db.ts', code);
