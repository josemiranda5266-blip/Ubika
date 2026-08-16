import express, { Request, Response } from "express";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { createServer as createViteServer } from "vite";
import { db, hashToken } from "./server/db";
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
} from "./src/types";

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
    id: `ev_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    companyId,
    deliveryId,
    orderNumber,
    type,
    description,
    timestamp: Date.now(),
    author,
    actorId,
    actorRole,
    metadata,
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Security & CORS configuration
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // JSON Body Parser with reasonable limits
  app.use(express.json({ limit: '1mb' }));

  // --- HEALTH & STATUS ---
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      version: "2.0.0-prod",
      storage: "persistent-disk-json",
      timestamp: Date.now(),
    });
  });

  // --- AUTHENTICATION ENDPOINTS ---
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
    return res.json({ user, company });
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

    const metrics: DashboardMetrics = {
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
      rawToken: sessionToken,
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

  // Admin Backup Trigger (Protected: SUPER_ADMIN only)
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

startServer();
