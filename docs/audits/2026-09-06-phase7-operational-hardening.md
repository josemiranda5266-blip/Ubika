# UBIKA — Auditoría Fase 7: Operación y perímetro

Fecha: 2026-09-06  
Estado: correcciones en curso; se habilitó la ejecución de tests/build/lint/typecheck cuando sea necesario.

## Hallazgos verificados

### 1. `trust proxy` está hardcodeado

`createUbikaApp()` usa `app.set('trust proxy', 1)`. Esto hace que Express confíe siempre en un salto de proxy, mientras `.env.example` documenta `TRUST_PROXY_HOPS=0` como valor por defecto.

**Riesgo:** `req.ip`, rate limiting y auditoría de red pueden depender de una cadena de proxies distinta a la real.

**Corrección prevista:** parsear `TRUST_PROXY_HOPS` al inicio, aceptar solamente entero no negativo y usar `0` por defecto. No aceptar valores inválidos silenciosamente.

### 2. CORS permite cualquier origen

El middleware actual responde `Access-Control-Allow-Origin: *`.

**Riesgo:** cualquier origen web puede realizar solicitudes cross-origin al backend. Aunque las rutas autenticadas requieren Bearer, el wildcard amplía innecesariamente la superficie y dificulta aplicar una política de origen controlada.

**Corrección prevista:** usar `CORS_ALLOWED_ORIGINS` como allowlist. Para requests con `Origin`, devolver el origen únicamente si pertenece a la allowlist; añadir `Vary: Origin`. Preflight debe rechazar orígenes no autorizados en vez de responder indiscriminadamente 204.

**Compatibilidad AI Studio:** no se debe conservar `*` como solución permanente. Si el preview necesita un origen adicional, debe declararse explícitamente mediante configuración de entorno.

### 3. Health y readiness están mezclados

`/health` y `/api/health` devuelven `status: ok` sin comprobar que el almacenamiento persistente esté realmente operativo.

**Riesgo:** un proceso puede estar vivo pero incapaz de leer/escribir la base JSON; un orquestador podría enviar tráfico a una instancia no preparada.

**Corrección prevista:** mantener `/health` como liveness y agregar `/readiness` y `/api/readiness`. Readiness debe verificar que la base persistente haya sido cargada y que el directorio/archivo de datos sea accesible; ante fallo responder 503 sin exponer rutas internas ni secretos.

### 4. Falta de correlation/request ID explícito

Existe `AsyncLocalStorage<Request>` para auditoría, pero no se observó un identificador de correlación generado/propagado por request.

**Corrección prevista:** middleware que acepte un request ID externo sólo si cumple formato/longitud segura o genere uno con `crypto.randomUUID()`. Exponerlo como `X-Request-Id` y reutilizarlo en logs/auditoría.

### 5. Manejo global de errores y apagado ordenado

La aplicación necesita un error handler final consistente y un shutdown controlado para `SIGTERM`/`SIGINT`.

**Corrección prevista:** error handler que no devuelva stack traces en producción y cierre ordenadamente el servidor, evitando aceptar nuevas conexiones antes de terminar.

### 6. Backups: v2 creada, todavía no integrada al API

Se creó `server/ops/backup.ts` como mecanismo de backup/restore v2. Ahora `createBackupV2()` fuerza `saveDatabaseSync()` antes de tomar el snapshot y `restoreBackupV2()` valida tanto SHA-256 como el tamaño declarado en el manifiesto. El archivo continúa separado de `server.ts` y todavía no reemplaza el endpoint administrativo legado.

El endpoint existente `/api/admin/backup` continúa usando `db.createBackup()`, por lo que **Backup v2 aún no está operativo desde HTTP**. No debe considerarse cerrada esta parte hasta integrar listado/creación/restauración con autorización `SUPER_ADMIN` y manejo de errores controlado.

### 7. Exposición de errores internos

La auditoría encontró al menos un `catch` en `server.ts` que responde directamente `err.message`. Los clientes frontend también muestran `err.message` en varias pantallas, por lo que el backend debe ser la frontera de seguridad y devolver únicamente mensajes/códigos controlados.

**Corrección prevista:** eliminar respuestas directas de excepciones internas, introducir un mapa de errores de dominio/controlados y añadir un error handler final que genere respuesta genérica para errores no previstos, incluyendo `X-Request-Id`.

## Verificación

Los tests/build/lint/typecheck ya no están bloqueados por la política de proceso. Se ejecutarán después de cerrar un conjunto coherente de correcciones o cuando una modificación requiera validación inmediata. Si el entorno de ejecución local no dispone del repositorio montado, la limitación se documentará y se continuará con verificación estática mediante GitHub.

## Restricción de implementación de `server.ts`

No se modificará `server.ts` mediante una reconstrucción parcial. El archivo es grande y la herramienta de actualización requiere reemplazo completo; hacerlo sin disponer del contenido íntegro verificado podría truncarlo accidentalmente.

La integración de perímetro, errores, readiness, request ID, shutdown y Backup v2 se mantiene pendiente hasta disponer de un mecanismo seguro para reemplazar el archivo completo o de un entorno local editable.

## Próxima secuencia

1. Integrar Backup v2 en rutas administrativas y retirar/deprecate el mecanismo legado.
2. Integrar manejo global de errores y request ID en `server.ts` mediante una actualización completa verificada.
3. Integrar `TRUST_PROXY_HOPS` y CORS allowlist.
4. Separar liveness/readiness.
5. Añadir graceful shutdown.
6. Ejecutar typecheck/lint y la batería de tests.
7. Ejecutar build de producción y revisar el artefacto final.
8. Actualizar este documento con resultados reales y cerrar Fase 7 sólo si todos los checks pasan.
