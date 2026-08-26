import crypto from 'node:crypto';
import express, { type Response } from 'express';
import { authenticateUser, requireRole, type AuthenticatedRequest } from '../auth';
import { createPersistentSalonService } from './persistent-service';
import { generatePublicTableQrToken, buildPublicTableQrPath } from './qr';
import type { RestaurantTableStatus } from './types';

const salonRouter = express.Router();
const salon = createPersistentSalonService();

const MANAGEMENT_ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN'] as const;
const TABLE_OPERATOR_ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'MOZO'] as const;

function errorResponse(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : 'SALON_OPERATION_FAILED';
  const status = message.endsWith('_NOT_FOUND') ? 404
    : message.includes('ACCESS_DENIED') ? 403
    : message.includes('ALREADY_EXISTS') ? 409
    : message.endsWith('_REQUIRED') || message.endsWith('_INVALID') ? 400
    : 500;
  return res.status(status).json({ error: message });
}

function publicQrUrl(req: AuthenticatedRequest, token: string): string {
  const base = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  return `${base}${buildPublicTableQrPath(token)}`;
}

salonRouter.get('/qr/:token', async (req, res) => {
  try {
    const table = await salon.resolveTableByQr(req.params.token);
    if (!table || !table.active) return res.status(404).json({ error: 'TABLE_QR_NOT_FOUND' });
    return res.json({ companyId: table.companyId, tableId: table.id, tableNumber: table.number, tableName: table.name, area: table.area, active: table.active });
  } catch (error) {
    return errorResponse(res, error);
  }
});

salonRouter.use(authenticateUser);

salonRouter.get('/tables', requireRole([...MANAGEMENT_ROLES]), async (req: AuthenticatedRequest, res) => {
  try {
    const branchId = typeof req.query.branchId === 'string' ? req.query.branchId : undefined;
    const tables = await salon.listTables(req.user!.companyId, branchId);
    return res.json({ tables: tables.map((table) => ({ ...table, qrUrl: publicQrUrl(req, table.publicQrToken) })) });
  } catch (error) {
    return errorResponse(res, error);
  }
});

salonRouter.post('/tables', requireRole([...MANAGEMENT_ROLES]), async (req: AuthenticatedRequest, res) => {
  try {
    const { number, name, capacity, area, branchId } = req.body ?? {};
    const table = await salon.createTable({
      id: `table_${crypto.randomUUID()}`,
      companyId: req.user!.companyId,
      branchId: typeof branchId === 'string' && branchId.trim() ? branchId.trim() : undefined,
      number: Number(number), name: typeof name === 'string' && name.trim() ? name.trim() : undefined,
      capacity: Number(capacity), area: typeof area === 'string' && area.trim() ? area.trim() : undefined,
      status: 'AVAILABLE', active: true, publicQrToken: generatePublicTableQrToken(), createdAt: Date.now(), updatedAt: Date.now(),
    });
    return res.status(201).json({ table, qrUrl: publicQrUrl(req, table.publicQrToken) });
  } catch (error) {
    return errorResponse(res, error);
  }
});

salonRouter.patch('/tables/:tableId', requireRole([...MANAGEMENT_ROLES]), async (req: AuthenticatedRequest, res) => {
  try {
    const { number, name, capacity, area, active, status, rotateQr } = req.body ?? {};
    const patch: { number?: number; name?: string; capacity?: number; area?: string; active?: boolean; status?: RestaurantTableStatus; publicQrToken?: string; updatedAt: number } = { updatedAt: Date.now() };
    if (number !== undefined) patch.number = Number(number);
    if (name !== undefined && typeof name === 'string' && name.trim()) patch.name = name.trim();
    if (capacity !== undefined) patch.capacity = Number(capacity);
    if (area !== undefined && typeof area === 'string' && area.trim()) patch.area = area.trim();
    if (active !== undefined) patch.active = Boolean(active);
    if (status !== undefined) patch.status = status as RestaurantTableStatus;
    if (rotateQr === true) patch.publicQrToken = generatePublicTableQrToken();
    const table = await salon.updateTable(req.user!.companyId, req.params.tableId, patch);
    return res.json({ table, qrUrl: publicQrUrl(req, table.publicQrToken) });
  } catch (error) {
    return errorResponse(res, error);
  }
});

salonRouter.get('/tables/operational', requireRole([...TABLE_OPERATOR_ROLES]), async (req: AuthenticatedRequest, res) => {
  try {
    const tables = await salon.listTables(req.user!.companyId);
    return res.json({ tables: tables.map((table) => ({ id: table.id, number: table.number, name: table.name, capacity: table.capacity, area: table.area, status: table.status, active: table.active })) });
  } catch (error) {
    return errorResponse(res, error);
  }
});

export default salonRouter;
