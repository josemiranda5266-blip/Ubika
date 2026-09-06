# UBIKA — Auditoría Fase 7: Operación y perímetro

Fecha: 2026-09-06  
Estado: correcciones en curso; tests/build/lint/typecheck habilitados cuando sean necesarios.

## Estado de referencia

La rama `main` está actualmente en `aea892cc8dad0b305bd6619a23884c47ff98eae8` (`fix: make backup restore replacement Windows-safe`). Esta auditoría se contrasta contra el código efectivo de `main`, no contra snapshots históricos.

## Hallazgos verificados sobre `main`

### 1. CORS: wildcard activo en el perímetro actual

El `server.ts` actual establece `Access-Control-Allow-Origin: *` para todas las solicitudes y además responde `204` a cualquier preflight sin validar el origen.

**Riesgo:** amplía innecesariamente la superficie cross-origin y no permite una política explícita por entorno.

**Corrección preparada:** `server/ops/http-security.ts` implementa `CORS_ALLOWED_ORIGINS`, `Vary: Origin` y rechazo de preflight no autorizado. Falta integrarlo en `createUbikaApp()` y retirar el middleware CORS duplicado para evitar políticas contradictorias.

### 2. Request ID / correlación

El `server.ts` actual no establece un `X-Request-Id` consistente por request.

**Corrección preparada:** `server/ops/http-security.ts` acepta un ID externo sólo con formato/longitud segura o genera `crypto.randomUUID()`, y lo devuelve como `X-Request-Id`.

### 3. Manejo global de errores

El `server.ts` actual contiene un error handler final que evita devolver el stack trace. Sin embargo, varias rutas de Commerce todavía convierten directamente `err.message` en respuestas HTTP 400. Eso puede exponer mensajes internos o detalles de implementación.

**Corrección preparada:** `httpErrorHandler()` devuelve `INTERNAL_SERVER_ERROR` y un `requestId` sin detalle interno. Falta reemplazar gradualmente los `catch` de Commerce por errores/códigos controlados.

### 4. Health / readiness

`GET /api/health` devuelve `status: ok`, versión y tipo de almacenamiento, pero no comprueba que la persistencia esté preparada para operar.

**Corrección pendiente:** mantener `/api/health` como liveness y agregar `/api/readiness`, verificando de forma segura que la base persistente esté cargada y que su archivo/directorio sean accesibles; responder `503` cuando no esté lista.

### 5. Trust proxy

El `server.ts` actual sí contiene `app.set('trust proxy', 1)`. Esto debe considerarse una configuración de despliegue, no una constante universal: confiar en un salto cuando la aplicación recibe tráfico directamente o detrás de una cadena distinta puede alterar `req.ip` y los límites de rate limiting.

**Corrección pendiente:** parametrizarlo mediante `TRUST_PROXY_HOPS`, aceptando únicamente enteros no negativos y usando `0` como valor seguro por defecto cuando no exista configuración.

### 6. Graceful shutdown

No se observan handlers explícitos de `SIGTERM`/`SIGINT`. El proceso inicia con `app.listen(...)` sin una estrategia de cierre ordenado.

**Corrección pendiente:** conservar la referencia al `http.Server`, detener la aceptación de nuevas conexiones y cerrar el proceso de forma controlada ante `SIGTERM`/`SIGINT`.

### 7. Backups: v2 creada, todavía no integrada al API

`server/ops/backup.ts` ya implementa Backup v2: snapshot después de `saveDatabaseSync()`, manifiesto con SHA-256/tamaño, validación de integridad, validación básica del esquema y rollback previo a restore. La sustitución de archivo fue ajustada para evitar el fallo de `rename` sobre el archivo existente en Windows.

El endpoint existente `/api/admin/backup` continúa usando `db.createBackup()`. Por tanto, **Backup v2 todavía no está operativo desde HTTP**. Falta integrar creación/listado/restauración con autorización `SUPER_ADMIN`, errores controlados y auditoría de estas operaciones.

### 8. Protección HTTP reusable preparada, pero no montada

`server/ops/http-security.ts` contiene:

- `X-Request-Id` seguro y correlacionable.
- CORS mediante allowlist `CORS_ALLOWED_ORIGINS`.
- rechazo de preflight no autorizado.
- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy`.
- `X-Powered-By` deshabilitado.
- error handler genérico con `INTERNAL_SERVER_ERROR` y `requestId`.

`tests/http_security.test.ts` cubre el módulo reusable y quedó incorporado al script de tests.

**Importante:** esta capa no está montada en `createUbikaApp()`. No se considera una corrección de producción cerrada hasta integrarla y validar el comportamiento real del servidor.

### 9. CSP actual demasiado permisiva

El middleware actual permite `http:`, `https:`, `unsafe-inline`, `unsafe-eval`, `data:`, `blob:` y `frame-ancestors *` en la política CSP.

**Riesgo:** la política pierde buena parte de su valor como defensa en profundidad frente a XSS, carga de recursos no deseados y framing no autorizado.

**Corrección pendiente:** definir una CSP por entorno, con orígenes explícitos para producción y una excepción documentada únicamente para el preview que realmente lo necesite.

## Verificación

Los tests/build/lint/typecheck están autorizados y deben ejecutarse cuando el entorno permita ejecución. En esta sesión el contenedor local no pudo clonar GitHub por resolución de red, por lo que no se debe afirmar que la batería haya sido ejecutada localmente.

Los módulos preparados se han revisado estáticamente en `main`, pero eso no sustituye la ejecución real de la suite sobre el estado final integrado.

## Restricción de implementación de `server.ts`

No se modificará `server.ts` mediante una reconstrucción parcial. El archivo es grande y la herramienta de actualización exige reemplazo completo. La integración de los módulos preparados debe hacerse sólo cuando se disponga del contenido íntegro verificado o de un mecanismo de edición segura.

## Próxima secuencia

1. Integrar `http-security.ts` en `createUbikaApp()` y retirar el CORS/perímetro duplicado.
2. Parametrizar `trust proxy` con configuración validada.
3. Reemplazar los `catch` de Commerce que exponen `err.message` por errores/códigos controlados.
4. Separar liveness/readiness.
5. Integrar graceful shutdown.
6. Integrar Backup v2 en rutas administrativas y deprecar el mecanismo legado.
7. Revisar CSP y hacerla dependiente del entorno.
8. Ejecutar typecheck/lint y la batería completa de tests.
9. Ejecutar build de producción.
10. Revisar el artefacto final y actualizar este documento con resultados reales.
