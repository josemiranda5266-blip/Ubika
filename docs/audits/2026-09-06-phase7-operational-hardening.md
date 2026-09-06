# UBIKA — Auditoría Fase 7: Operación y perímetro

Fecha: 2026-09-06  
Estado: correcciones en curso; tests/build/lint/typecheck habilitados cuando sean necesarios.

## Estado de referencia

La rama `main` actualmente apunta a `27ad3fdd57dd234e6cc4d5688e174fd735f79229` (`fix: preserve existing package dependencies`). La auditoría de esta fase se debe hacer contra ese estado y no contra snapshots históricos anteriores.

## Hallazgos verificados sobre `main`

### 1. CORS: política incompleta, no wildcard

El middleware actual establece métodos y headers CORS, pero no define `Access-Control-Allow-Origin`. No se debe confundir esto con el hallazgo histórico de wildcard `*`: en el `server.ts` actual no se observó ese wildcard.

**Riesgo actual:** los clientes web que dependan de requests cross-origin controladas no tienen una allowlist explícita y la política queda implícita/incompleta.

**Corrección preparada:** `server/ops/http-security.ts` implementa `CORS_ALLOWED_ORIGINS`, `Vary: Origin`, rechazo de preflight no autorizado y headers mínimos. Falta integrarlo en `createUbikaApp()`.

### 2. Request ID / correlación

El `server.ts` actual no establece un `X-Request-Id` de forma consistente por request.

**Corrección preparada:** `server/ops/http-security.ts` acepta un ID externo sólo con formato/longitud segura o genera `crypto.randomUUID()`, y lo devuelve como `X-Request-Id`.

### 3. Manejo global de errores

El `server.ts` actual sí contiene un error handler final que evita devolver el detalle de la excepción al cliente. Sin embargo, varias rutas de Commerce todavía convierten directamente `err.message` en respuestas HTTP 400, por ejemplo en las rutas `/api/v1/commerce/*`. Eso puede exponer mensajes internos o detalles de implementación de servicios.

**Corrección preparada:** `httpErrorHandler()` devuelve `INTERNAL_SERVER_ERROR` y un `requestId` sin stack trace ni detalle interno. Falta reemplazar gradualmente los `catch` que exponen `err.message` por errores de dominio/controlados.

### 4. Health / readiness

`GET /api/health` actualmente devuelve `status: ok`, versión y tipo de almacenamiento, pero no existe una separación clara entre liveness y readiness. La respuesta no verifica explícitamente que el almacenamiento persistente esté preparado para operar.

**Corrección pendiente:** mantener `/api/health` como liveness y agregar `/api/readiness` con comprobación segura de la disponibilidad de la base persistente, respondiendo 503 cuando la instancia no esté lista.

### 5. Trust proxy

El hallazgo histórico de `app.set('trust proxy', 1)` **no corresponde al `server.ts` actual de `main`** y queda descartado como hallazgo vigente hasta nueva evidencia. Antes de introducir configuración nueva se debe verificar cómo Express recibe `req.ip` y si el despliegue realmente necesita `TRUST_PROXY_HOPS`.

### 6. Graceful shutdown

No se observan handlers explícitos de `SIGTERM`/`SIGINT` en el `server.ts` actual. El proceso inicia con `app.listen(...)` sin una estrategia de cierre ordenado.

**Corrección pendiente:** conservar la referencia al `http.Server`, detener aceptación de nuevas conexiones y cerrar el proceso de forma controlada ante `SIGTERM`/`SIGINT`.

### 7. Backups: v2 creada, todavía no integrada al API

`server/ops/backup.ts` ya implementa Backup v2: snapshot después de `saveDatabaseSync()`, manifiesto con SHA-256/tamaño, validación de integridad, validación básica del esquema y rollback previo a restore.

El endpoint existente `/api/admin/backup` continúa usando `db.createBackup()`. Por tanto, **Backup v2 todavía no está operativo desde HTTP**. Falta integrar creación/listado/restauración con autorización `SUPER_ADMIN`, errores controlados y una estrategia segura para reemplazo de archivo compatible con Windows/Linux.

### 8. Protección HTTP reusable preparada

Se agregó `server/ops/http-security.ts`, con:

- `X-Request-Id` seguro y correlacionable.
- CORS mediante allowlist `CORS_ALLOWED_ORIGINS`.
- rechazo de preflight no autorizado.
- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy`.
- `X-Powered-By` deshabilitado.
- error handler genérico con `INTERNAL_SERVER_ERROR` y `requestId`.

Se agregó `tests/http_security.test.ts` y quedó incorporado al script `npm test`/`test` del proyecto.

**Importante:** esta capa está preparada y testeada estáticamente, pero todavía no está montada en `createUbikaApp()`. No se considera una corrección de producción cerrada hasta integrarla.

## Verificación

Los tests/build/lint/typecheck están autorizados y deben ejecutarse cuando el entorno permita ejecución. En esta sesión el contenedor local no pudo clonar GitHub por resolución de red, por lo que no se debe afirmar que la batería haya sido ejecutada localmente.

Además, existe al menos un workflow histórico de hardening que terminó en `failure` sobre un commit que ya no es `main`; ese resultado no debe utilizarse como evidencia de fallo del `27ad3fdd...` actual sin volver a ejecutar la suite sobre la rama vigente.

## Restricción de implementación de `server.ts`

No se modificará `server.ts` mediante una reconstrucción parcial. El archivo es grande y la herramienta de actualización exige reemplazo completo. La integración de los módulos preparados debe hacerse sólo cuando se disponga del contenido íntegro verificado o de un mecanismo de edición segura.

## Próxima secuencia

1. Integrar `http-security.ts` en `createUbikaApp()`.
2. Reemplazar los `catch` de Commerce que exponen `err.message` por errores/códigos controlados.
3. Separar liveness/readiness.
4. Integrar graceful shutdown.
5. Integrar Backup v2 en rutas administrativas y deprecar el mecanismo legado.
6. Ejecutar typecheck/lint y la batería completa de tests.
7. Ejecutar build de producción.
8. Revisar artefacto final y actualizar este documento con resultados reales.
