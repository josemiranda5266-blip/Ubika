import 'dotenv/config';
import express, { Request, Response } from "express";
import { AsyncLocalStorage } from "node:async_hooks";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import bcrypt from "bcryptjs";
import { createServer as createViteServer } from "vite";
import { db, hashToken, validatePassword, UserRole } from "./server/db";
import { EmailService } from "./server/email";
import { CommerceService } from "./server/commerce/service";
import {
  authenticateUser,
  requireRole,
  generateAuthToken,
  rateLimit,
  AuthenticatedRequest,
} from "./server/auth";
import type {
  Delivery,
  DeliveryStatus,
  PublicSessionData,
  VehicleType,
  Company,
  Driver,
  DriverStatus,
  TaskPriority,
  DeliveryEvent,
  DashboardMetrics,
  RoutePoint,
  FoodStore,
  FoodCategory,
  FoodProduct,
  FoodShippingRate,
  FoodOrder,
  FoodOrderItem,
  FoodOrderItemSelection,
  FoodOptionGroup,
  FoodOption,
  LocationCoords,
} from "./src/types";
import { isFoodAuthorizedCompany } from "./src/types";

// Validación de entorno crítica al iniciar
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('❌ ERROR CRÍTICO: JWT_SECRET no está definida o es demasiado corta (< 32 caracteres).');
  process.exit(1);
}

const FOOD_ADMIN_ROLES: (UserRole | string)[] = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'OPERATOR'];
const FOOD_PICKUP_ROLES: (UserRole | string)[] = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'OPERATOR'];
const FOOD_PAYMENT_ROLES: (UserRole | string)[] = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'OPERATOR'];
const FOOD_ORDER_STATUS_MERCHANT_ROLES: (UserRole | string)[] = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'DISPATCHER', 'OPERATOR'];

function isAuthorizedFoodAdmin(req: AuthenticatedRequest): boolean {
  return !!req.user && FOOD_ADMIN_ROLES.includes(req.user.role);
}

function isAuthorizedFoodPickup(req: AuthenticatedRequest): boolean {
  return !!req.user && FOOD_PICKUP_ROLES.includes(req.user.role);
}

function isAuthorizedFoodPayment(req: AuthenticatedRequest): boolean {
  return !!req.user && FOOD_PAYMENT_ROLES.includes(req.user.role);
}

function isAuthorizedFoodOrderStatusMerchant(req: AuthenticatedRequest): boolean {
  return !!req.user && FOOD_ORDER_STATUS_MERCHANT_ROLES.includes(req.user.role);
}

// Haversine distance calculator
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// Distance in KM
function calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const meters = calculateDistanceMeters(lat1, lon1, lat2, lon2);
  return Math.round((meters / 1000) * 100) / 100;
}

// Generate 5-character uppercase pickup code (e.g., A7K29) using cryptographically secure random bytes
function generatePickupCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const randomBytes = crypto.randomBytes(5);
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(randomBytes[i] % chars.length);
  }
  return code;
}

// Estimate ETA in minutes
function calculateEtaMinutes(distanceMeters: number, speedKmH = 25): number {
  if (!distanceMeters || distanceMeters <= 0) return 0;
  const speedMetersPerMinute = (speedKmH * 1000) / 60;
  return Math.max(1, Math.round(distanceMeters / speedMetersPerMinute));
}

// Generate Secure Cryptographic Session Token
function generateSecureToken(): string {
  return 'tok_live_' + crypto.randomBytes(16).toString('hex');
}

// Request context used to enrich audit events with network metadata.
const auditRequestContext = new AsyncLocalStorage<Request>();

// Helper to record immutable audit events
function recordAuditEvent(
  companyId: string,
  deliveryId: string,
  orderNumber: number,
  type: DeliveryEvent['type'],
  description: string,
  author: string,
  actorId?: string,
  actorRole?: string,
  metadata?: Record<string, any>
) {
  const event: DeliveryEvent = {
    id: `ev_${crypto.randomUUID()}`,
    companyId,
    deliveryId,
    orderNumber,
    type,
    description,
    timestamp: Date.now(),
    author,
    actorId,
    actorRole,
    metadata: { ...(metadata || {}), ipAddress: auditRequestContext.getStore()?.ip, userAgent: auditRequestContext.getStore()?.headers['user-agent'] },
  };
  db.createEvent(event);
  return event;
}

// Helper to purge customer coordinates on delivery completion or cancellation
function purgeCoordinatesIfFinished(delivery: Delivery): Delivery {
  if (delivery.status === 'entregado' || delivery.status === 'cancelado') {
    const hadCoordinates = !!delivery.recipientLocation;
    
    // Purge exact recipient coordinates from delivery
    delivery.recipientLocation = null;
    delivery.privacyPolicyPurged = true;
    delivery.endedAt = delivery.endedAt || Date.now();

    // Update location session status to PURGED
    const session = db.getSessionByToken(delivery.sessionToken);
    if (session) {
      db.updateSession(session.id, {
        status: 'PURGED',
        endedAt: Date.now(),
        recipientLocation: null,
      });
    }

    if (hadCoordinates) {
      recordAuditEvent(
        delivery.companyId,
        delivery.id,
        delivery.orderNumber,
        'LOCATION_PURGED',
        'Coordenadas exactas del destinatario purgadas según política de retención de privacidad.',
        'Sistema UBIKA',
        undefined,
        'SYSTEM'
      );
    }
  }
  return delivery;
}

export function createUbikaApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1); // Confía en el primer proxy para obtener la IP real del cliente
  app.use((req, _res, next) => auditRequestContext.run(req, next));

  // HITO 2: Security Headers & CORS Middleware (compatible with AI Studio Preview iframe)
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Previene MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Activa filtro XSS del navegador
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Controla información enviada en Referer header
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Content Security Policy adaptada para permitir la renderización en el iframe del sandbox
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self' 'unsafe-inline' https: http: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http:; style-src 'self' 'unsafe-inline' https: http:; img-src 'self' data: blob: https: http:; font-src 'self' data: https: http:; connect-src 'self' https: http: ws: wss:; frame-ancestors *;"
    );
    
    // Previene almacenamiento sensible en caché exclusivamente para la API
    if (req.path.startsWith('/api')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  const productImageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Formato no soportado. Usa JPG, PNG o WEBP.'));
      }
    },
  });

  // HITO 2: JSON Body Parser with strict 1MB limit for security
  app.use(express.json({ limit: '1mb' }));

  // Serve uploaded images statically
  app.use('/uploads', express.static(path.join(process.cwd(), 'data', 'uploads')));

  // --- HEALTH & STATUS ---
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      version: "2.0.0-prod",
      storage: "persistent-disk-json",
      timestamp: Date.now(),
    });
  });

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      version: "2.0.0-prod",
      storage: "persistent-disk-json",
      timestamp: Date.now(),
    });
  });

  // --- AUTHENTICATION ENDPOINTS ---
  
  app.post("/api/auth/register", rateLimit(60000, 5), (req: Request, res: Response) => {
    const { companyName, responsibleName, email, phone, category, password, privacyPolicyAccepted, termsOfServiceAccepted } = req.body;
    
    if (!companyName || !responsibleName || !email || !password || !phone || !category) {
      return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }
    if (privacyPolicyAccepted !== true || termsOfServiceAccepted !== true) {
      return res.status(400).json({ error: "Debe aceptar la Política de Privacidad y los Términos y Condiciones para registrarse" });
    }
    const consentAcceptedAt = Date.now();

    const existingUser = db.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: "El correo electrónico ya está registrado" });
    }

    const businessType: 'FOOD' | 'LOGISTICS' = category === 'Gastronomía' || category === 'Restaurante / Comidas' ? 'FOOD' : 'LOGISTICS';
    
    const companyId = `comp_${Date.now()}`;
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
      id: `usr_${Date.now()}`,
      email,
      passwordHash,
      name: responsibleName,
      role: 'COMPANY_ADMIN' as const,
      companyId: companyId,
      phone,
      createdAt: consentAcceptedAt,
      active: true,
      privacyPolicyAccepted: true,
      privacyPolicyAcceptedAt: consentAcceptedAt,
      termsOfServiceAccepted: true,
      termsOfServiceAcceptedAt: consentAcceptedAt,
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
      company: newCompany,
      message: "Al registrarse, usted acepta nuestros Términos y Condiciones y autoriza el tratamiento de sus datos personales según nuestra Política de Privacidad (Ley 25.326)."
    });
  });

  // --- ARGENTINA DATA RIGHTS / LEGAL ENDPOINTS ---
  app.post("/api/legal/data-export", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    const user = db.getUserById(req.user!.userId);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    const state: any = db.getRawState();
    const safeUser = { ...user } as any;
    delete safeUser.passwordHash;
    const company = db.getCompanyById(user.companyId);
    const deliveries = (state.deliveries || []).filter((d: any) => d.companyId === user.companyId && (d.createdBy === user.id || d.authorId === user.id));
    const events = (state.events || []).filter((e: any) => e.companyId === user.companyId && e.actorId === user.id);
    const commerceSales = (state.commerce_sales || []).filter((s: any) => s.companyId === user.companyId && s.createdBy === user.id);
    const commerceCashSessions = (state.commerce_cash_sessions || []).filter((s: any) => s.companyId === user.companyId && s.userId === user.id);
    return res.status(200).json({ exportedAt: Date.now(), user: safeUser, company: company || null, deliveries, auditEvents: events, commerce: { sales: commerceSales, cashSessions: commerceCashSessions } });
  });

  app.post("/api/legal/account-deactivate", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    const user = db.getUserById(req.user!.userId);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    const deactivatedAt = Date.now();
    db.updateUser(user.id, { email: 'deleted_' + user.id + '@ubika.local', name: 'Usuario Eliminado', phone: undefined, active: false });
    db.createEvent({ id: 'ev_' + crypto.randomUUID(), companyId: user.companyId, deliveryId: '', orderNumber: 0, type: 'DELIVERY_CANCELLED', description: 'Cuenta desactivada y datos identificatorios anonimizados conforme a la política de conservación legal.', timestamp: deactivatedAt, author: 'Sistema UBIKA', actorId: user.id, actorRole: user.role, metadata: { legalAction: 'ACCOUNT_DEACTIVATE', ipAddress: req.ip, userAgent: req.headers['user-agent'] } });
    return res.status(200).json({ success: true, deactivatedAt, message: "Cuenta desactivada y datos identificatorios anonimizados. Los registros cuya conservación resulte exigible no se eliminan físicamente." });
  });

  app.get("/api/legal/company-compliance", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    const company = db.getCompanyById(req.user!.companyId);
    if (!company) return res.status(404).json({ error: "Empresa no encontrada" });
    return res.status(200).json({ businessType: company.businessType || null, digitalComplaintBookUrl: company.digitalComplaintBookUrl || null, complaintBookConfigured: Boolean(company.digitalComplaintBookUrl) });
  });

  app.post("/api/auth/login", rateLimit(60000, 10), (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email y contraseña requeridos" });
    }

    const user = db.getUserByEmail(email);
    if (!user || !user.active) {
      return res.status(401).json({ error: "Credenciales inválidas o usuario inactivo" });
    }

    const passwordMatches = bcrypt.compareSync(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const token = generateAuthToken(user);
    const company = db.getCompanyById(user.companyId);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
        driverId: user.driverId,
        phone: user.phone,
      },
      company: company || null,
    });
  });

  app.get("/api/auth/me", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    const user = db.getUserById(req.user!.userId);
    const company = db.getCompanyById(req.user!.companyId);
    if (!user) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }
    const { passwordHash: _hash, ...safeUser } = user as any;
    return res.json({ user: safeUser, company });
  });

  // --- PHASE 2 AUTH ENDPOINTS: INVITATIONS & RECOVERY ---

  // 1. Create Employee Invitation
  app.post("/api/auth/invite", authenticateUser, requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
    const { name, email, role, companyId: targetCompanyId } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ error: "Nombre, email y rol son obligatorios" });
    }

    const allowedRoles = ['DRIVER', 'KITCHEN', 'DISPATCHER'];
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: "Rol no permitido. Solo se permite DRIVER, KITCHEN o DISPATCHER." });
    }

    const cid = req.user?.role === 'SUPER_ADMIN' && targetCompanyId ? targetCompanyId : req.user!.companyId;

    const existingUser = db.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: "El correo electrónico ya está registrado" });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    const invitation = {
      id: `inv_${crypto.randomUUID()}`,
      email: email.trim().toLowerCase(),
      tokenHash,
      companyId: cid,
      role,
      expiresAt,
      used: false,
      createdAt: Date.now(),
    };

    db.createInvitation(invitation);

    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const inviteUrl = `${appUrl}/accept-invite?token=${rawToken}`;
    const company = db.getCompanyById(cid);
    const companyName = company ? company.name : 'UBIKA';

    await EmailService.sendEmployeeInvitation(invitation.email, inviteUrl, invitation.role, companyName);

    const inviteResp: any = {
      message: "Invitación creada con éxito. Se ha enviado un correo electrónico con las instrucciones al empleado.",
      email: invitation.email,
      role: invitation.role,
      expiresAt,
    };
    if (process.env.NODE_ENV === 'test' || process.env.ENABLE_DEV_TOKENS === 'true') {
      inviteResp.inviteToken = rawToken;
      inviteResp.inviteUrl = inviteUrl;
    }
    res.status(201).json(inviteResp);
  });

  // 2. Accept Invitation
  app.post("/api/auth/accept-invite", rateLimit(60000, 10), (req: Request, res: Response) => {
    const { token, name, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: "Token y contraseña son obligatorios" });
    }

    const validation = validatePassword(password);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const tokenHash = hashToken(token);
    const invitation = db.getInvitationByHash(tokenHash);

    if (!invitation) {
      return res.status(400).json({ error: "Invitación inválida o token alterado" });
    }

    if (invitation.used) {
      return res.status(400).json({ error: "La invitación ya fue utilizada" });
    }

    if (invitation.expiresAt < Date.now()) {
      return res.status(400).json({ error: "La invitación ha expirado" });
    }

    const existingUser = db.getUserByEmail(invitation.email);
    if (existingUser) {
      return res.status(409).json({ error: "El usuario ya existe" });
    }

    db.updateInvitation(invitation.id, { used: true, usedAt: Date.now() });

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const newUser = {
      id: `usr_${Date.now()}`,
      email: invitation.email,
      passwordHash,
      name: name || invitation.email.split('@')[0],
      role: invitation.role, // Enforce role from invitation, cannot be changed by user
      companyId: invitation.companyId, // Enforce company from invitation, cannot be changed
      createdAt: Date.now(),
      active: true,
    };

    db.createUser(newUser);

    const authToken = generateAuthToken(newUser);
    const company = db.getCompanyById(newUser.companyId);

    res.status(201).json({
      token: authToken,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        companyId: newUser.companyId,
      },
      company: company || null,
    });
  });

  // 3. Forgot Password
  app.post("/api/auth/forgot-password", rateLimit(60000, 5), async (req: Request, res: Response) => {
    const { email } = req.body;

    // Generic response to prevent user enumeration
    const genericResponse = { message: "Si el correo está registrado, se han enviado las instrucciones de recuperación." };

    if (!email) {
      return res.json(genericResponse);
    }

    const user = db.getUserByEmail(email);
    if (!user) {
      return res.json(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    const passwordReset = {
      id: `pr_${crypto.randomUUID()}`,
      email: user.email.toLowerCase(),
      tokenHash,
      expiresAt,
      used: false,
      createdAt: Date.now(),
    };

    db.createPasswordReset(passwordReset);

    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

    await EmailService.sendPasswordReset(user.email, resetUrl);

    const responsePayload: any = { ...genericResponse };
    if (process.env.NODE_ENV === 'test' || process.env.ENABLE_DEV_TOKENS === 'true') {
      responsePayload.resetToken = rawToken;
      responsePayload.resetUrl = resetUrl;
    }

    res.json(responsePayload);
  });

  // 4. Reset Password
  app.post("/api/auth/reset-password", rateLimit(60000, 5), (req: Request, res: Response) => {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: "Token y contraseña son requeridos" });
    }

    const validation = validatePassword(password);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const tokenHash = hashToken(token);
    const resetRecord = db.getPasswordResetByHash(tokenHash);

    if (!resetRecord) {
      return res.status(400).json({ error: "Token de recuperación inválido o alterado" });
    }

    if (resetRecord.used) {
      return res.status(400).json({ error: "El token de recuperación ya fue utilizado" });
    }

    if (resetRecord.expiresAt < Date.now()) {
      return res.status(400).json({ error: "El token de recuperación ha expirado" });
    }

    const user = db.getUserByEmail(resetRecord.email);
    if (!user) {
      return res.status(400).json({ error: "Usuario no encontrado" });
    }

    db.updatePasswordReset(resetRecord.id, { used: true, usedAt: Date.now() });

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    db.updateUser(user.id, { passwordHash });

    res.json({ message: "Contraseña actualizada exitosamente" });
  });

  // --- COMPANIES ENDPOINTS (Multi-tenant secured) ---
  app.get("/api/companies", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    if (req.user?.role === 'SUPER_ADMIN') {
      const companies = db.getAllCompanies();
      return res.json(companies);
    }
    const company = db.getCompanyById(req.user!.companyId);
    return res.json(company ? [company] : []);
  });

  app.get("/api/companies/:id", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.companyId !== req.params.id) {
      return res.status(403).json({ error: "Acceso denegado a otra empresa" });
    }
    const company = db.getCompanyById(req.params.id);
    if (!company) {
      return res.status(404).json({ error: "Empresa no encontrada" });
    }
    res.json(company);
  });

  // --- DASHBOARD METRICS (Strictly Scoped to authenticated company) ---
  app.get("/api/metrics", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    const companyId =
      req.user?.role === 'SUPER_ADMIN' && req.query.companyId
        ? (req.query.companyId as string)
        : req.user!.companyId;

    const drivers = db.getDriversByCompany(companyId);
    const deliveries = db.getDeliveriesByCompany(companyId);

    const activeDrivers = drivers.filter((d) => d.status === 'en_tarea' || d.status === 'disponible').length;
    const availableDrivers = drivers.filter((d) => d.status === 'disponible').length;
    
    const pendingDeliveries = deliveries.filter(
      (d) => d.status === 'asignado' || d.status === 'esperando_autorizacion'
    ).length;

    const inProgressDeliveries = deliveries.filter(
      (d) => d.status === 'ubicacion_compartida' || d.status === 'en_camino' || d.status === 'cerca'
    ).length;

    const completedDeliveries = deliveries.filter((d) => d.status === 'entregado').length;
    const delayedDeliveries = deliveries.filter((d) => {
      if (d.status === 'entregado' || d.status === 'cancelado') return false;
      const elapsedMinutes = (Date.now() - d.createdAt) / 60000;
      return elapsedMinutes > 35;
    }).length;

    const cancelledDeliveries = deliveries.filter((d) => d.status === 'cancelado').length;

    // Calculate total revenue from completed deliveries
    const totalRevenueNum = deliveries
      .filter((d) => d.status === 'entregado' && d.amount)
      .reduce((acc, d) => {
        const cleaned = d.amount?.replace(/[^0-9]/g, '') || '0';
        return acc + parseInt(cleaned, 10);
      }, 0);

    const metrics: DashboardMetrics & { companyId: string } = {
      companyId,
      activeDrivers,
      availableDrivers,
      pendingDeliveries,
      inProgressDeliveries,
      completedDeliveries,
      delayedDeliveries,
      cancelledDeliveries,
      totalRevenue: `$ ${totalRevenueNum.toLocaleString('es-AR')}`,
    };

    res.json(metrics);
  });

  // --- DRIVERS ENDPOINTS (Scoped to authenticated company) ---
  app.get("/api/drivers", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    const companyId =
      req.user?.role === 'SUPER_ADMIN' && req.query.companyId
        ? (req.query.companyId as string)
        : req.user!.companyId;

    let drivers = db.getDriversByCompany(companyId);
    if (req.user?.role === 'DRIVER') {
      drivers = drivers.filter((d) => d.id === req.user?.driverId);
    }
    res.json(drivers);
  });

  app.get("/api/drivers/:id", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    const driver = db.getDriverById(req.params.id);
    if (!driver) {
      return res.status(404).json({ error: "Repartidor no encontrado" });
    }
    if (req.user?.role !== 'SUPER_ADMIN' && driver.companyId !== req.user?.companyId) {
      return res.status(403).json({ error: "Acceso denegado a repartidor de otra empresa" });
    }
    if (req.user?.role === 'DRIVER' && driver.id !== req.user?.driverId) {
      return res.status(403).json({ error: "Acceso denegado a perfil de otro repartidor" });
    }
    res.json(driver);
  });

  
  app.get("/api/users", authenticateUser, requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
    const cid = req.user?.role === 'SUPER_ADMIN' && req.query.companyId ? req.query.companyId as string : req.user!.companyId;
    const users = db.getUsersByCompany(cid).map(u => {
      const { passwordHash, ...safeUser } = u;
      return safeUser;
    });
    res.json(users);
  });

  app.post("/api/users", authenticateUser, requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
    const { name, email, role, driverId, phone, companyId: targetCompanyId } = req.body;
    
    if (!name || !email || !role) {
      return res.status(400).json({ error: "Nombre, email y rol son obligatorios" });
    }

    const allowedRoles = ['DRIVER', 'KITCHEN', 'DISPATCHER'];
    if (!allowedRoles.includes(role)) {
       return res.status(403).json({ error: "Rol no permitido. Solo se permite DRIVER, KITCHEN o DISPATCHER." });
    }

    const existingUser = db.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: "El correo electrónico ya está registrado" });
    }

    const cid = req.user?.role === 'SUPER_ADMIN' && targetCompanyId ? targetCompanyId : req.user!.companyId;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    const invitation = {
      id: `inv_${crypto.randomUUID()}`,
      email: email.trim().toLowerCase(),
      tokenHash,
      companyId: cid,
      role,
      expiresAt,
      used: false,
      createdAt: Date.now(),
    };

    db.createInvitation(invitation);

    // Email provider integration point:
    // Integration point for email service (e.g. SendGrid, AWS SES) to send invite link securely.
    // The raw token is NOT exposed to the admin interface or API response in production.
    const userInviteResp: any = {
      message: "Invitación de empleado creada con éxito. El administrador no establece la contraseña. Se ha enviado un correo con las instrucciones al empleado.",
      email: invitation.email,
      role: invitation.role,
      expiresAt,
    };
    if (process.env.NODE_ENV === 'test' || process.env.ENABLE_DEV_TOKENS === 'true') {
      userInviteResp.inviteToken = rawToken;
      userInviteResp.inviteUrl = `/accept-invite?token=${rawToken}`;
    }
    res.status(201).json(userInviteResp);
  });

  app.post("/api/drivers", authenticateUser, requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
    const { name, phone, email, internalId, vehicle } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: "Nombre y teléfono son obligatorios" });
    }

    const cid = req.user?.role === 'SUPER_ADMIN' && req.body.companyId ? req.body.companyId : req.user!.companyId;
    const existingDrivers = db.getDriversByCompany(cid);
    const generatedId = `drv_${Date.now()}`;
    const nextInternal = internalId || `R-${String(existingDrivers.length + 1).padStart(2, '0')}`;

    const newDriver: Driver = {
      id: generatedId,
      companyId: cid,
      name,
      phone,
      email: email || `${name.toLowerCase().replace(/\s+/g, '.')}@ubika.app`,
      internalId: nextInternal,
      vehicle: vehicle || 'moto',
      status: 'disponible',
      createdAt: Date.now(),
      totalDeliveries: 0,
      rating: 5.0,
      lastActiveAt: Date.now(),
      speedKmH: 0,
      currentLocation: {
        latitude: -34.6037,
        longitude: -58.3816,
        accuracy: 10,
        updatedAt: Date.now(),
        speed: 0,
      },
    };

    db.createDriver(newDriver);
    res.status(201).json(newDriver);
  });

  app.patch("/api/drivers/:id/status", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    const { status } = req.body;
    const validStatuses: DriverStatus[] = ['disponible', 'en_tarea', 'pausado', 'desconectado', 'inactivo'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Estado de repartidor inválido" });
    }

    const driver = db.getDriverById(req.params.id);
    if (!driver) {
      return res.status(404).json({ error: "Repartidor no encontrado" });
    }
    if (req.user?.role !== 'SUPER_ADMIN' && driver.companyId !== req.user?.companyId) {
      return res.status(403).json({ error: "Acceso denegado a otra empresa" });
    }
    if (req.user?.role === 'DRIVER' && driver.id !== req.user?.driverId) {
      return res.status(403).json({ error: "Acceso denegado a otro repartidor" });
    }

    const updated = db.updateDriver(req.params.id, {
      status,
      lastActiveAt: Date.now(),
    });

    res.json(updated);
  });

  // Repartidor updates GPS location stream (Throttled & Persisted)
  app.post("/api/drivers/:id/location", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    const { latitude, longitude, accuracy, speed, heading, deliveryId } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "Latitud y longitud requeridas" });
    }

    const driver = db.getDriverById(req.params.id);
    if (!driver) {
      return res.status(404).json({ error: "Repartidor no encontrado" });
    }
    if (req.user?.role !== 'SUPER_ADMIN' && driver.companyId !== req.user?.companyId) {
      return res.status(403).json({ error: "Acceso denegado a otra empresa" });
    }
    if (req.user?.role === 'DRIVER' && driver.id !== req.user?.driverId) {
      return res.status(403).json({ error: "Acceso denegado a otro repartidor" });
    }

    const loc = {
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: Number(accuracy || 10),
      updatedAt: Date.now(),
      speed: speed !== undefined ? Number(speed) : driver.speedKmH || 0,
      heading: heading !== undefined ? Number(heading) : undefined,
    };

    db.updateDriver(driver.id, {
      currentLocation: loc,
      lastActiveAt: Date.now(),
      speedKmH: loc.speed,
    });

    // Record in driver operational location history
    db.recordDriverLocation({
      driverId: driver.id,
      deliveryId,
      companyId: driver.companyId,
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: loc.accuracy,
      speed: loc.speed,
      timestamp: Date.now(),
    });

    // If there is an active delivery, update distance and append route history
    if (deliveryId) {
      const delivery = db.getDeliveryById(deliveryId);
      if (delivery && delivery.status !== 'entregado' && delivery.status !== 'cancelado') {
        if (delivery.companyId === driver.companyId) {
          const route = delivery.routeHistory ? [...delivery.routeHistory] : [];
          const lastPoint = route[route.length - 1];

          // Route point throttling: record point only if > 10 seconds or moved > 15 meters
          let shouldAppendPoint = true;
          if (lastPoint) {
            const distFromLast = calculateDistanceMeters(
              lastPoint.latitude,
              lastPoint.longitude,
              loc.latitude,
              loc.longitude
            );
            const timeFromLastSec = (Date.now() - lastPoint.timestamp) / 1000;
            if (distFromLast < 15 && timeFromLastSec < 10) {
              shouldAppendPoint = false;
            }
          }

          if (shouldAppendPoint) {
            route.push({
              latitude: loc.latitude,
              longitude: loc.longitude,
              timestamp: Date.now(),
              speed: loc.speed,
            });
          }

          let distanceMeters = delivery.distanceMeters;
          let etaMinutes = delivery.etaMinutes;

          if (delivery.recipientLocation) {
            distanceMeters = calculateDistanceMeters(
              loc.latitude,
              loc.longitude,
              delivery.recipientLocation.latitude,
              delivery.recipientLocation.longitude
            );
            etaMinutes = calculateEtaMinutes(distanceMeters, loc.speed || 25);
          }

          db.updateDelivery(delivery.id, {
            driverLocation: loc,
            routeHistory: route,
            distanceMeters,
            etaMinutes,
          });
        }
      }
    }

    res.json({ success: true, location: loc });
  });

  // --- DELIVERIES ENDPOINTS (Scoped & Multi-tenant Protected) ---
  app.get("/api/deliveries", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    if (req.user?.role === 'DRIVER') {
      const deliveries = db.getDeliveriesByDriver(req.user.driverId || '')
        .filter((d) => d.companyId === req.user?.companyId);
      return res.json(deliveries);
    }

    const companyId =
      req.user?.role === 'SUPER_ADMIN' && req.query.companyId
        ? (req.query.companyId as string)
        : req.user!.companyId;

    const deliveries = db.getDeliveriesByCompany(companyId);
    res.json(deliveries);
  });

  app.get("/api/deliveries/:id", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    const delivery = db.getDeliveryById(req.params.id);
    if (!delivery) {
      return res.status(404).json({ error: "Entrega no encontrada" });
    }
    if (req.user?.role !== 'SUPER_ADMIN' && delivery.companyId !== req.user?.companyId) {
      return res.status(403).json({ error: "Acceso denegado a entrega de otra empresa" });
    }
    if (req.user?.role === 'DRIVER' && delivery.driverId !== req.user?.driverId) {
      return res.status(403).json({ error: "Acceso denegado a entrega asignada a otro repartidor" });
    }
    res.json(delivery);
  });

  // Create new task from Central Control
  app.post("/api/deliveries", authenticateUser, requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN', 'DISPATCHER']), (req: AuthenticatedRequest, res: Response) => {
    const {
      recipientPhone,
      recipientName,
      description,
      instructions,
      amount,
      paymentMethod,
      priority,
      notes,
      driverId,
    } = req.body;

    if (!recipientPhone || !description) {
      return res.status(400).json({ error: "Teléfono y descripción son obligatorios" });
    }

    const cid = req.user?.role === 'SUPER_ADMIN' && req.body.companyId ? req.body.companyId : req.user!.companyId;
    const companyDeliveries = db.getDeliveriesByCompany(cid);
    const nextOrderNumber = 1000 + companyDeliveries.length + 1;
    const deliveryId = `del_${Date.now()}`;
    const sessionToken = generateSecureToken();

    // Assign driver or pick first available within company
    let assignedDriver = driverId ? db.getDriverById(driverId) : undefined;
    if (assignedDriver && assignedDriver.companyId !== cid) {
      return res.status(400).json({ error: "El repartidor no pertenece a la empresa especificada" });
    }
    if (!assignedDriver) {
      const companyDrivers = db.getDriversByCompany(cid);
      assignedDriver = companyDrivers.find((d) => d.status === 'disponible') || companyDrivers[0];
    }

    if (!assignedDriver) {
      return res.status(400).json({ error: "No hay repartidores disponibles en la empresa" });
    }

    const now = Date.now();
    const expiresAt = now + 4 * 3600000; // 4 hours window

    const newDelivery: Delivery = {
      id: deliveryId,
      orderNumber: nextOrderNumber,
      companyId: cid,
      driverId: assignedDriver.id,
      driverName: assignedDriver.name,
      driverPhone: assignedDriver.phone,
      driverVehicle: assignedDriver.vehicle,
      recipientPhone,
      recipientName: recipientName || undefined,
      description,
      instructions: instructions || undefined,
      amount: amount || undefined,
      paymentMethod: paymentMethod || 'Efectivo',
      priority: (priority as TaskPriority) || 'normal',
      notes: notes || undefined,
      sessionToken,
      status: 'asignado',
      createdAt: now,
      assignedAt: now,
      expiresAt,
      driverLocation: assignedDriver.currentLocation || null,
      routeHistory: assignedDriver.currentLocation
        ? [{
            latitude: assignedDriver.currentLocation.latitude,
            longitude: assignedDriver.currentLocation.longitude,
            timestamp: now,
            speed: assignedDriver.currentLocation.speed,
          }]
        : [],
      privacyPolicyPurged: false,
    };

    // Save Delivery to DB
    db.createDelivery(newDelivery);

    // Create Persistent Location Session Record
    db.createLocationSession({
      id: `sess_${deliveryId}`,
      deliveryId,
      companyId: cid,
      sessionTokenHash: hashToken(sessionToken),
      createdAt: now,
      expiresAt,
      status: 'ACTIVE',
    });

    // Record Audit Events
    recordAuditEvent(
      cid,
      deliveryId,
      nextOrderNumber,
      'DELIVERY_CREATED',
      `Tarea #${nextOrderNumber} creada desde UBIKA CONTROL.`,
      req.user?.name || 'Despacho Central',
      req.user?.userId,
      req.user?.role || 'DISPATCHER'
    );

    recordAuditEvent(
      cid,
      deliveryId,
      nextOrderNumber,
      'DRIVER_ASSIGNED',
      `Asignado al repartidor ${assignedDriver.name} (${assignedDriver.internalId}).`,
      req.user?.name || 'Despacho Central',
      req.user?.userId,
      req.user?.role || 'DISPATCHER'
    );

    res.status(201).json(newDelivery);
  });

  // Driver accepts task
  app.patch("/api/deliveries/:id/accept", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    const delivery = db.getDeliveryById(req.params.id);
    if (!delivery) {
      return res.status(404).json({ error: "Entrega no encontrada" });
    }
    if (req.user?.role !== 'SUPER_ADMIN' && delivery.companyId !== req.user?.companyId) {
      return res.status(403).json({ error: "Acceso denegado a otra empresa" });
    }
    if (req.user?.role === 'DRIVER' && delivery.driverId !== req.user?.driverId) {
      return res.status(403).json({ error: "Acceso denegado a entrega de otro repartidor" });
    }

    const now = Date.now();
    const updated = db.updateDelivery(delivery.id, {
      status: 'esperando_autorizacion',
      acceptedAt: now,
    });

    if (delivery.driverId) {
      db.updateDriver(delivery.driverId, {
        status: 'en_tarea',
        activeDeliveryId: delivery.id,
      });
    }

    recordAuditEvent(
      delivery.companyId,
      delivery.id,
      delivery.orderNumber,
      'DRIVER_ACCEPTED',
      `El repartidor ${delivery.driverName} aceptó la tarea.`,
      delivery.driverName,
      delivery.driverId,
      'DRIVER'
    );

    res.json(updated);
  });

  // Driver rejects task
  app.patch("/api/deliveries/:id/reject", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    const { reason } = req.body;
    const delivery = db.getDeliveryById(req.params.id);
    if (!delivery) {
      return res.status(404).json({ error: "Entrega no encontrada" });
    }
    if (req.user?.role !== 'SUPER_ADMIN' && delivery.companyId !== req.user?.companyId) {
      return res.status(403).json({ error: "Acceso denegado a otra empresa" });
    }
    if (req.user?.role === 'DRIVER' && delivery.driverId !== req.user?.driverId) {
      return res.status(403).json({ error: "Acceso denegado a entrega de otro repartidor" });
    }

    const updated = db.updateDelivery(delivery.id, {
      status: 'rechazado',
      endedAt: Date.now(),
    });

    if (delivery.driverId) {
      db.updateDriver(delivery.driverId, {
        status: 'disponible',
        activeDeliveryId: null,
      });
    }

    recordAuditEvent(
      delivery.companyId,
      delivery.id,
      delivery.orderNumber,
      'DRIVER_REJECTED',
      `El repartidor ${delivery.driverName} rechazó la tarea${reason ? `: ${reason}` : '.'}`,
      delivery.driverName,
      delivery.driverId,
      'DRIVER'
    );

    res.json(updated);
  });

  // Driver starts trip (en_camino)
  app.patch("/api/deliveries/:id/start", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    const delivery = db.getDeliveryById(req.params.id);
    if (!delivery) {
      return res.status(404).json({ error: "Entrega no encontrada" });
    }
    if (req.user?.role !== 'SUPER_ADMIN' && delivery.companyId !== req.user?.companyId) {
      return res.status(403).json({ error: "Acceso denegado a otra empresa" });
    }
    if (req.user?.role === 'DRIVER' && delivery.driverId !== req.user?.driverId) {
      return res.status(403).json({ error: "Acceso denegado a entrega de otro repartidor" });
    }

    const now = Date.now();
    const updated = db.updateDelivery(delivery.id, {
      status: 'en_camino',
      startedAt: now,
    });

    if (delivery.driverId) {
      db.updateDriver(delivery.driverId, {
        status: 'en_tarea',
        activeDeliveryId: delivery.id,
      });
    }

    recordAuditEvent(
      delivery.companyId,
      delivery.id,
      delivery.orderNumber,
      'DELIVERY_STARTED',
      `El repartidor ${delivery.driverName} inició el viaje hacia el destino.`,
      delivery.driverName,
      delivery.driverId,
      'DRIVER'
    );

    res.json(updated);
  });

  // Driver arrives (cerca)
  app.patch("/api/deliveries/:id/arrive", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    const delivery = db.getDeliveryById(req.params.id);
    if (!delivery) {
      return res.status(404).json({ error: "Entrega no encontrada" });
    }
    if (req.user?.role !== 'SUPER_ADMIN' && delivery.companyId !== req.user?.companyId) {
      return res.status(403).json({ error: "Acceso denegado a otra empresa" });
    }
    if (req.user?.role === 'DRIVER' && delivery.driverId !== req.user?.driverId) {
      return res.status(403).json({ error: "Acceso denegado a entrega de otro repartidor" });
    }

    const now = Date.now();
    const updated = db.updateDelivery(delivery.id, {
      status: 'cerca',
      arrivedAt: now,
    });

    recordAuditEvent(
      delivery.companyId,
      delivery.id,
      delivery.orderNumber,
      'DRIVER_ARRIVED',
      `El repartidor ${delivery.driverName} llegó al punto de encuentro ("Estoy Afuera").`,
      delivery.driverName,
      delivery.driverId,
      'DRIVER'
    );

    res.json(updated);
  });

  // Driver completes delivery (entregado) + Purges Coordinates
  app.patch("/api/deliveries/:id/complete", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    const delivery = db.getDeliveryById(req.params.id);
    if (!delivery) {
      return res.status(404).json({ error: "Entrega no encontrada" });
    }
    if (req.user?.role !== 'SUPER_ADMIN' && delivery.companyId !== req.user?.companyId) {
      return res.status(403).json({ error: "Acceso denegado a otra empresa" });
    }
    if (req.user?.role === 'DRIVER' && delivery.driverId !== req.user?.driverId) {
      return res.status(403).json({ error: "Acceso denegado a entrega de otro repartidor" });
    }

    const now = Date.now();
    delivery.status = 'entregado';
    delivery.endedAt = now;

    // Apply strict privacy retention policy (purge customer exact coords)
    purgeCoordinatesIfFinished(delivery);

    const updated = db.updateDelivery(delivery.id, { ...delivery });

    if (delivery.driverId) {
      const driver = db.getDriverById(delivery.driverId);
      if (driver) {
        db.updateDriver(driver.id, {
          status: 'disponible',
          activeDeliveryId: null,
          totalDeliveries: (driver.totalDeliveries || 0) + 1,
        });
      }
    }

    recordAuditEvent(
      delivery.companyId,
      delivery.id,
      delivery.orderNumber,
      'DELIVERY_COMPLETED',
      `Entrega #${delivery.orderNumber} finalizada con éxito por ${delivery.driverName}.`,
      delivery.driverName,
      delivery.driverId,
      'DRIVER'
    );

    res.json(updated);
  });

  // Cancel delivery + Purges Coordinates
  app.patch("/api/deliveries/:id/cancel", authenticateUser, requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN', 'DISPATCHER']), (req: AuthenticatedRequest, res: Response) => {
    const { reason } = req.body;
    const delivery = db.getDeliveryById(req.params.id);
    if (!delivery) {
      return res.status(404).json({ error: "Entrega no encontrada" });
    }
    if (req.user?.role !== 'SUPER_ADMIN' && delivery.companyId !== req.user?.companyId) {
      return res.status(403).json({ error: "Acceso denegado a otra empresa" });
    }

    const now = Date.now();
    delivery.status = 'cancelado';
    delivery.endedAt = now;

    purgeCoordinatesIfFinished(delivery);
    const updated = db.updateDelivery(delivery.id, { ...delivery });

    if (delivery.driverId) {
      db.updateDriver(delivery.driverId, {
        status: 'disponible',
        activeDeliveryId: null,
      });
    }

    recordAuditEvent(
      delivery.companyId,
      delivery.id,
      delivery.orderNumber,
      'DELIVERY_CANCELLED',
      `Entrega #${delivery.orderNumber} cancelada${reason ? `: ${reason}` : '.'}`,
      req.user?.name || 'Despacho Central',
      req.user?.userId,
      req.user?.role || 'DISPATCHER'
    );

    res.json(updated);
  });

  // Update delivery generic status
  app.patch("/api/deliveries/:id/status", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    const { status } = req.body;
    const delivery = db.getDeliveryById(req.params.id);
    if (!delivery) {
      return res.status(404).json({ error: "Entrega no encontrada" });
    }
    if (req.user?.role !== 'SUPER_ADMIN' && delivery.companyId !== req.user?.companyId) {
      return res.status(403).json({ error: "Acceso denegado a otra empresa" });
    }
    if (req.user?.role === 'DRIVER' && delivery.driverId !== req.user?.driverId) {
      return res.status(403).json({ error: "Acceso denegado a entrega de otro repartidor" });
    }

    delivery.status = status;
    if (status === 'entregado' || status === 'cancelado') {
      purgeCoordinatesIfFinished(delivery);
    }

    const updated = db.updateDelivery(delivery.id, { ...delivery });
    res.json(updated);
  });

  // --- PUBLIC CUSTOMER LOCATION SHARING (UBIKA CLIENT) ---
  app.get("/api/track/:token", rateLimit(60000, 60), (req, res) => {
    const { token } = req.params;
    const session = db.getSessionByToken(token);

    if (!session) {
      return res.status(404).json({
        error: "Sesión no encontrada",
        message: "El enlace de seguimiento es inválido o no existe.",
      });
    }

    const delivery = db.getDeliveryById(session.deliveryId);
    if (!delivery) {
      return res.status(404).json({ error: "Entrega asociada no encontrada" });
    }

    const now = Date.now();
    const isExpired = now > delivery.expiresAt || session.status === 'EXPIRED';
    const isFinished = delivery.status === 'entregado' || delivery.status === 'cancelado';

    // Mask phone number for privacy
    const rawPhone = delivery.recipientPhone;
    const maskedPhone =
      rawPhone.length > 6
        ? `${rawPhone.slice(0, 4)}••••${rawPhone.slice(-2)}`
        : '••••••';

    const publicData: PublicSessionData = {
      id: delivery.id,
      orderNumber: delivery.orderNumber,
      driverName: delivery.driverName,
      driverPhone: delivery.driverPhone,
      driverVehicle: delivery.driverVehicle,
      recipientPhoneMasked: maskedPhone,
      recipientName: delivery.recipientName,
      description: delivery.description,
      instructions: delivery.instructions,
      amount: delivery.amount,
      status: delivery.status,
      createdAt: delivery.createdAt,
      expiresAt: delivery.expiresAt,
      isExpired: isExpired || isFinished,
      isAuthorized: !!delivery.authorizedAt || session.status === 'ACTIVE' && !!session.authorizedAt,
      driverLocation: delivery.driverLocation
        ? {
            latitude: delivery.driverLocation.latitude,
            longitude: delivery.driverLocation.longitude,
            updatedAt: delivery.driverLocation.updatedAt,
          }
        : null,
      distanceMeters: delivery.distanceMeters,
      recipientHasLocation: !!delivery.recipientLocation,
    };

    res.json(publicData);
  });

  // Customer grants explicit consent & submits GPS coordinates
  app.post("/api/track/:token/location", rateLimit(10000, 10), (req, res) => {
    const { token } = req.params;
    const { latitude, longitude, accuracy, addressHint, noteFromRecipient } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "Coordenadas de latitud y longitud requeridas" });
    }

    // Validate coordinate ranges
    const lat = Number(latitude);
    const lng = Number(longitude);
    const acc = Number(accuracy || 10);

    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ error: "Rango de coordenadas geográficas inválido" });
    }

    const session = db.getSessionByToken(token);
    if (!session) {
      return res.status(404).json({ error: "Sesión no encontrada o token inválido" });
    }

    const delivery = db.getDeliveryById(session.deliveryId);
    if (!delivery) {
      return res.status(404).json({ error: "Entrega no encontrada" });
    }

    const now = Date.now();
    if (now > delivery.expiresAt || delivery.status === 'entregado' || delivery.status === 'cancelado') {
      return res.status(410).json({
        error: "Sesión expirada o concluida",
        message: "Esta entrega ya ha concluido y no acepta más actualizaciones de ubicación.",
      });
    }

    const locCoords = {
      latitude: lat,
      longitude: lng,
      accuracy: acc,
      updatedAt: now,
      addressHint: addressHint ? String(addressHint).trim() : delivery.recipientLocation?.addressHint,
      noteFromRecipient: noteFromRecipient
        ? String(noteFromRecipient).trim()
        : delivery.recipientLocation?.noteFromRecipient,
    };

    // Calculate distance and ETA if driver location is known
    let distanceMeters = delivery.distanceMeters;
    let etaMinutes = delivery.etaMinutes;

    if (delivery.driverLocation) {
      distanceMeters = calculateDistanceMeters(
        delivery.driverLocation.latitude,
        delivery.driverLocation.longitude,
        lat,
        lng
      );
      etaMinutes = calculateEtaMinutes(distanceMeters, delivery.driverLocation.speed || 25);
    }

    const isFirstTimeAuthorization = !delivery.authorizedAt;

    // Update Delivery State
    const nextStatus =
      delivery.status === 'esperando_autorizacion' || delivery.status === 'asignado'
        ? 'ubicacion_compartida'
        : delivery.status;

    db.updateDelivery(delivery.id, {
      recipientLocation: locCoords,
      status: nextStatus,
      authorizedAt: delivery.authorizedAt || now,
      distanceMeters,
      etaMinutes,
    });

    // Update Session
    db.updateSession(session.id, {
      authorizedAt: session.authorizedAt || now,
      recipientLocation: locCoords,
    });

    if (isFirstTimeAuthorization) {
      recordAuditEvent(
        delivery.companyId,
        delivery.id,
        delivery.orderNumber,
        'LOCATION_SHARED',
        `El destinatario autorizó y compartió su posición GPS precisa${
          locCoords.addressHint ? ` (${locCoords.addressHint})` : ''
        }.`,
        delivery.recipientName || 'Destinatario',
        undefined,
        'CLIENT'
      );
    }

    res.json({
      success: true,
      deliveryStatus: nextStatus,
      distanceMeters,
      etaMinutes,
      updatedAt: now,
    });
  });

  // --- EVENTS & AUDIT LOGS (Scoped by authenticated company) ---
  app.get("/api/events", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    const deliveryId = req.query.deliveryId as string;

    if (deliveryId) {
      const delivery = db.getDeliveryById(deliveryId);
      if (!delivery) {
        return res.status(404).json({ error: "Entrega no encontrada" });
      }
      if (req.user?.role !== 'SUPER_ADMIN' && delivery.companyId !== req.user?.companyId) {
        return res.status(403).json({ error: "Acceso denegado a entrega de otra empresa" });
      }
      if (req.user?.role === 'DRIVER' && delivery.driverId !== req.user?.driverId) {
        return res.status(403).json({ error: "Acceso denegado a eventos de otro repartidor" });
      }
      return res.json(db.getEventsByDelivery(deliveryId));
    }

    const companyId =
      req.user?.role === 'SUPER_ADMIN' && req.query.companyId
        ? (req.query.companyId as string)
        : req.user!.companyId;

    const events = db.getEventsByCompany(companyId);
    res.json(events);
  });

  // Direct Driver Location update on Delivery (Authenticated & Scoped)
  app.post("/api/deliveries/:id/driver-location", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    const { latitude, longitude, accuracy, speed, heading } = req.body;
    const delivery = db.getDeliveryById(req.params.id);
    if (!delivery) {
      return res.status(404).json({ error: "Entrega no encontrada" });
    }
    if (req.user?.role !== 'SUPER_ADMIN' && delivery.companyId !== req.user?.companyId) {
      return res.status(403).json({ error: "Acceso denegado a otra empresa" });
    }
    if (req.user?.role === 'DRIVER' && delivery.driverId !== req.user?.driverId) {
      return res.status(403).json({ error: "Acceso denegado a entrega de otro repartidor" });
    }

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "Coordenadas requeridas" });
    }

    const loc = {
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: Number(accuracy || 10),
      updatedAt: Date.now(),
      speed: speed !== undefined ? Number(speed) : 0,
      heading: heading !== undefined ? Number(heading) : undefined,
    };

    if (delivery.driverId) {
      db.updateDriver(delivery.driverId, {
        currentLocation: loc,
        lastActiveAt: Date.now(),
        speedKmH: loc.speed,
      });

      db.recordDriverLocation({
        driverId: delivery.driverId,
        deliveryId: delivery.id,
        companyId: delivery.companyId,
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy: loc.accuracy,
        speed: loc.speed,
        timestamp: Date.now(),
      });
    }

    // Append route point with throttling
    const route = delivery.routeHistory ? [...delivery.routeHistory] : [];
    const lastPoint = route[route.length - 1];
    let shouldAppend = true;
    if (lastPoint) {
      const distFromLast = calculateDistanceMeters(lastPoint.latitude, lastPoint.longitude, loc.latitude, loc.longitude);
      const timeSec = (Date.now() - lastPoint.timestamp) / 1000;
      if (distFromLast < 15 && timeSec < 10) {
        shouldAppend = false;
      }
    }

    if (shouldAppend) {
      route.push({
        latitude: loc.latitude,
        longitude: loc.longitude,
        timestamp: Date.now(),
        speed: loc.speed,
      });
    }

    let distanceMeters = delivery.distanceMeters;
    let etaMinutes = delivery.etaMinutes;

    if (delivery.recipientLocation) {
      distanceMeters = calculateDistanceMeters(
        loc.latitude,
        loc.longitude,
        delivery.recipientLocation.latitude,
        delivery.recipientLocation.longitude
      );
      etaMinutes = calculateEtaMinutes(distanceMeters, loc.speed || 25);
    }

    const updated = db.updateDelivery(delivery.id, {
      driverLocation: loc,
      routeHistory: route,
      distanceMeters,
      etaMinutes,
    });

    res.json({ success: true, delivery: updated });
  });

  // Session Authorize & Reject Aliases
  app.get("/api/session/:token", (req, res) => {
    res.redirect(307, `/api/track/${req.params.token}`);
  });

  app.post("/api/session/:token/location", (req, res) => {
    // Forward directly to track handler
    const { token } = req.params;
    const session = db.getSessionByToken(token);
    if (!session) {
      return res.status(404).json({ error: "Sesión no encontrada" });
    }
    const delivery = db.getDeliveryById(session.deliveryId);
    if (!delivery) {
      return res.status(404).json({ error: "Entrega no encontrada" });
    }
    if (Date.now() > delivery.expiresAt || delivery.status === 'entregado' || delivery.status === 'cancelado') {
      return res.status(410).json({ error: "Sesión expirada o concluida" });
    }

    const { latitude, longitude, accuracy, addressHint, noteFromRecipient } = req.body;
    const locCoords = {
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: Number(accuracy || 10),
      updatedAt: Date.now(),
      addressHint,
      noteFromRecipient,
    };

    const nextStatus =
      delivery.status === 'esperando_autorizacion' || delivery.status === 'asignado'
        ? 'ubicacion_compartida'
        : delivery.status;

    db.updateDelivery(delivery.id, {
      recipientLocation: locCoords,
      status: nextStatus,
      authorizedAt: delivery.authorizedAt || Date.now(),
    });

    db.updateSession(session.id, {
      authorizedAt: session.authorizedAt || Date.now(),
      recipientLocation: locCoords,
    });

    res.json({ success: true, session: { ...delivery, recipientLocation: locCoords, status: nextStatus } });
  });

  app.post("/api/session/:token/authorize", (req, res) => {
    const { token } = req.params;
    const session = db.getSessionByToken(token);
    if (!session) return res.status(404).json({ error: "Sesión no encontrada" });

    const delivery = db.getDeliveryById(session.deliveryId);
    if (!delivery) return res.status(404).json({ error: "Entrega no encontrada" });

    const now = Date.now();
    db.updateSession(session.id, { authorizedAt: now, status: 'ACTIVE' });
    const updated = db.updateDelivery(delivery.id, {
      authorizedAt: now,
      status: delivery.status === 'asignado' ? 'esperando_autorizacion' : delivery.status,
    });

    res.json({ success: true, session: updated });
  });

  app.post("/api/session/:token/reject", (req, res) => {
    const { token } = req.params;
    const session = db.getSessionByToken(token);
    if (!session) return res.status(404).json({ error: "Sesión no encontrada" });

    db.updateSession(session.id, { status: 'CANCELLED', endedAt: Date.now() });
    res.json({ success: true, message: "Ubicación rechazada" });
  });

  // ======================================================
  // --- UBIKA FOOD ENDPOINTS & HELPER ---
  // ======================================================

  function generatePublicTrackingToken(): string {
    return `tr_food_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  function getAuthorizedFoodMerchant(companyId: string): {
    ok: boolean;
    status: number;
    error?: string;
    company?: Company;
    store?: FoodStore;
  } {
    if (!companyId || typeof companyId !== 'string') {
      return { ok: false, status: 400, error: 'companyId es requerido y debe ser válido' };
    }
    const company = db.getCompanyById(companyId);
    if (!company) {
      return { ok: false, status: 404, error: 'Comercio no encontrado' };
    }
    if (!isFoodAuthorizedCompany(company)) {
      return { ok: false, status: 403, error: 'El comercio no está clasificado como empresa gastronómica (FOOD/HYBRID)' };
    }
    if (company.foodEnabled === false) {
      return { ok: false, status: 403, error: 'El comercio tiene la función FOOD deshabilitada' };
    }
    const store = db.getFoodStoreByCompanyId(companyId);
    if (!store || !store.foodEnabled) {
      return { ok: false, status: 404, error: 'La tienda gastronómica no está disponible o no existe' };
    }
    return { ok: true, status: 200, company, store };
  }

  // 0. LIST ALL AVAILABLE FOOD STORES (`GET /api/food/stores`)
  app.get("/api/food/stores", (_req: Request, res: Response) => {
    const companies = db.getAllCompanies().filter((c) => isFoodAuthorizedCompany(c) && c.foodEnabled !== false);
    const stores = companies.map((c) => {
      const store = db.getFoodStoreByCompanyId(c.id);
      return {
        companyId: c.id,
        name: store?.name || c.name,
        description: store?.description || '',
        address: store?.address || c.address,
        phone: store?.phone || c.phone,
        whatsappNumber: store?.whatsappNumber || store?.phone || c.phone,
        isOpenManual: store ? store.isOpenManual : true,
        category: c.category || 'Gastronomía',
      };
    });
    res.json(stores);
  });

  // GET MERCHANT STORE CONFIG (`GET /api/food/store/config`) - MUST BE DEFINED BEFORE :companyId
  app.get("/api/food/store/config", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    const companyId = req.user!.companyId;
    const company = db.getCompanyById(companyId);

    if (!company || !isFoodAuthorizedCompany(company)) {
      return res.status(403).json({ error: "Empresa no autorizada para operar módulo FOOD" });
    }

    const store = db.getFoodStoreByCompanyId(companyId);
    const categories = db.getFoodCategoriesByCompanyId(companyId);
    const products = db.getFoodProductsByCompanyId(companyId);
    const shippingRate = db.getFoodShippingRateByCompanyId(companyId);

    res.json({
      store: store || null,
      categories,
      products,
      shippingRate: shippingRate || null,
    });
  });

  // UPDATE MERCHANT STORE CONFIG (`PUT /api/food/store/config`) - MUST BE DEFINED BEFORE :companyId
  app.put("/api/food/store/config", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    if (!isAuthorizedFoodAdmin(req)) {
      return res.status(403).json({ error: "Rol no autorizado para administrar la tienda" });
    }

    const companyId = req.user!.companyId;
    const company = db.getCompanyById(companyId);

    if (!company || !isFoodAuthorizedCompany(company)) {
      return res.status(403).json({ error: "Empresa de logística no autorizada para operar o configurar tienda gastronómica" });
    }

    const { name, description, address, phone, whatsappNumber, isOpenManual, schedule, bankInfo, foodEnabled } = req.body;

    const existing = db.getFoodStoreByCompanyId(companyId);
    const updatedStore = db.upsertFoodStore({
      companyId,
      foodEnabled: foodEnabled !== undefined ? Boolean(foodEnabled) : true,
      name: name || company.name || 'Comercio Food',
      description: description || 'Tienda gastronómica',
      address: address || company.address || '',
      phone: phone || company.phone || '',
      whatsappNumber: whatsappNumber || phone || '',
      isOpenManual: isOpenManual !== undefined ? Boolean(isOpenManual) : true,
      schedule: Array.isArray(schedule) ? schedule : existing?.schedule || [],
      bankInfo: bankInfo || existing?.bankInfo || { bankName: '', alias: '', cbu: '', holderName: '' },
      createdAt: existing ? existing.createdAt : Date.now(),
      updatedAt: Date.now(),
    });

    res.json(updatedStore);
  });

  // 1. PUBLIC STORE DETAILS & MENU (`GET /api/food/store/:companyId`) - STRICT READ-ONLY
  app.get("/api/food/store/:companyId", (req: Request, res: Response) => {
    const { companyId } = req.params;
    const authCheck = getAuthorizedFoodMerchant(companyId);
    if (!authCheck.ok) {
      return res.status(authCheck.status).json({ error: authCheck.error });
    }

    const { store } = authCheck;
    const categories = db.getFoodCategoriesByCompanyId(companyId);
    const products = db.getFoodProductsByCompanyId(companyId);
    const shippingRate = db.getFoodShippingRateByCompanyId(companyId);

    if (!shippingRate) {
      return res.status(404).json({ error: "Tarifa de envío no configurada para este comercio" });
    }

    const now = new Date();
    const currentDay = now.getDay();
    const schedule = Array.isArray(store!.schedule) ? store!.schedule : [];
    const daySchedule = schedule.find((s) => s.dayOfWeek === currentDay);
    const isOpenSchedule = daySchedule ? daySchedule.isOpen : true;
    const isCurrentlyOpen = store!.isOpenManual && isOpenSchedule;

    res.json({
      store: {
        ...store,
        isOpen: isCurrentlyOpen,
      },
      categories: categories.filter((c) => c.active),
      products: products.filter((p) => p.isAvailable),
      shippingRate,
    });
  });

  // 2. SHIPPING CALCULATOR (`POST /api/food/calculate-shipping`)
  app.post("/api/food/calculate-shipping", (req: Request, res: Response) => {
    const { companyId, latitude, longitude, subtotal } = req.body;
    if (
      !companyId ||
      typeof latitude !== 'number' || latitude < -90 || latitude > 90 || !Number.isFinite(latitude) ||
      typeof longitude !== 'number' || longitude < -180 || longitude > 180 || !Number.isFinite(longitude)
    ) {
      return res.status(400).json({ error: "Se requieren companyId, latitude y longitude válidos" });
    }

    const authCheck = getAuthorizedFoodMerchant(companyId);
    if (!authCheck.ok) {
      return res.status(authCheck.status).json({ error: authCheck.error });
    }

    const rate = db.getFoodShippingRateByCompanyId(companyId);
    if (!rate) {
      return res.status(404).json({ error: "Tarifa de envío no configurada para este comercio" });
    }

    const distanceKm = calculateHaversineDistanceKm(
      rate.storeLatitude,
      rate.storeLongitude,
      latitude,
      longitude
    );

    if (rate.maxDistanceKm && distanceKm > rate.maxDistanceKm) {
      return res.status(400).json({
        error: `La ubicación está a ${distanceKm} km, superando el límite máximo de entrega de ${rate.maxDistanceKm} km`,
        outOfRange: true,
        distanceKm,
      });
    }

    let shippingCost = rate.baseFee;
    if (rate.freeShippingThreshold && typeof subtotal === 'number' && subtotal >= rate.freeShippingThreshold) {
      shippingCost = 0;
    } else if (distanceKm > rate.includedKm) {
      const extraKm = Math.ceil(distanceKm - rate.includedKm);
      shippingCost += extraKm * rate.perKmFee;
    }

    res.json({
      distanceKm,
      shippingCost,
      baseFee: rate.baseFee,
      includedKm: rate.includedKm,
      perKmFee: rate.perKmFee,
    });
  });

  // 3. CREATE FOOD ORDER (`POST /api/food/orders`) - STRICT VALIDATION & SERVER RECALCULATION
  app.post("/api/food/orders", (req: Request, res: Response) => {
    const {
      companyId,
      deliveryType,
      items,
      recipientName,
      recipientPhone,
      generalNotes,
      deliveryAddress,
      recipientLocation,
      paymentMethod,
    } = req.body;

    if (!companyId || !deliveryType || !Array.isArray(items) || items.length === 0 || !recipientName || !recipientPhone) {
      return res.status(400).json({ error: "Faltan datos obligatorios para crear el pedido" });
    }

    if (deliveryAddress !== undefined) {
      if (typeof deliveryAddress !== 'string' || deliveryAddress.trim().length === 0) {
        return res.status(400).json({ error: "La dirección de entrega debe ser un texto válido" });
      }
      if (deliveryAddress.length > 255) {
        return res.status(400).json({ error: "La dirección de entrega excede el límite de 255 caracteres" });
      }
    }

    if (generalNotes !== undefined) {
      if (typeof generalNotes !== 'string' || generalNotes.length > 500) {
        return res.status(400).json({ error: "Las notas generales no pueden exceder los 500 caracteres" });
      }
    }

    if (deliveryType !== 'FOOD_DELIVERY' && deliveryType !== 'FOOD_PICKUP') {
      return res.status(400).json({ error: "Tipo de entrega no válido (debe ser FOOD_DELIVERY o FOOD_PICKUP)" });
    }

    const validPaymentMethods = ['CASH', 'TRANSFER', 'MERCADOPAGO'];
    if (!paymentMethod || !validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({ error: "Método de pago no válido (debe ser CASH, TRANSFER o MERCADOPAGO)" });
    }

    // STRICT PAYMENT RULE: Transfer is NOT allowed for FOOD_DELIVERY
    if (deliveryType === 'FOOD_DELIVERY' && paymentMethod === 'TRANSFER') {
      return res.status(400).json({ error: "El pago por transferencia bancaria solo está disponible para pedidos de RETIRO EN LOCAL" });
    }

    const authCheck = getAuthorizedFoodMerchant(companyId);
    if (!authCheck.ok) {
      return res.status(authCheck.status).json({ error: authCheck.error });
    }
    const store = authCheck.store!;

    // BACKEND PRICE RECALCULATION & OPTION VALIDATION
    let calculatedSubtotal = 0;
    const processedItems: FoodOrderItem[] = [];
    const categories = db.getFoodCategoriesByCompanyId(companyId);

    for (const rawItem of items) {
      const product = db.getFoodProductById(rawItem.productId);
      if (!product || product.companyId !== companyId || !product.isAvailable) {
        return res.status(400).json({ error: `Producto no disponible o no pertenece al comercio: ${rawItem.productId}` });
      }

      // Verify category belongs to companyId
      const cat = categories.find((c) => c.id === product.categoryId);
      if (!cat || !cat.active) {
        return res.status(400).json({ error: `La categoría del producto ${product.name} no está disponible` });
      }

      // Strict Quantity Validation (no coercion)
      const rawQty = rawItem.quantity;
      if (typeof rawQty !== 'number' || !Number.isInteger(rawQty) || rawQty < 1 || rawQty > 50) {
        return res.status(400).json({ error: "La cantidad (quantity) debe ser un número entero válido entre 1 y 50" });
      }
      const quantity = rawQty;

      let selectedOptionsPrice = 0;
      const selectedSelections: FoodOrderItemSelection[] = [];

      // OptionGroups Validation
      if (product.optionGroups && product.optionGroups.length > 0) {
        const rawSelections: any[] = Array.isArray(rawItem.selectedOptions) ? rawItem.selectedOptions : [];

        // Build lookup map for valid options
        const validOptionsMap = new Map<string, { group: FoodOptionGroup; option: FoodOption }>();
        for (const grp of product.optionGroups) {
          for (const opt of grp.options) {
            validOptionsMap.set(opt.id, { group: grp, option: opt });
          }
        }

        // 1. Verify every raw selection provided
        for (const sel of rawSelections) {
          const optId = typeof sel === 'string' ? sel : (sel.optionId || sel.id);
          const match = validOptionsMap.get(optId);
          if (!match) {
            return res.status(400).json({ error: `Opción inexistente o no válida [${optId}] para el producto ${product.name}` });
          }
          const providedGrpId = typeof sel === 'object' && sel ? sel.optionGroupId : undefined;
          if (providedGrpId && providedGrpId !== match.group.id) {
            return res.status(400).json({ error: `La opción '${match.option.name}' no pertenece al grupo indicado` });
          }
        }

        // 2. Validate min/max selections for each group
        for (const grp of product.optionGroups) {
          const grpSelections = rawSelections.filter((sel) => {
            const optId = typeof sel === 'string' ? sel : (sel.optionId || sel.id);
            const match = validOptionsMap.get(optId);
            return match && match.group.id === grp.id;
          });

          const minReq = grp.required ? (grp.minSelections || 1) : (grp.minSelections || 0);
          if (grpSelections.length < minReq) {
            return res.status(400).json({
              error: `Debe seleccionar al menos ${minReq} opción(es) en "${grp.name}" para el producto ${product.name}`,
            });
          }

          if (grp.maxSelections && grpSelections.length > grp.maxSelections) {
            return res.status(400).json({
              error: `El grupo "${grp.name}" permite un máximo de ${grp.maxSelections} selecciones`,
            });
          }

          for (const sel of grpSelections) {
            const optId = typeof sel === 'string' ? sel : (sel.optionId || sel.id);
            const match = validOptionsMap.get(optId)!;
            selectedSelections.push({
              optionGroupId: grp.id,
              optionGroupName: grp.name,
              optionId: match.option.id,
              optionName: match.option.name,
              price: match.option.price,
            });
            selectedOptionsPrice += match.option.price;
          }
        }
      } else if (rawItem.selectedOptions && rawItem.selectedOptions.length > 0) {
        return res.status(400).json({ error: `El producto ${product.name} no acepta opciones o modificadores` });
      }

      const itemTotalPrice = (product.price + selectedOptionsPrice) * quantity;
      calculatedSubtotal += itemTotalPrice;

      processedItems.push({
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice: product.price,
        selectedOptions: selectedSelections,
        itemNotes: rawItem.itemNotes ? String(rawItem.itemNotes).slice(0, 200) : undefined,
        totalPrice: itemTotalPrice,
      });
    }

    let calculatedShippingCost = 0;
    let validatedCoords: LocationCoords | null = null;

    if (deliveryType === 'FOOD_DELIVERY') {
      if (
        !recipientLocation ||
        typeof recipientLocation.latitude !== 'number' || recipientLocation.latitude < -90 || recipientLocation.latitude > 90 || !Number.isFinite(recipientLocation.latitude) ||
        typeof recipientLocation.longitude !== 'number' || recipientLocation.longitude < -180 || recipientLocation.longitude > 180 || !Number.isFinite(recipientLocation.longitude)
      ) {
        return res.status(400).json({ error: "Se requiere la ubicación GPS válida para pedidos de Delivery" });
      }

      validatedCoords = {
        latitude: recipientLocation.latitude,
        longitude: recipientLocation.longitude,
        accuracy: recipientLocation.accuracy || 10,
        updatedAt: Date.now(),
        addressHint: deliveryAddress || 'Ubicación seleccionada en mapa',
      };

      const rate = db.getFoodShippingRateByCompanyId(companyId);
      if (!rate) {
        return res.status(404).json({ error: "Tarifa de envío no configurada para este comercio" });
      }

      const distanceKm = calculateHaversineDistanceKm(
        rate.storeLatitude,
        rate.storeLongitude,
        validatedCoords.latitude,
        validatedCoords.longitude
      );

      if (rate.maxDistanceKm && distanceKm > rate.maxDistanceKm) {
        return res.status(400).json({
          error: `La ubicación supera la distancia máxima de entrega (${rate.maxDistanceKm} km)`,
        });
      }

      if (rate.freeShippingThreshold && calculatedSubtotal >= rate.freeShippingThreshold) {
        calculatedShippingCost = 0;
      } else if (distanceKm <= rate.includedKm) {
        calculatedShippingCost = rate.baseFee;
      } else {
        const extraKm = Math.ceil(distanceKm - rate.includedKm);
        calculatedShippingCost = rate.baseFee + extraKm * rate.perKmFee;
      }
    }

    const calculatedTotal = calculatedSubtotal + calculatedShippingCost;

    // Incremental Order Number
    const existingOrders = db.getFoodOrdersByCompanyId(companyId);
    const nextOrderNum = existingOrders.length > 0 ? Math.max(...existingOrders.map((o) => o.orderNumber)) + 1 : 1001;

    const pickupCode = deliveryType === 'FOOD_PICKUP' ? generatePickupCode() : undefined;
    const publicTrackingToken = generatePublicTrackingToken();

    const newOrder: FoodOrder = {
      id: `forder_${crypto.randomUUID()}`,
      orderNumber: nextOrderNum,
      companyId,
      deliveryType,
      items: processedItems,
      subtotal: calculatedSubtotal,
      shippingCost: calculatedShippingCost,
      totalAmount: calculatedTotal,
      recipientName,
      recipientPhone,
      generalNotes,
      deliveryAddress,
      recipientLocation: validatedCoords,
      paymentMethod: paymentMethod || (deliveryType === 'FOOD_PICKUP' ? 'TRANSFER' : 'CASH'),
      paymentStatus: 'PENDING',
      pickupCode,
      publicTrackingToken,
      orderStatus: 'PENDING',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    db.createFoodOrder(newOrder);

    // Audit Event
    db.createEvent({
      id: `ev_food_${Date.now()}`,
      companyId,
      deliveryId: newOrder.id,
      orderNumber: newOrder.orderNumber,
      type: 'FOOD_ORDER_CREATED',
      description: `Nuevo pedido gastronómico #${newOrder.orderNumber} (${deliveryType === 'FOOD_DELIVERY' ? '🛵 Delivery' : '🏪 Retiro'}). Total: ${calculatedTotal}`,
      timestamp: Date.now(),
      author: recipientName,
      actorRole: 'CLIENT',
    });

    res.status(201).json({
      order: newOrder,
      storeBankInfo: deliveryType === 'FOOD_PICKUP' ? store.bankInfo : null,
      publicTrackingToken,
    });
  });

  // 4. PUBLIC ORDER STATUS CHECK (`GET /api/food/orders/public/:orderId`) - SECURED WITH TOKEN
  app.get("/api/food/orders/public/:orderId", (req: Request, res: Response) => {
    const { orderId } = req.params;
    const token = req.query.token as string;

    const order = db.getFoodOrderById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    if (!token || order.publicTrackingToken !== token) {
      return res.status(403).json({ error: "Token de seguimiento público inválido o no proporcionado" });
    }

    const store = db.getFoodStoreByCompanyId(order.companyId);
    const maskedPhone = order.recipientPhone.replace(/(\d{3})\d{4}(\d{2})/, "$1****$2");

    res.json({
      id: order.id,
      orderNumber: order.orderNumber,
      companyId: order.companyId,
      storeName: store?.name || 'Comercio Ubika',
      storeAddress: store?.address || '',
      storePhone: store?.phone || '',
      storeBankInfo: order.deliveryType === 'FOOD_PICKUP' ? store?.bankInfo : null,
      deliveryType: order.deliveryType,
      items: order.items,
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      totalAmount: order.totalAmount,
      recipientName: order.recipientName,
      recipientPhoneMasked: maskedPhone,
      generalNotes: order.generalNotes,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      // NOTE: pickupCode MUST NOT be leaked in public tracking response
      orderStatus: order.orderStatus,
      deliveryId: order.deliveryId,
      publicTrackingToken: order.publicTrackingToken,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    });
  });

  // 5. REPORT TRANSFER FOR PICKUP (`POST /api/food/orders/public/:orderId/report-transfer`)
  app.post("/api/food/orders/public/:orderId/report-transfer", (req: Request, res: Response) => {
    const { orderId } = req.params;
    const token = (req.query.token || req.body.token) as string;

    const order = db.getFoodOrderById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    if (!token || order.publicTrackingToken !== token) {
      return res.status(403).json({ error: "Token de seguimiento público inválido o no proporcionado" });
    }

    if (order.deliveryType !== 'FOOD_PICKUP') {
      return res.status(400).json({ error: "El reporte de transferencia solo aplica a pedidos de retiro" });
    }

    if (['PICKED_UP', 'CANCELLED'].includes(order.orderStatus)) {
      return res.status(409).json({ error: "El pedido ya no se encuentra activo para reportar pagos" });
    }

    const updated = db.updateFoodOrder(order.id, {
      paymentStatus: 'PROCESSING',
      bankTransferReportedAt: Date.now(),
    });

    db.createEvent({
      id: `ev_pay_${Date.now()}`,
      companyId: order.companyId,
      deliveryId: order.id,
      orderNumber: order.orderNumber,
      type: 'FOOD_PAYMENT_PENDING',
      description: `El cliente informó haber realizado la transferencia bancaria por ${order.totalAmount} para el pedido #${order.orderNumber}. Pendiente de verificación por el comercio.`,
      timestamp: Date.now(),
      author: order.recipientName,
      actorRole: 'CLIENT',
    });

    res.json({ success: true, order: updated });
  });

  // --- MERCHANT AUTHENTICATED FOOD ENDPOINTS ---

  // GET MERCHANT ORDERS (`GET /api/food/orders`)
  app.get("/api/food/orders", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    if (!isAuthorizedFoodOrderStatusMerchant(req)) {
      return res.status(403).json({ error: "Rol no autorizado para consultar pedidos del comercio" });
    }
    const orders = db.getFoodOrdersByCompanyId(req.user!.companyId);
    res.json(orders);
  });

  // GET KITCHEN ORDERS (`GET /api/food/kitchen/orders`)
  app.get("/api/food/kitchen/orders", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    const allowedRoles: UserRole[] = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'KITCHEN'];
    if (!allowedRoles.includes(req.user!.role)) {
      return res.status(403).json({ error: "Rol no autorizado para consultar pedidos de cocina" });
    }
    const orders = db.getFoodOrdersByCompanyId(req.user!.companyId);
    res.json(orders);
  });

  // UPDATE ORDER STATUS (`PATCH /api/food/orders/:orderId/status`) - STRICT STATE MACHINE & DRIVER ISOLATION
  app.patch("/api/food/orders/:orderId/status", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    const { orderId } = req.params;
    const { orderStatus, paymentStatus, driverId } = req.body;

    if (paymentStatus) {
      return res.status(400).json({ error: "No se permite modificar el estado de pago mediante /status. Utilice /payment/approve" });
    }

    const order = db.getFoodOrderById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    if (order.companyId !== req.user!.companyId) {
      return res.status(403).json({ error: "Acceso denegado a pedido de otra empresa" });
    }

    const isKitchen = req.user!.role === 'KITCHEN';
    const isMerchant = isAuthorizedFoodOrderStatusMerchant(req);
    const isDriver = req.user!.role === 'DRIVER';
    const isAssignedDriver = isDriver && !!req.user!.driverId && order.driverId === req.user!.driverId;

    if (!isMerchant && !isAssignedDriver && !isKitchen) {
      return res.status(403).json({ error: "Rol no autorizado para modificar el estado del pedido" });
    }

    if (isKitchen) {
      if (!['PREPARING', 'READY'].includes(orderStatus)) {
        return res.status(403).json({ error: "La cocina solo puede cambiar el estado a PREPARING o READY" });
      }
      if (driverId) {
        return res.status(403).json({ error: "La cocina no tiene permisos para asignar repartidores" });
      }
    }

    if (isDriver) {
      if (!isAssignedDriver) {
        return res.status(403).json({ error: "El repartidor no está asignado a este pedido" });
      }
      if (!['IN_TRANSIT', 'DELIVERED'].includes(orderStatus)) {
        return res.status(403).json({ error: "El repartidor solo puede cambiar estado a IN_TRANSIT o DELIVERED" });
      }
    }

    // Direct transition to PICKED_UP is forbidden via PATCH
    if (orderStatus === 'PICKED_UP') {
      return res.status(409).json({
        error: "El retiro de pedidos solo puede realizarse mediante la validación del código de retiro en /api/food/orders/:orderId/pickup",
      });
    }

    // Validate Driver Belonging to Same Company
    if (driverId) {
      const driver = db.getDriverById(driverId);
      if (!driver) {
        return res.status(404).json({ error: "Repartidor no encontrado" });
      }
      if (driver.companyId !== order.companyId) {
        return res.status(403).json({ error: "El repartidor pertenece a otra empresa" });
      }
    }

    let targetStatus = orderStatus;
    if (targetStatus === 'READY' && order.deliveryType === 'FOOD_PICKUP') {
      targetStatus = 'READY_FOR_PICKUP';
    }

    // Strict State Machine Validation
    if (targetStatus && targetStatus !== order.orderStatus) {
      const current = order.orderStatus;
      let isValidTransition = false;

      if (targetStatus === 'CANCELLED') {
        isValidTransition = true;
      } else {
        switch (current) {
          case 'PENDING':
            isValidTransition = targetStatus === 'PREPARING';
            break;
          case 'PREPARING':
            isValidTransition = order.deliveryType === 'FOOD_DELIVERY' ? targetStatus === 'READY' : targetStatus === 'READY_FOR_PICKUP';
            break;
          case 'READY':
            isValidTransition = targetStatus === 'ASSIGNED';
            break;
          case 'ASSIGNED':
            isValidTransition = targetStatus === 'IN_TRANSIT'; // ASSIGNED -> DELIVERED is strictly FORBIDDEN
            break;
          case 'IN_TRANSIT':
            isValidTransition = targetStatus === 'DELIVERED';
            break;
          case 'READY_FOR_PICKUP':
            isValidTransition = false; // Only via /pickup
            break;
          default:
            isValidTransition = false;
        }
      }

      if (!isValidTransition) {
        return res.status(409).json({
          error: `Transición de estado no válida desde [${current}] hacia [${targetStatus}]`,
        });
      }
    }

    const updates: Partial<FoodOrder> = {};
    if (targetStatus) updates.orderStatus = targetStatus;
    if (paymentStatus) updates.paymentStatus = paymentStatus;

    if (orderStatus === 'PREPARING') {
      db.createEvent({
        id: `ev_prep_${Date.now()}`,
        companyId: order.companyId,
        deliveryId: order.id,
        orderNumber: order.orderNumber,
        type: 'FOOD_ORDER_PREPARING',
        description: `Pedido #${order.orderNumber} puesto en preparación por la cocina.`,
        timestamp: Date.now(),
        author: req.user!.email,
        actorId: req.user!.userId,
        actorRole: req.user!.role,
      });
    }

    if (orderStatus === 'READY') {
      if (order.deliveryType === 'FOOD_DELIVERY') {
        let driver = driverId ? db.getDriverById(driverId) : undefined;
        let coreDelivery = order.deliveryId ? db.getDeliveryById(order.deliveryId) : undefined;

        if (!coreDelivery) {
          const sessionToken = `tok_food_${crypto.randomBytes(16).toString('hex')}`;
          const itemsSummary = order.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ');

          coreDelivery = db.createDelivery({
            id: `del_food_${order.orderNumber}_${Date.now()}`,
            orderNumber: order.orderNumber,
            companyId: order.companyId,
            driverId: driver ? driver.id : '',
            driverName: driver ? driver.name : 'Sin asignar',
            driverPhone: driver ? driver.phone : '',
            driverVehicle: driver ? driver.vehicle : 'moto',
            recipientPhone: order.recipientPhone,
            recipientName: order.recipientName,
            description: `🍔 Pedido Food #${order.orderNumber}: ${itemsSummary}`,
            instructions: order.generalNotes || 'Entregar en dirección del cliente',
            amount: `${order.totalAmount}`,
            paymentMethod: order.paymentMethod === 'TRANSFER' ? 'Transferencia / MP' : 'Efectivo',
            priority: 'normal',
            sessionToken,
            status: driver ? 'asignado' : 'esperando_autorizacion',
            createdAt: Date.now(),
            expiresAt: Date.now() + 4 * 3600000,
            recipientLocation: order.recipientLocation,
            taskType: 'FOOD_DELIVERY',
            foodOrderId: order.id,
            itemsSummary,
          });

          db.createLocationSession({
            id: `sess_food_${coreDelivery.id}`,
            deliveryId: coreDelivery.id,
            companyId: order.companyId,
            sessionTokenHash: hashToken(sessionToken),
            createdAt: Date.now(),
            expiresAt: Date.now() + 4 * 3600000,
            status: 'ACTIVE',
            recipientLocation: order.recipientLocation,
          });

          updates.deliveryId = coreDelivery.id;
        }

        if (driver) {
          updates.driverId = driver.id;
          updates.driverName = driver.name;
          updates.driverPhone = driver.phone;
          updates.orderStatus = 'ASSIGNED';
        }

        db.createEvent({
          id: `ev_ready_${Date.now()}`,
          companyId: order.companyId,
          deliveryId: order.id,
          orderNumber: order.orderNumber,
          type: 'FOOD_ORDER_READY',
          description: `Pedido #${order.orderNumber} listo para despacho. Cadete asignado: ${driver ? driver.name : 'Pendiente'}`,
          timestamp: Date.now(),
          author: req.user!.email,
          actorId: req.user!.userId,
          actorRole: req.user!.role,
        });
      } else {
        updates.orderStatus = 'READY_FOR_PICKUP';
        db.createEvent({
          id: `ev_pready_${Date.now()}`,
          companyId: order.companyId,
          deliveryId: order.id,
          orderNumber: order.orderNumber,
          type: 'FOOD_ORDER_PICKUP_READY',
          description: `Pedido #${order.orderNumber} listo para ser retirado en local.`,
          timestamp: Date.now(),
          author: req.user!.email,
          actorId: req.user!.userId,
          actorRole: req.user!.role,
        });
      }
    }

    if (paymentStatus === 'APPROVED') {
      db.createEvent({
        id: `ev_pappr_${Date.now()}`,
        companyId: order.companyId,
        deliveryId: order.id,
        orderNumber: order.orderNumber,
        type: 'FOOD_PAYMENT_APPROVED',
        description: `Pago del pedido #${order.orderNumber} APROBADO y confirmado por el comercio.`,
        timestamp: Date.now(),
        author: req.user!.email,
        actorId: req.user!.userId,
        actorRole: req.user!.role,
      });
    }

    const updated = db.updateFoodOrder(order.id, updates);
    res.json(updated);
  });

  // DEDICATED PICKUP VERIFICATION (`POST /api/food/orders/:orderId/pickup`)
  app.post("/api/food/orders/:orderId/pickup", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    if (!isAuthorizedFoodPickup(req)) {
      return res.status(403).json({ error: "Rol no autorizado para validar retiros en local" });
    }

    const { orderId } = req.params;
    const { pickupCode } = req.body;

    const order = db.getFoodOrderById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    if (order.companyId !== req.user!.companyId) {
      return res.status(403).json({ error: "Acceso denegado a pedido de otra empresa" });
    }

    if (order.deliveryType !== 'FOOD_PICKUP') {
      return res.status(409).json({ error: "El pedido no es de tipo retiro en local" });
    }

    if (order.pickupCodeUsedAt) {
      return res.status(409).json({ error: "El código de retiro ya fue utilizado previamente" });
    }

    if (order.orderStatus !== 'READY_FOR_PICKUP') {
      return res.status(409).json({ error: "El pedido no se encuentra en estado listo para retiro" });
    }

    if (!pickupCode || typeof pickupCode !== 'string' || pickupCode.trim().toUpperCase() !== (order.pickupCode || '').toUpperCase()) {
      return res.status(400).json({ error: "Código de retiro incorrecto o inválido" });
    }

    const now = Date.now();
    const updated = db.updateFoodOrder(order.id, {
      orderStatus: 'PICKED_UP',
      pickedUpAt: now,
      pickupCodeUsedAt: now,
    });

    db.createEvent({
      id: `ev_pdone_${Date.now()}`,
      companyId: order.companyId,
      deliveryId: order.id,
      orderNumber: order.orderNumber,
      type: 'FOOD_ORDER_PICKED_UP',
      description: `Pedido #${order.orderNumber} retirado por el cliente con código validado.`,
      timestamp: Date.now(),
      author: req.user!.email,
      actorId: req.user!.userId,
      actorRole: req.user!.role,
    });

    res.json(updated);
  });

  // APPROVE PAYMENT (`POST /api/food/orders/:orderId/payment/approve`) - STRICT STATE MACHINE & FINANCIAL ISOLATION
  app.post("/api/food/orders/:orderId/payment/approve", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    if (!isAuthorizedFoodPayment(req)) {
      return res.status(403).json({ error: "Rol no autorizado para aprobar pagos de pedidos" });
    }

    const { orderId } = req.params;
    const order = db.getFoodOrderById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    if (order.companyId !== req.user!.companyId) {
      return res.status(403).json({ error: "Acceso denegado a pedido de otra empresa" });
    }

    if (order.orderStatus === 'CANCELLED') {
      return res.status(409).json({ error: "No se puede aprobar el pago de un pedido cancelado" });
    }

    if (order.paymentStatus === 'APPROVED') {
      return res.status(409).json({ error: "El pago ya se encuentra aprobado" });
    }

    // Strict Payment Method Transition Verification
    if (order.paymentMethod === 'TRANSFER') {
      if (order.paymentStatus === 'PENDING') {
        return res.status(409).json({
          error: "Para pagos por transferencia bancaria, el comprobante debe ser informado previamente (estado PROCESSING) antes de su aprobación definitiva",
        });
      }
      if (order.paymentStatus !== 'PROCESSING') {
        return res.status(409).json({ error: `Estado de pago no válido para aprobación: ${order.paymentStatus}` });
      }
    } else if (order.paymentMethod === 'CASH') {
      if (!['PENDING', 'PROCESSING'].includes(order.paymentStatus)) {
        return res.status(409).json({ error: `Estado de pago no válido para aprobación: ${order.paymentStatus}` });
      }
    } else {
      if (!['PENDING', 'PROCESSING'].includes(order.paymentStatus)) {
        return res.status(409).json({ error: `Estado de pago no válido para aprobación: ${order.paymentStatus}` });
      }
    }

    const updated = db.updateFoodOrder(order.id, { paymentStatus: 'APPROVED' });

    db.createEvent({
      id: `ev_pappr_${Date.now()}`,
      companyId: order.companyId,
      deliveryId: order.id,
      orderNumber: order.orderNumber,
      type: 'FOOD_PAYMENT_APPROVED',
      description: `Pago del pedido #${order.orderNumber} APROBADO y confirmado por el comercio.`,
      timestamp: Date.now(),
      author: req.user!.email,
      actorId: req.user!.userId,
      actorRole: req.user!.role,
    });

    res.json(updated);
  });

  // CATEGORIES CRUD - DYNAMIC MULTI-TENANT CATEGORIES
  app.get("/api/food/categories", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    if (!isAuthorizedFoodOrderStatusMerchant(req)) {
      return res.status(403).json({ error: "Rol no autorizado para consultar categorías" });
    }
    const companyId = req.user!.companyId;
    const company = db.getCompanyById(companyId);
    if (!company || !isFoodAuthorizedCompany(company)) {
      return res.status(403).json({ error: "Comercio no autorizado para operar módulo gastronómico" });
    }
    const categories = db.getFoodCategoriesByCompanyId(companyId);
    res.json(categories);
  });

  app.get("/api/food/products", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    if (!isAuthorizedFoodOrderStatusMerchant(req)) {
      return res.status(403).json({ error: "Rol no autorizado para consultar productos" });
    }
    const companyId = req.user!.companyId;
    const company = db.getCompanyById(companyId);
    if (!company || !isFoodAuthorizedCompany(company)) {
      return res.status(403).json({ error: "Comercio no autorizado para operar módulo gastronómico" });
    }
    const products = db.getFoodProductsByCompanyId(companyId);
    res.json(products);
  });

  app.post("/api/food/categories", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    if (!isAuthorizedFoodAdmin(req)) {
      return res.status(403).json({ error: "Rol no autorizado para administrar categorías" });
    }
    const companyId = req.user!.companyId;
    const company = db.getCompanyById(companyId);
    if (!company || !isFoodAuthorizedCompany(company)) {
      return res.status(403).json({ error: "Comercio no autorizado para administrar menú gastronómico" });
    }

    const { name, description, imageUrl, icon, displayOrder, sortOrder, active, isActive } = req.body;
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName) {
      return res.status(400).json({ error: "El nombre de la categoría es obligatorio" });
    }

    // Tenant-isolated unique category name validation
    const existingCats = db.getFoodCategoriesByCompanyId(companyId);
    const isDuplicate = existingCats.some((c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (isDuplicate) {
      return res.status(400).json({ error: `Ya existe una categoría con el nombre "${trimmedName}" en este comercio` });
    }

    const effectiveOrder = typeof displayOrder === 'number' ? displayOrder : (typeof sortOrder === 'number' ? sortOrder : existingCats.length + 1);
    const effectiveActive = active !== undefined ? Boolean(active) : (isActive !== undefined ? Boolean(isActive) : true);

    const newCat: FoodCategory = {
      id: `fcat_${crypto.randomUUID()}`,
      companyId,
      name: trimmedName,
      description: typeof description === 'string' ? description.trim() : '',
      imageUrl: typeof imageUrl === 'string' ? imageUrl.trim() : undefined,
      icon: typeof icon === 'string' ? icon.trim() : undefined,
      displayOrder: effectiveOrder,
      active: effectiveActive,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    db.createFoodCategory(newCat);
    res.status(201).json(newCat);
  });

  app.put("/api/food/categories/:id", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    if (!isAuthorizedFoodAdmin(req)) {
      return res.status(403).json({ error: "Rol no autorizado para administrar categorías" });
    }
    const companyId = req.user!.companyId;
    const company = db.getCompanyById(companyId);
    if (!company || !isFoodAuthorizedCompany(company)) {
      return res.status(403).json({ error: "Comercio no autorizado para administrar menú gastronómico" });
    }

    const { id } = req.params;
    const existingCats = db.getFoodCategoriesByCompanyId(companyId);
    const existing = existingCats.find((c) => c.id === id);
    if (!existing) {
      return res.status(404).json({ error: "Categoría no encontrada o no pertenece a su empresa" });
    }

    const updates: Partial<FoodCategory> = {};

    if (req.body.name !== undefined) {
      const trimmedName = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      if (!trimmedName) {
        return res.status(400).json({ error: "El nombre de la categoría no puede estar vacío" });
      }
      const isDuplicate = existingCats.some(
        (c) => c.id !== id && c.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (isDuplicate) {
        return res.status(400).json({ error: `Ya existe otra categoría con el nombre "${trimmedName}" en este comercio` });
      }
      updates.name = trimmedName;
    }

    if (req.body.description !== undefined) {
      updates.description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    }
    if (req.body.imageUrl !== undefined) {
      updates.imageUrl = req.body.imageUrl;
    }
    if (req.body.icon !== undefined) {
      updates.icon = req.body.icon;
    }
    if (req.body.displayOrder !== undefined) {
      updates.displayOrder = typeof req.body.displayOrder === 'number' ? req.body.displayOrder : existing.displayOrder;
    } else if (req.body.sortOrder !== undefined) {
      updates.displayOrder = typeof req.body.sortOrder === 'number' ? req.body.sortOrder : existing.displayOrder;
    }
    if (req.body.active !== undefined) {
      updates.active = Boolean(req.body.active);
    } else if (req.body.isActive !== undefined) {
      updates.active = Boolean(req.body.isActive);
    }

    const updated = db.updateFoodCategory(id, updates);
    res.json(updated);
  });

  app.delete("/api/food/categories/:id", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    if (!isAuthorizedFoodAdmin(req)) {
      return res.status(403).json({ error: "Rol no autorizado para administrar categorías" });
    }
    const companyId = req.user!.companyId;
    const company = db.getCompanyById(companyId);
    if (!company || !isFoodAuthorizedCompany(company)) {
      return res.status(403).json({ error: "Comercio no autorizado para administrar menú gastronómico" });
    }

    const { id } = req.params;
    const existing = db.getFoodCategoriesByCompanyId(companyId).find((c) => c.id === id);
    if (!existing) {
      return res.status(404).json({ error: "Categoría no encontrada o no pertenece a su empresa" });
    }

    // Safe deletion check: prevent deleting if products are associated
    const associatedProducts = db.getFoodProductsByCompanyId(companyId).filter((p) => p.categoryId === id);
    if (associatedProducts.length > 0) {
      return res.status(400).json({
        error: `No se puede eliminar esta categoría porque tiene ${associatedProducts.length} producto(s) asociado(s). Podés desactivarla para ocultarla del menú.`,
        associatedProductsCount: associatedProducts.length,
      });
    }

    db.deleteFoodCategory(id);
    res.json({ success: true, message: "Categoría eliminada exitosamente" });
  });

  // UPLOAD PRODUCT IMAGE (MULTI-TENANT SECURE FILE UPLOAD VIA MULTER / FORMDATA)
  app.post(
    "/api/food/products/upload-image",
    rateLimit(60000, 30),
    authenticateUser,
    (req: AuthenticatedRequest, res: Response, next) => {
      try {
        productImageUpload.any()(req, res, (err) => {
          if (err) {
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
              return res.status(400).json({ error: 'El archivo supera el tamaño máximo permitido de 5MB.' });
            }
            return res.status(400).json({ error: err.message || 'Error al procesar la imagen' });
          }
          next(); // Solo se llama a next() si NO hay error
        });
      } catch (err: any) {
        return res.status(400).json({ error: err?.message || 'Error al procesar la imagen' });
      }
    },
    (req: AuthenticatedRequest, res: Response) => {
      if (!isAuthorizedFoodAdmin(req)) {
        return res.status(403).json({ error: "Rol no autorizado para administrar productos" });
      }
      const companyId = req.user!.companyId;
      const company = db.getCompanyById(companyId);
      if (!company || !isFoodAuthorizedCompany(company)) {
        return res.status(403).json({ error: "Comercio no autorizado para administrar productos gastronómicos" });
      }

      const { productId } = req.body;
      const file = (req.files as Express.Multer.File[])?.[0] || req.file;

      if (!productId || !file) {
        return res.status(400).json({ error: "Faltan parámetros requeridos (productId y archivo file)" });
      }

      // Security check: If product already exists, verify ownership
      const existingProd = db.getFoodProductsByCompanyId(companyId).find((p) => p.id === productId);
      if (existingProd && existingProd.companyId !== companyId) {
        return res.status(403).json({ error: "No tiene permisos sobre este producto" });
      }

      // Validate real MIME type
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMimes.includes(file.mimetype)) {
        return res.status(400).json({ error: "Formato de archivo no soportado. Permitidos: JPG, PNG, WEBP." });
      }

      // Validate extension
      const extMap: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
      };
      const ext = extMap[file.mimetype] || '.jpg';

      // Target directory: data/uploads/companies/{companyId}/products/{productId}
      const uploadDir = path.join(process.cwd(), 'data', 'uploads', 'companies', companyId, 'products', productId);
      try {
        fs.mkdirSync(uploadDir, { recursive: true });
        const safeFileName = `image_${Date.now()}${ext}`;
        const filePath = path.join(uploadDir, safeFileName);
        fs.writeFileSync(filePath, file.buffer);

        // Return the public URL for this image
        const publicUrl = `/uploads/companies/${companyId}/products/${productId}/${safeFileName}`;
        res.json({ publicUrl, imageUrl: publicUrl });
      } catch (err: any) {
        console.error('[Upload Error]:', err);
        res.status(500).json({ error: "Error al guardar la imagen en el servidor" });
      }
    }
  );

  // REEMPLAZAR TODO EL BLOQUE DE DELETE-image CON ESTO:
  app.post("/api/food/products/delete-image", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    if (!isAuthorizedFoodAdmin(req)) {
      return res.status(403).json({ error: "Rol no autorizado para administrar productos" });
    }
    const companyId = req.user!.companyId;
    const company = db.getCompanyById(companyId);
    if (!company || !isFoodAuthorizedCompany(company)) {
      return res.status(403).json({ error: "Comercio no autorizado" });
    }

    const { productId, imageUrl } = req.body;
    if (!productId || !imageUrl) {
      return res.status(400).json({ error: "Faltan parámetros para eliminar la imagen" });
    }

    // 1. Validación estricta de prefijo (evita manipulación de URL)
    const expectedPrefix = `/uploads/companies/${encodeURIComponent(companyId)}/products/${encodeURIComponent(productId)}/`;
    if (!imageUrl.startsWith(expectedPrefix)) {
      return res.status(403).json({ error: "No tiene permisos para eliminar esta imagen o la ruta es inválida" });
    }

    // 2. Extraer solo el nombre del archivo, rechazando cualquier intento de directorio
    const filename = decodeURIComponent(imageUrl.slice(expectedPrefix.length));
    if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      return res.status(400).json({ error: "Nombre de archivo inválido" });
    }

    // 3. Resolver ruta absoluta y verificar que no escape del directorio de uploads
    const uploadRoot = path.resolve(process.cwd(), 'data', 'uploads');
    const targetPath = path.resolve(uploadRoot, 'companies', companyId, 'products', productId, filename);
    const relativePathCheck = path.relative(uploadRoot, targetPath);
    
    if (relativePathCheck.startsWith('..') || path.isAbsolute(relativePathCheck)) {
      return res.status(400).json({ error: "Ruta de archivo inválida o intento de acceso no autorizado" });
    }

    try {
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
      // Actualizar la BD para quitar la referencia a la imagen huérfana
      db.updateFoodProduct(productId, { imageUrl: '' });
      res.json({ success: true, message: "Imagen eliminada del servidor" });
    } catch (err: any) {
      console.error('[Delete Image Error]:', err);
      res.status(500).json({ error: "Error al eliminar la imagen del servidor" });
    }
  });

  // PRODUCTS CRUD - DYNAMIC MULTI-TENANT PRODUCTS
  app.post("/api/food/products", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    if (!isAuthorizedFoodAdmin(req)) {
      return res.status(403).json({ error: "Rol no autorizado para administrar productos" });
    }
    const companyId = req.user!.companyId;
    const company = db.getCompanyById(companyId);
    if (!company || !isFoodAuthorizedCompany(company)) {
      return res.status(403).json({ error: "Comercio no autorizado para administrar productos gastronómicos" });
    }

    const { id, categoryId, name, description, price, imageUrl, isAvailable, displayOrder, optionGroups } = req.body;
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!categoryId || !trimmedName || typeof price !== 'number') {
      return res.status(400).json({ error: "categoryId, name y price numérico son obligatorios" });
    }

    // Strict tenant isolation on category
    const category = db.getFoodCategoriesByCompanyId(companyId).find((c) => c.id === categoryId);
    if (!category) {
      return res.status(400).json({ error: "La categoría seleccionada no existe o no pertenece a su comercio" });
    }

    const newProd: FoodProduct = {
      id: id || `fprod_${crypto.randomUUID()}`,
      companyId,
      categoryId,
      name: trimmedName,
      description: typeof description === 'string' ? description.trim() : '',
      price: Math.max(0, price),
      imageUrl,
      isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : true,
      displayOrder: typeof displayOrder === 'number' ? displayOrder : 1,
      optionGroups: Array.isArray(optionGroups) ? optionGroups : [],
    };

    db.createFoodProduct(newProd);
    res.status(201).json(newProd);
  });

  app.put("/api/food/products/:id", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    if (!isAuthorizedFoodAdmin(req)) {
      return res.status(403).json({ error: "Rol no autorizado para administrar productos" });
    }
    const companyId = req.user!.companyId;
    const company = db.getCompanyById(companyId);
    if (!company || !isFoodAuthorizedCompany(company)) {
      return res.status(403).json({ error: "Comercio no autorizado para administrar productos gastronómicos" });
    }

    const { id } = req.params;
    const existing = db.getFoodProductsByCompanyId(companyId).find((p) => p.id === id);
    if (!existing) {
      return res.status(404).json({ error: "Producto no encontrado o no pertenece a su empresa" });
    }

    // If updating categoryId, ensure it belongs to this company
    if (req.body.categoryId && req.body.categoryId !== existing.categoryId) {
      const category = db.getFoodCategoriesByCompanyId(companyId).find((c) => c.id === req.body.categoryId);
      if (!category) {
        return res.status(400).json({ error: "La categoría seleccionada no existe o no pertenece a su comercio" });
      }
    }

    const updated = db.updateFoodProduct(id, req.body);
    res.json(updated);
  });

  app.delete("/api/food/products/:id", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    if (!isAuthorizedFoodAdmin(req)) {
      return res.status(403).json({ error: "Rol no autorizado para administrar productos" });
    }
    const company = db.getCompanyById(req.user!.companyId);
    if (!company || !isFoodAuthorizedCompany(company)) {
      return res.status(403).json({ error: "Comercio no autorizado para administrar productos gastronómicos" });
    }

    const { id } = req.params;
    const existing = db.getFoodProductsByCompanyId(req.user!.companyId).find((p) => p.id === id);
    if (!existing) return res.status(404).json({ error: "Producto no encontrado o no pertenece a su empresa" });

    db.deleteFoodProduct(id);
    res.json({ success: true });
  });

  // SHIPPING RATE CONFIG
  app.put("/api/food/shipping-rate", authenticateUser, (req: AuthenticatedRequest, res: Response) => {
    if (!isAuthorizedFoodAdmin(req)) {
      return res.status(403).json({ error: "Rol no autorizado para administrar tarifas" });
    }
    const companyId = req.user!.companyId;
    const company = db.getCompanyById(companyId);
    if (!company || !isFoodAuthorizedCompany(company)) {
      return res.status(403).json({ error: "Comercio no autorizado para configurar tarifas gastronómicas" });
    }

    const { baseFee, includedKm, perKmFee, maxDistanceKm, freeShippingThreshold, storeLatitude, storeLongitude } = req.body;

    if (
      typeof baseFee !== 'number' || baseFee < 0 ||
      typeof includedKm !== 'number' || includedKm < 0 ||
      typeof perKmFee !== 'number' || perKmFee < 0 ||
      typeof maxDistanceKm !== 'number' || maxDistanceKm <= 0 ||
      typeof storeLatitude !== 'number' || storeLatitude < -90 || storeLatitude > 90 || !Number.isFinite(storeLatitude) ||
      typeof storeLongitude !== 'number' || storeLongitude < -180 || storeLongitude > 180 || !Number.isFinite(storeLongitude)
    ) {
      return res.status(400).json({ error: "Valores numéricos de tarifa o coordenadas de la tienda inválidos" });
    }

    const rate = db.upsertFoodShippingRate({
      companyId,
      baseFee: Math.max(0, baseFee),
      includedKm: Math.max(0, includedKm),
      perKmFee: Math.max(0, perKmFee),
      maxDistanceKm: Math.max(1, maxDistanceKm),
      freeShippingThreshold: typeof freeShippingThreshold === 'number' && freeShippingThreshold >= 0 ? freeShippingThreshold : null,
      storeLatitude,
      storeLongitude,
    });

    res.json(rate);
  });

  // Admin Backup Trigger (Protected: SUPER_ADMIN only)
const COMMERCE_ALLOWED_ROLES: (UserRole | string)[] = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'DISPATCHER', 'CASHIER', 'STOCK_OPERATOR', 'OPERATOR'];

function requireCommerceAccess(req: AuthenticatedRequest, res: Response, next: express.NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  if (!COMMERCE_ALLOWED_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'FORBIDDEN_COMMERCE_ACCESS' });
  }
  next();
}

    // --- UBIKA COMMERCE API ROUTES ---
    app.get("/api/v1/commerce/products", authenticateUser, requireCommerceAccess, (req: AuthenticatedRequest, res: Response) => {
      try {
        const products = CommerceService.getProducts(req.user!.companyId);
        res.json(products);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });

    app.post("/api/v1/commerce/products", authenticateUser, requireCommerceAccess, (req: AuthenticatedRequest, res: Response) => {
      try {
        const product = CommerceService.createProduct(req.body, req.user!.companyId);
        res.status(201).json(product);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });

    app.get("/api/v1/commerce/products/:id", authenticateUser, requireCommerceAccess, (req: AuthenticatedRequest, res: Response) => {
      try {
        const product = CommerceService.getProduct(req.params.id, req.user!.companyId);
        if (!product) return res.status(404).json({ error: "Producto no encontrado" });
        res.json(product);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });

    app.patch("/api/v1/commerce/products/:id", authenticateUser, requireCommerceAccess, (req: AuthenticatedRequest, res: Response) => {
      try {
        const updated = CommerceService.updateProduct(req.params.id, req.user!.companyId, req.body);
        if (!updated) return res.status(404).json({ error: "Producto no encontrado" });
        res.json(updated);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });

    app.delete("/api/v1/commerce/products/:id", authenticateUser, requireCommerceAccess, (req: AuthenticatedRequest, res: Response) => {
      try {
        const success = CommerceService.deleteProduct(req.params.id, req.user!.companyId);
        if (!success) return res.status(404).json({ error: "Producto no encontrado" });
        res.json({ success: true });
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });

    app.get("/api/v1/commerce/categories", authenticateUser, requireCommerceAccess, (req: AuthenticatedRequest, res: Response) => {
      try {
        const categories = CommerceService.getCategories(req.user!.companyId);
        res.json(categories);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });

    app.post("/api/v1/commerce/categories", authenticateUser, requireCommerceAccess, (req: AuthenticatedRequest, res: Response) => {
      try {
        const cat = CommerceService.createCategory(req.body, req.user!.companyId);
        res.status(201).json(cat);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });

    app.get("/api/v1/commerce/customers", authenticateUser, requireCommerceAccess, (req: AuthenticatedRequest, res: Response) => {
      try {
        const customers = CommerceService.getCustomers(req.user!.companyId);
        res.json(customers);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });

    app.post("/api/v1/commerce/customers", authenticateUser, requireCommerceAccess, (req: AuthenticatedRequest, res: Response) => {
      try {
        const cust = CommerceService.createCustomer(req.body, req.user!.companyId);
        res.status(201).json(cust);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });

    app.get("/api/v1/commerce/stock/movements", authenticateUser, requireCommerceAccess, (req: AuthenticatedRequest, res: Response) => {
      try {
        const movements = CommerceService.getStockMovements(req.user!.companyId);
        res.json(movements);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });

    app.post("/api/v1/commerce/stock/adjust", authenticateUser, requireCommerceAccess, (req: AuthenticatedRequest, res: Response) => {
      try {
        const { productId, quantity, type, reason } = req.body;
        const mov = CommerceService.adjustStock(productId, req.user!.companyId, Number(quantity), type, reason, req.user!.userId);
        res.status(201).json(mov);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });

    app.get("/api/v1/commerce/cash", authenticateUser, requireCommerceAccess, (req: AuthenticatedRequest, res: Response) => {
      try {
        const sessions = CommerceService.getCashSessions(req.user!.companyId);
        res.json(sessions);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });

    app.get("/api/v1/commerce/cash/current", authenticateUser, requireCommerceAccess, (req: AuthenticatedRequest, res: Response) => {
      try {
        const session = CommerceService.getCurrentCashSession(req.user!.companyId, req.user!.userId);
        res.json(session || null);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });

    app.post("/api/v1/commerce/cash/open", authenticateUser, requireCommerceAccess, (req: AuthenticatedRequest, res: Response) => {
      try {
        const { initialCash, branchId } = req.body;
        const session = CommerceService.openCashSession(req.user!.companyId, req.user!.userId, initialCash, branchId);
        res.status(201).json(session);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });

    app.post("/api/v1/commerce/cash/close", authenticateUser, requireCommerceAccess, (req: AuthenticatedRequest, res: Response) => {
      try {
        const { sessionId, countedCash, notes } = req.body;
        const session = CommerceService.closeCashSession(sessionId, req.user!.companyId, Number(countedCash), notes, req.user!.userId, req.user!.role);
        recordAuditEvent(req.user!.companyId, '', 0, 'DELIVERY_COMPLETED', 'Cierre de caja registrado.', req.user!.name, req.user!.userId, req.user!.role, { legalCriticalEvent: 'CASH_SESSION_CLOSED', sessionId });
        res.json(session);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });

    app.get("/api/v1/commerce/sales", authenticateUser, requireCommerceAccess, (req: AuthenticatedRequest, res: Response) => {
      try {
        const sales = CommerceService.getSales(req.user!.companyId);
        res.json(sales);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });

    app.post("/api/v1/commerce/sales", rateLimit(60000, 60), authenticateUser, requireCommerceAccess, async (req: AuthenticatedRequest, res: Response) => {
      try {
        const idempotencyKey = req.headers['x-idempotency-key'] as string || req.body.idempotencyKey;
        const sale = await CommerceService.finalizeSale({
          companyId: req.user!.companyId,
          branchId: req.body.branchId,
          customerId: req.body.customerId,
          items: req.body.items,
          payments: req.body.payments,
          discount: req.body.discount,
          surcharge: req.body.surcharge,
          idempotencyKey,
          userId: req.user!.userId,
        });
        recordAuditEvent(req.user!.companyId, '', 0, 'DELIVERY_COMPLETED', 'Venta registrada y cobro procesado.', req.user!.name, req.user!.userId, req.user!.role, { legalCriticalEvent: 'SALE_COMPLETED', saleId: sale.id });
        res.status(201).json(sale);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });

    app.get("/api/v1/commerce/sales/:id", authenticateUser, requireCommerceAccess, (req: AuthenticatedRequest, res: Response) => {
      try {
        const sale = CommerceService.getSale(req.params.id, req.user!.companyId);
        if (!sale) return res.status(404).json({ error: "Venta no encontrada" });
        res.json(sale);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });

    app.post("/api/v1/commerce/fiscal/invoice", authenticateUser, requireCommerceAccess, async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { saleId, customerDocument, customerName, voucherType } = req.body;
        const invoice = await CommerceService.fiscalizeSale(saleId, req.user!.companyId, customerDocument, customerName, voucherType || 'FACTURA_B');
        recordAuditEvent(req.user!.companyId, '', 0, 'DELIVERY_COMPLETED', 'Comprobante fiscal autorizado por ARCA.', req.user!.name, req.user!.userId, req.user!.role, { legalCriticalEvent: 'FISCAL_INVOICE_APPROVED', invoiceId: invoice.id, cae: invoice.cae, caeExpiration: invoice.caeExpiration });
        res.status(201).json(invoice);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });

  app.post("/api/admin/backup", authenticateUser, requireRole(['SUPER_ADMIN']), (_req: AuthenticatedRequest, res: Response) => {
    const file = db.createBackup();
    res.json({ success: true, backupFile: file, timestamp: Date.now() });
  });

  // Global API Error Handler - prevents stack traces and path leaks
  app.use((err: any, _req: Request, res: Response, _next: express.NextFunction) => {
    console.error('[UBIKA Server Error Handler]:', err.message || err);
    res.status(500).json({
      error: 'Ha ocurrido un error interno',
      message: 'Por favor intente nuevamente en unos instantes.',
    });
  });

    return app;
}

async function startServer() {
  const PORT = 3000;
  const app = createUbikaApp();

  // --- Vite / Static Files Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[UBIKA Server] Servidor ejecutándose en http://0.0.0.0:${PORT}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
