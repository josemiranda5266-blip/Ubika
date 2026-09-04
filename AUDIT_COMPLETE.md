# 🔍 UBIKA — AUDITORÍA COMPLETA Y ROADMAP DE PRODUCCIÓN

**Fecha:** Septiembre 2026
**Estado:** Pre-producción
**Versión:** 0.0.1
**Objetivo:** Convertir UBIKA de prototipo a plataforma SaaS profesional

---

## 📊 RESUMEN EJECUTIVO

### ¿Qué es UBIKA?

UBIKA es una plataforma inteligente de ubicación y entrega que conecta repartidores con clientes. Incluye:

- **Logística de entregas** con seguimiento GPS en tiempo real
- **Sistema de gastronomía** (UBIKA FOOD) con menús, órdenes, cocina y despacho
- **Sistema de comercio** (UBIKA COMMERCE) con productos, caja, stock y reportes
- **Gestión de empresas** multi-tenant con roles y permisos
- **Auditoría completa** de todas las operaciones
- **Privacidad by design** con purga automática de datos

### Estado Actual

✅ **Fortalezas:**
- Arquitectura multi-tenant bien pensada
- Concepto de privacidad correcto
- Modelos de datos coherentes
- Validaciones backend presentes
- Rate limiting y autenticación JWT
- TypeScript en frontend y backend
- Estructura de roles y permisos
- Tests planificados en package.json
- Persistencia robusta (JSON + backups)

❌ **Carencias críticas:**
- No está lista para múltiples usuarios reales
- Base de datos JSON (no escala)
- Monolito backend de 3100 líneas
- Validación incompleta en algunos endpoints
- Aislamiento multi-tenant no auditado al 100%
- Dependencia de scripts "fix_*" acumulados
- Frontend con deuda técnica
- Sin tests automatizados ejecutados
- CORS permisivo
- Almacenamiento de archivos local (no escala)

### Evaluación de Riesgo

| Aspecto | Riesgo | Impacto | Prioridad |
|--------|--------|--------|-----------|
| Seguridad | ALTO | Datos de empresas expuestos | 🔴 CRÍTICO |
| Multi-tenant | ALTO | Una empresa ve datos de otra | 🔴 CRÍTICO |
| Base de datos | MEDIO | Pérdida de datos con reinicio | 🟠 IMPORTANTE |
| Escalabilidad | MEDIO | No soporta >100 usuarios concurrentes | 🟠 IMPORTANTE |
| UX/UI | BAJO | Interfaz funcional pero áspera | 🟡 MEJORA |
| Arquitectura | ALTO | Difícil mantener y extender | 🔴 CRÍTICO |

---

## 🔴 FASE 1: SEGURIDAD (CRÍTICO)

### 1.1 Autenticación y Tokens JWT

**Status Actual:**
- JWT de 24h
- Firma con HS256
- Verificación de usuario en DB

**Problemas:**
- ❌ No hay rotación de tokens
- ❌ No hay revocación de tokens
- ❌ No hay blacklist de tokens comprometidos
- ❌ No hay refresh tokens
- ❌ No hay expiración diferenciada por rol

**Acciones:**
- [ ] Implementar refresh tokens (7 días para refresh, 1 hora para access)
- [ ] Crear tabla de token blacklist
- [ ] Implementar revocación en logout
- [ ] Validar `exp`, `iat`, `nbf` en JWT
- [ ] Usar RS256 en producción (con claves privadas)
- [ ] Agregar `jti` (JWT ID) para identificar tokens únicos
- [ ] Implementar rate limiting por usuario (no solo IP)

**Referencia:** `server/auth.ts` línea 11-41

### 1.2 Recuperación de Contraseña

**Status Actual:**
- Tokens temporales con SHA256
- Expiración de 24h
- Validación básica de contraseña

**Problemas:**
- ❌ Tokens almacenados como hash pero sin rotación
- ❌ No hay límite de intentos de reset
- ❌ No hay notificación de reset solicitado
- ❌ Respuesta genérica no lo suficiente para prevenir enumeración

**Acciones:**
- [ ] Implementar rate limiting por email (máx 3 requests/hora)
- [ ] Agregar IP y User-Agent al token reset
- [ ] Validar que reset se haga desde misma IP/navegador
- [ ] Invalidar tokens previos al solicitar nuevo reset
- [ ] Enviar email de notificación "request recibida"
- [ ] Hacer tokens de 64 caracteres criptográficamente seguros

**Referencia:** `server.ts` línea 440-482

### 1.3 Invitaciones de Empleados

**Status Actual:**
- Tokens temporales con hash SHA256
- Expiración de 7 días
- Rol asignado por admin

**Problemas:**
- ❌ No hay límite de invitaciones por empresa
- ❌ No hay revocación de invitaciones aceptadas
- ❌ Email no enviado en todos los casos
- ❌ No hay tracking de invitaciones pendientes

**Acciones:**
- [ ] Implementar estado de invitación: PENDING → ACCEPTED → EXPIRED
- [ ] Permitir que admin revoque invitaciones pendientes
- [ ] Logging de quién aceptó invitación y cuándo
- [ ] Resend invitation automático si no se acepta en 3 días
- [ ] Validar que email no cambie durante accept

**Referencia:** `server.ts` línea 316-370

### 1.4 Validación de Inputs

**Status Actual:**
- Validaciones dispersas en cada endpoint
- Algunos inputs sin validar tipo

**Problemas:**
- ❌ No hay validador centralizado
- ❌ Coordenadas aceptan valores inválidos en algunos casos
- ❌ Precios no validan número vs string
- ❌ Teléfonos sin formato
- ❌ Emails aceptan cualquier string

**Acciones:**
- [ ] Crear `src/validators/index.ts` con:
  - `validateEmail(string): boolean`
  - `validatePhone(string, country='AR'): boolean`
  - `validateCoordinates(lat, lng): boolean`
  - `validatePrice(value): number`
  - `validatePassword(string): { valid: boolean, error?: string }`
  - `validateProductName(string): boolean`
- [ ] Usar en TODOS los endpoints POST/PATCH
- [ ] Rechazar con 400 si falla
- [ ] No exponer razón exacta de fallo

### 1.5 Gestión de Archivos

**Status Actual:**
- Upload en `/data/uploads/companies/{companyId}/products/{productId}/`
- Validación de MIME type
- Máximo 5MB

**Problemas:**
- ❌ Archivos en disk local (no escala)
- ❌ No hay validación real de MIME (solo extensión)
- ❌ No hay escaneo de malware
- ❌ No hay deduplicación
- ❌ Acceso directo `/uploads/...` permite directory traversal

**Acciones:**
- [ ] Migrar a AWS S3 o similar
- [ ] Usar signed URLs con expiración
- [ ] Validar MIME con `file` command
- [ ] Escanear con ClamAV/similar
- [ ] Renombrar archivos con UUID
- [ ] Implementar CDN caching
- [ ] Crear tabla `file_uploads` con metadata y auditoría

**Referencia:** `server.ts` línea 2679-2774

### 1.6 CORS y Headers de Seguridad

**Status Actual:**
```typescript
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
// Falta Access-Control-Allow-Origin
```

**Problemas:**
- ❌ Sin CORS origin restriction
- ❌ Sin HSTS
- ❌ Sin CSP
- ❌ Sin X-UA-Compatible

**Acciones:**
- [ ] Agregar CORS whitelist: `['https://ubika.app', 'https://app.ubika.app']`
- [ ] Agregar HSTS: `max-age=31536000; includeSubDomains`
- [ ] Agregar CSP: `default-src 'self'; script-src 'self' 'unsafe-inline' unpkg.com; style-src 'self' 'unsafe-inline'`
- [ ] Agregar `X-UA-Compatible: IE=edge`
- [ ] Agregar `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] Agregar `Permissions-Policy: geolocation=(), microphone=()`

### 1.7 Rate Limiting Mejorado

**Status Actual:**
- Rate limiting por IP (60s window)
- Límites diferenciados por endpoint

**Problemas:**
- ❌ No hay rate limiting por usuario autenticado
- ❌ Memory leak en rateLimitMap
- ❌ No hay distinción entre tipos de ataque

**Acciones:**
- [ ] Implementar Redis para rate limiting distribuido
- [ ] Agregar límites por usuario: 1000 req/hora
- [ ] Agregar límites por endpoint específico
- [ ] Limpiar entries expiradas cada 5 min
- [ ] Agregar header `Retry-After` en 429
- [ ] Log de intentos fallidos para detección de patrones

---

## 🔴 FASE 2: MULTI-TENANT AUDIT (CRÍTICO)

### 2.1 Aislamiento de Datos

**Principio:** Ningún usuario debe acceder a datos de otra empresa, NUNCA.

**Auditoría de Endpoints:**

#### Entregas `/api/deliveries`
- [x] GET `/api/deliveries` → Scoped a req.user.companyId ✅
- [x] POST `/api/deliveries` → Valida que driverId pertenece a company ✅
- [x] PATCH `/api/deliveries/:id` → Valida companyId ✅

#### Repartidores `/api/drivers`
- [x] GET `/api/drivers` → Scoped ✅
- [x] POST `/api/drivers` → Valida companyId ✅
- [x] PATCH `/api/drivers/:id/status` → Valida ✅

#### Usuarios `/api/users`
- [x] GET `/api/users` → Scoped a company ✅
- [x] POST `/api/users` → Valida invitación por company ✅

#### Comida `/api/food/...`
- [ ] GET `/api/food/store/config` → Scoped ✅
- [ ] PUT `/api/food/store/config` → Scoped ✅
- [ ] POST `/api/food/categories` → Scoped ✅
- [ ] GET `/api/food/categories` → Scoped ✅
- [ ] POST `/api/food/products` → Scoped ✅
- [ ] GET `/api/food/products` → Scoped ✅
- [ ] POST `/api/food/orders` → **REVISAR**: ¿Valida companyId?** 
- [ ] GET `/api/food/orders` → Scoped ✅
- [ ] PATCH `/api/food/orders/:id/status` → Scoped ✅
- [ ] PUT `/api/food/shipping-rate` → Scoped ✅

#### Comercio `/api/v1/commerce/...`
- [ ] GET `/api/v1/commerce/products` → Scoped ✅
- [ ] POST `/api/v1/commerce/products` → Scoped ✅
- [ ] GET `/api/v1/commerce/categories` → Scoped ✅
- [ ] GET `/api/v1/commerce/sales` → Scoped ✅

**Acciones:**
- [ ] Crear test que intenta `GET /api/drivers?companyId=OTHER_COMPANY` → debe fallar
- [ ] Crear test que intenta `PATCH /api/food/orders/OTHER_COMPANY_ORDER/status` → debe fallar
- [ ] Crear test que intenta `GET /api/users?companyId=OTHER_COMPANY` → debe fallar
- [ ] Auditar CADA endpoint manualmente

### 2.2 Manejo de SUPER_ADMIN

**Problema:** SUPER_ADMIN puede ver TODO. Pero esto debe ser auditado.

**Acciones:**
- [ ] SUPER_ADMIN requiere 2FA
- [ ] SUPER_ADMIN nunca debe usar credenciales para testing
- [ ] Crear rol SUPER_ADMIN_AUDIT para auditoría
- [ ] Log de TODOS los accesos SUPER_ADMIN
- [ ] IP whitelist para SUPER_ADMIN
- [ ] Expiración de tokens SUPER_ADMIN cada 1 hora

### 2.3 Mapeo de Permisos por Rol

**Crear matriz exhaustiva:**

```
Acción                  SUPER  ADMIN  DISPATCH  DRIVER  KITCHEN  CLIENT
─────────────────────────────────────────────────────────────────────────
Ver empresas            ✅     ✅ (own)  ✅ (own)  ❌      ❌       ❌
Crear empresa           ✅     ❌       ❌       ❌      ❌       ❌
Ver drivers             ✅     ✅       ✅       ✅ (own) ❌       ❌
Crear driver            ✅     ✅       ❌       ❌      ❌       ❌
Ver entregas            ✅     ✅       ✅       ✅ (own) ❌       ❌ (public)
Crear entrega           ✅     ✅       ✅       ❌      ❌       ❌
Acceptar entrega        ✅     ✅       ✅       ✅ (own) ❌       ❌
Marcar entregada        ✅     ✅       ✅       ✅ (own) ❌       ❌
Ver productos           ✅     ✅       ❌       ❌      ✅       ✅ (own)
Crear producto          ✅     ✅       ❌       ❌      ❌       ❌
Ver pedidos comida       ✅     ✅       ❌       ❌      ✅ (own)  ❌ (tracking)
Crear pedido comida     ✅     ✅       ❌       ❌      ❌       ✅
Ver caja                ✅     ✅ (own) ✅ (own) ❌      ❌       ❌
Cobrar caja             ✅     ✅       ✅       ❌      ❌       ❌
Ver stock               ✅     ✅       ✅       ❌      ✅       ❌
Ajustar stock           ✅     ✅       ❌       ❌      ❌       ❌
Ver usuarios            ✅     ✅       ❌       ❌      ❌       ❌
Invitar usuario         ✅     ✅       ❌       ❌      ❌       ❌
```

**Acciones:**
- [ ] Convertir matriz en código: `src/middleware/permissions.ts`
- [ ] Usar en cada endpoint con `requirePermission('action', 'resource')`
- [ ] Tests para cada combinación inválida

---

## 🔴 FASE 3: BASE DE DATOS (CRÍTICO)

### 3.1 Migración a PostgreSQL

**Actual:** JSON en disk
**Objetivo:** PostgreSQL 14+ con migrations

**Schemaúncia base:**

```sql
-- Companies
CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  business_type TEXT, -- LOGISTICS | FOOD | HYBRID
  food_enabled BOOLEAN DEFAULT false,
  created_at BIGINT DEFAULT extract(epoch from now()) * 1000,
  updated_at BIGINT DEFAULT extract(epoch from now()) * 1000
);

-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL, -- SUPER_ADMIN | COMPANY_ADMIN | DRIVER | KITCHEN | DISPATCHER
  driver_id TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  created_at BIGINT DEFAULT extract(epoch from now()) * 1000,
  updated_at BIGINT DEFAULT extract(epoch from now()) * 1000,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  INDEX idx_company_id (company_id),
  INDEX idx_email (email),
  INDEX idx_role (role)
);

-- Drivers
CREATE TABLE drivers (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  vehicle TEXT NOT NULL, -- moto | bici | auto | camioneta | a_pie
  status TEXT DEFAULT 'disponible', -- disponible | en_tarea | pausado | desconectado
  total_deliveries INT DEFAULT 0,
  rating FLOAT DEFAULT 5.0,
  active_delivery_id TEXT,
  created_at BIGINT,
  last_active_at BIGINT,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  INDEX idx_company_id (company_id),
  INDEX idx_status (status)
);

-- Deliveries
CREATE TABLE deliveries (
  id TEXT PRIMARY KEY,
  order_number INT NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id),
  driver_id TEXT REFERENCES drivers(id),
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT,
  description TEXT NOT NULL,
  instructions TEXT,
  amount TEXT,
  payment_method TEXT,
  priority TEXT DEFAULT 'normal',
  status TEXT NOT NULL,
  session_token TEXT UNIQUE,
  recipient_location JSONB,
  driver_location JSONB,
  route_history JSONB,
  distance_meters INT,
  eta_minutes INT,
  created_at BIGINT,
  assigned_at BIGINT,
  accepted_at BIGINT,
  started_at BIGINT,
  arrived_at BIGINT,
  ended_at BIGINT,
  expires_at BIGINT,
  authorized_at BIGINT,
  privacy_policy_purged BOOLEAN DEFAULT false,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (driver_id) REFERENCES drivers(id),
  INDEX idx_company_id (company_id),
  INDEX idx_driver_id (driver_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- Location Sessions (para tracking público)
CREATE TABLE location_sessions (
  id TEXT PRIMARY KEY,
  delivery_id TEXT NOT NULL REFERENCES deliveries(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  session_token_hash TEXT UNIQUE NOT NULL,
  recipient_location JSONB,
  status TEXT DEFAULT 'ACTIVE', -- ACTIVE | EXPIRED | PURGED | CANCELLED
  created_at BIGINT,
  expires_at BIGINT,
  authorized_at BIGINT,
  ended_at BIGINT,
  INDEX idx_company_id (company_id),
  INDEX idx_delivery_id (delivery_id)
);

-- Events (Auditoría)
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  delivery_id TEXT REFERENCES deliveries(id),
  order_number INT,
  type TEXT NOT NULL, -- DELIVERY_CREATED | DRIVER_ASSIGNED | ...
  description TEXT,
  author TEXT,
  actor_id TEXT,
  actor_role TEXT,
  timestamp BIGINT,
  metadata JSONB,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  INDEX idx_company_id (company_id),
  INDEX idx_delivery_id (delivery_id),
  INDEX idx_timestamp (timestamp)
);

-- Food Stores
CREATE TABLE food_stores (
  company_id TEXT PRIMARY KEY REFERENCES companies(id),
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  phone TEXT,
  whatsapp_number TEXT,
  food_enabled BOOLEAN DEFAULT true,
  is_open_manual BOOLEAN DEFAULT true,
  schedule JSONB,
  bank_info JSONB,
  created_at BIGINT,
  updated_at BIGINT
);

-- Food Categories
CREATE TABLE food_categories (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  description TEXT,
  display_order INT DEFAULT 1,
  active BOOLEAN DEFAULT true,
  created_at BIGINT,
  updated_at BIGINT,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  INDEX idx_company_id (company_id),
  UNIQUE (company_id, name)
);

-- Food Products
CREATE TABLE food_products (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  category_id TEXT NOT NULL REFERENCES food_categories(id),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  display_order INT DEFAULT 1,
  option_groups JSONB,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (category_id) REFERENCES food_categories(id),
  INDEX idx_company_id (company_id),
  INDEX idx_category_id (category_id)
);

-- Food Orders
CREATE TABLE food_orders (
  id TEXT PRIMARY KEY,
  order_number INT NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id),
  delivery_type TEXT NOT NULL, -- FOOD_DELIVERY | FOOD_PICKUP
  delivery_id TEXT REFERENCES deliveries(id),
  driver_id TEXT REFERENCES drivers(id),
  items JSONB NOT NULL,
  subtotal DECIMAL(10, 2),
  shipping_cost DECIMAL(10, 2),
  total_amount DECIMAL(10, 2),
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  delivery_address TEXT,
  recipient_location JSONB,
  payment_method TEXT,
  payment_status TEXT DEFAULT 'PENDING', -- PENDING | PROCESSING | APPROVED | REJECTED
  order_status TEXT DEFAULT 'PENDING', -- PENDING | CONFIRMED | PREPARING | READY | ASSIGNED | IN_TRANSIT | DELIVERED | ...
  pickup_code TEXT UNIQUE,
  pickup_code_used_at BIGINT,
  picked_up_at BIGINT,
  public_tracking_token TEXT UNIQUE,
  created_at BIGINT,
  updated_at BIGINT,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (delivery_id) REFERENCES deliveries(id),
  FOREIGN KEY (driver_id) REFERENCES drivers(id),
  INDEX idx_company_id (company_id),
  INDEX idx_created_at (created_at)
);
```

**Acciones:**
- [ ] Crear carpeta `src/database/migrations/`
- [ ] Crear archivos de migración numerados
- [ ] Implementar Knex.js o similar
- [ ] Crear seed data para testing
- [ ] Crear indexes correctos
- [ ] Crear constraints FK
- [ ] Crear transacciones para operaciones críticas

### 3.2 Transacciones y Concurrencia

**Problema:** En JSON, dos clientes pueden modificar el mismo delivery simultáneamente.

**Solución:**
- [ ] Usar `BEGIN TRANSACTION` para operaciones críticas
- [ ] Implementar optimistic locking con `updated_at`
- [ ] Usar `SELECT ... FOR UPDATE` donde sea necesario
- [ ] Crear stored procedures para operaciones complejas
- [ ] Implementar idempotencia con `idempotency_key`

---

## 🟠 FASE 4: ARQUITECTURA BACKEND (IMPORTANTE)

### 4.1 Refactorizar server.ts

**Actual:** Monolito de 3100 líneas

**Objetivo:** Separar por módulos

```
server/
├── auth/
│   ├── service.ts        (lógica)
│   ├── routes.ts         (endpoints)
│   ├── middleware.ts     (verificación)
│   └── types.ts          (interfaces)
├── drivers/
│   ├── service.ts
│   ├── routes.ts
│   ├── validators.ts
│   └── types.ts
├── deliveries/
│   ├── service.ts
│   ├── routes.ts
│   ├── validators.ts
│   ├── state-machine.ts
│   └── types.ts
├── food/
│   ├── categories/
│   ├── products/
│   ├── orders/
│   └── shipping/
├── commerce/
│   ├── products/
│   ├── sales/
│   ├── cash/
│   └── stock/
├── notifications/
│   ├── email.ts
│   ├── whatsapp.ts
│   └── service.ts
├── audit/
│   └── service.ts
├── database/
│   └── connection.ts
├── middleware/
│   ├── auth.ts
│   ├── permissions.ts
│   ├── validation.ts
│   └── error-handler.ts
└── app.ts
```

**Acciones:**
- [ ] Crear estructura de carpetas
- [ ] Mover rutas por módulo
- [ ] Mover lógica a services
- [ ] Crear tipos específicos por módulo
- [ ] Crear validators por módulo
- [ ] Implementar middleware de error global

### 4.2 Error Handling

**Actual:** Respuestas inconsistentes

**Objetivo:** Unified error response

```typescript
{
  "error": "resource_not_found",
  "message": "El producto solicitado no existe",
  "status": 404,
  "timestamp": 1234567890,
  "request_id": "req_abc123"
}
```

**Acciones:**
- [ ] Crear clase `AppError` base
- [ ] Crear subclases: `ValidationError`, `AuthError`, `PermissionError`, etc.
- [ ] Implementar error handler middleware
- [ ] No exponer stack traces en producción
- [ ] Loguear stack trace interno
- [ ] Asignar `request_id` a cada request

---

## 🟠 FASE 5: LOGÍSTICA MEJORADA (IMPORTANTE)

### 5.1 Estado Máquina de Entregas

**Actual:** Estados simples sin validación de transiciones

**Objetivo:** State machine estricta

```
asignado
  ↓
esperando_autorizacion
  ├→ rechazado (si conductor rechaza)
  └→ ubicacion_compartida (si cliente autoriza)
    ├→ cancelado
    └→ en_camino
      ├→ cancelado
      └→ cerca
        ├→ cancelado
        └→ entregado (purga de coords)
```

**Acciones:**
- [ ] Crear `deliveries/state-machine.ts`
- [ ] Validar transiciones antes de actualizar
- [ ] Rechazar transiciones inválidas con 409
- [ ] Registrar razón de transición

### 5.2 Distancia y ETA

**Actual:** Haversine + estimación lineal

**Problemas:**
- No considera tráfico
- No considera tipo de vehículo
- No considera horario

**Acciones:**
- [ ] Integrar Google Maps Distance Matrix API
- [ ] Cachear distancias (24h)
- [ ] Factor de corrección por hora del día
- [ ] Factor de corrección por tipo de vehículo
- [ ] Mostrar rango (optimista/pesimista)

---

## 🟠 FASE 6: FRONTEND (IMPORTANTE)

### 6.1 Consolidar y Limpiar

**Actual:** 5 aplicaciones en una, con estados dispersos

**Objetivo:** Componentes reutilizables, estado centralizado

**Acciones:**
- [ ] Migrar a Zustand o Valtio para estado
- [ ] Crear componentes compartidos (Button, Input, Modal, etc.)
- [ ] Crear layout principal
- [ ] Implementar error boundary
- [ ] Agregar Suspense

### 6.2 Accesibilidad

**Objetivo:** WCAG 2.1 AA

**Acciones:**
- [ ] Agregar `aria-*` atributos
- [ ] Validar contraste de colores
- [ ] Hacer navegable por teclado
- [ ] Agregar screen reader support
- [ ] Tests de accesibilidad con axe

---

## 🟡 FASE 7: TESTING (MEJORA)

### 7.1 Unit Tests

**Acciones:**
- [ ] Usar Vitest
- [ ] Tests para validadores
- [ ] Tests para state machine
- [ ] Tests para cálculos (distancia, precio, ETA)
- [ ] Cobertura mínima: 80%

### 7.2 Integration Tests

**Acciones:**
- [ ] Setup de test DB (PostgreSQL en Docker)
- [ ] Tests de endpoints
- [ ] Tests de multi-tenant isolation
- [ ] Tests de permisos
- [ ] Tests de transacciones

### 7.3 E2E Tests

**Acciones:**
- [ ] Usar Playwright
- [ ] Test happy path completo
- [ ] Test error scenarios
- [ ] Test multi-user interactions

---

## 🟢 FASE 8: PRODUCCIÓN (OPCIONAL)

### 8.1 Infraestructura

**Acciones:**
- [ ] Setup EC2 / App Platform
- [ ] PostgreSQL Managed
- [ ] S3 para archivos
- [ ] CloudFront para CDN
- [ ] SSL/TLS con Let's Encrypt
- [ ] Domain con DNS
- [ ] Backups automáticos
- [ ] Monitoring con CloudWatch
- [ ] Logs con CloudWatch / DataDog

### 8.2 CI/CD

**Acciones:**
- [ ] GitHub Actions
- [ ] Lint → Test → Build → Deploy
- [ ] Security audit con npm audit
- [ ] SAST con SonarQube
- [ ] Performance test
- [ ] Smoke test en staging

---

## 📅 TIMELINE ESTIMADO

| Fase | Duración | Equipo |
|------|----------|--------|
| 1. Seguridad | 4 semanas | 2 devs |
| 2. Multi-tenant Audit | 2 semanas | 1 dev |
| 3. Base de datos | 6 semanas | 2 devs |
| 4. Arquitectura | 4 semanas | 2 devs |
| 5. Logística | 2 semanas | 1 dev |
| 6. Frontend | 4 semanas | 1-2 devs |
| 7. Testing | 4 semanas | 1-2 devs |
| 8. Producción | 2 semanas | 1 dev |
| **TOTAL** | **~28 semanas** | **2-3 devs** |

---

## 🚀 CRITERIOS DE ÉXITO

- [ ] 0 vulnerabilidades críticas de seguridad
- [ ] 100% de endpoints con test de aislamiento multi-tenant
- [ ] PostgreSQL con migrations versionadas
- [ ] Backend modular con <500 líneas por archivo
- [ ] Frontend con componentes reutilizables
- [ ] 80%+ de cobertura de tests
- [ ] HTTPS + HSTS + CSP activado
- [ ] Logs centralizados y monitoreo
- [ ] 3 empresas piloto usando la plataforma sin problemas
- [ ] RTO < 1 hora, RPO < 5 minutos

---

## 📞 PRÓXIMOS PASOS

1. **Semana 1:** Crear issues en GitHub por cada acción
2. **Semana 1-2:** Fase 1 (Seguridad) - Auditoría completa
3. **Semana 2-3:** Fase 2 (Multi-tenant) - Tests de aislamiento
4. **Semana 3-9:** Fase 3 (Base de datos) - Migración
5. ...

---

**Documento actualizado:** Septiembre 2026
**Próxima revisión:** Octubre 2026
