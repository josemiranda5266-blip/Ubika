# UBIKA — Auditoría Fase 7: Operación y perímetro

Fecha: 2026-09-06  
Estado: implementación pendiente en `server.ts`; no se ejecutaron tests/build/lint/typecheck por decisión de proceso.

## Hallazgos verificados

### 1. `trust proxy` está hardcodeado

`createUbikaApp()` usa `app.set('trust proxy', 1)`. Esto hace que Express confíe siempre en un salto de proxy, mientras `.env.example` documenta `TRUST_PROXY_HOPS=0` como valor por defecto.

**Riesgo:** `req.ip`, rate limiting y auditoría de red pueden depender de una cadena de proxies distinta a la real.

**Corrección prevista:** parsear `TRUST_PROXY_HOPS` al inicio, aceptar solamente entero no negativo y usar `0` por defecto. No aceptar valores inválidos silenciosamente.

### 2. CORS permite cualquier origen

El middleware actual responde `Access-Control-Allow-Origin: *`.

**Riesgo:** cualquier origen web puede realizar solicitudes cross-origin al backend. Aunque las rutas autenticadas requieren Bearer, el wildcard amplía innecesariamente la superficie y dificulta aplicar una política de origen controlada.

**Corrección prevista:** usar `CORS_ALLOWED_ORIGINS` como allowlist. Para requests con `Origin`, devolver el origen únicamente si pertenece a la allowlist; añadir `Vary: Origin`. Para ausencia de `Origin`, mantener compatibilidad con clientes no-browser. Preflight debe rechazar orígenes no autorizados en vez de responder indiscriminadamente 204.

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

## Restricción de implementación

No se modificará `server.ts` mediante una reconstrucción parcial. El archivo es grande y la herramienta de actualización requiere reemplazo completo; hacerlo sin disponer del contenido íntegro verificado podría truncarlo accidentalmente.

Por ello, esta fase queda registrada como **auditada y pendiente de integración segura** hasta disponer de un mecanismo de edición por parche o del archivo completo en un entorno de trabajo local.

## Próxima secuencia

1. Integrar perímetro (`trust proxy` + CORS) sin wildcard.
2. Añadir request/correlation ID.
3. Separar liveness/readiness.
4. Añadir error handler global y graceful shutdown.
5. Revisar backups/restauración y límites operativos.
6. Revisar logs finales en busca de PII/secrets.
7. Sólo después de cerrar las correcciones: ejecutar typecheck/lint, tests y build de producción.
