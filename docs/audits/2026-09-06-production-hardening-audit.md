# UBIKA — Auditoría de hardening y correcciones

Fecha: 2026-09-06
Rama auditada: `main`
HEAD inicial: `7bd84f121cbb31fb80be0239105f76caa5dd6a61`

## Correcciones aplicadas

### 1. Autenticación y rate limiting — P1

Archivo: `server/auth.ts`

- Se endureció el parsing del Bearer token.
- Se mantiene la revalidación del usuario contra persistencia en cada request autenticado.
- El rate limiter ya no toma directamente `X-Forwarded-For`; usa únicamente `req.ip`, evitando que un cliente pueda rotar arbitrariamente la clave del límite cuando el proxy no está configurado explícitamente como trusted proxy.
- Se agregó limpieza periódica de entradas expiradas del mapa en memoria para evitar crecimiento indefinido.
- Se validan los parámetros del rate limiter al construir el middleware.

Commit: `f5801695615b523080fddf400345c4ccf9fd1357`

### 2. Reintegros — P1

Archivo: `server/legal/refunds.ts`

- Un `saleId`/order inexistente ya no devuelve éxito falso.
- Los importes de refund deben ser finitos, positivos y no superar el total original.
- Store credit exige cliente perteneciente al mismo tenant de la venta.
- Mercado Pago propaga correctamente el fallo del proveedor.
- Los reintegros manuales quedan explícitamente marcados como `requiresManualSettlement` en vez de presentarse como liquidación automática.

Commit: `66ad08d5c2921dd24bf06cb8698c07d1eaf76e8f`

## Hallazgos pendientes de corrección estructural

### P1 — CORS y payload global

`server.ts` configura headers CORS sin restringir `Access-Control-Allow-Origin` y usa `express.json({ limit: '10mb' })`, aunque el comentario de seguridad anterior indicaba un límite de 1 MB. Debe definirse una allowlist de origins mediante configuración y separar el límite normal de JSON del flujo específico de uploads.

### P1 — IDs heredados

`server.ts` todavía contiene varios identificadores basados en `Date.now()` y combinaciones de timestamp + `Math.random()`, incluyendo creación de empresas, usuarios, invitaciones y eventos. Deben migrarse a `crypto.randomUUID()` para eliminar colisiones bajo concurrencia.

### P1 — Uploads

La implementación actual usa Multer con límite de 5 MB y filtro MIME para imágenes. Debe completarse la validación por magic bytes antes de persistir el archivo, manteniendo aislamiento por tenant y evitando confiar únicamente en `Content-Type` declarado por el cliente.

### P1 — Persistencia

La arquitectura continúa usando JSON persistente y locks en memoria. Es aceptable como etapa de desarrollo, pero no es una base transaccional adecuada para producción multiinstancia. La migración a almacenamiento transaccional compartido sigue siendo requisito de infraestructura.

### P1 — Flujo de invitaciones

El endpoint `/api/users` crea invitaciones pero el código actual no llama al servicio de correo después de persistirlas. Esto puede dejar invitaciones creadas sin entrega al usuario final.

### P1 — Concurrencia de invitaciones

La aceptación de invitaciones realiza comprobación de `used`, actualización de la invitación y creación del usuario como operaciones separadas sobre persistencia JSON. En despliegues concurrentes debe existir una operación atómica que consuma el token una sola vez.

## Criterio de esta fase

No se ejecutaron tests, lint ni build durante esta auditoría, siguiendo la política de trabajo indicada para esta etapa. Las correcciones se hicieron mediante revisión estática del código y quedaron registradas en commits independientes.

## Próxima fase técnica

1. Hardening de `server.ts`: CORS, límites, IDs y rutas de invitaciones.
2. Validación binaria de uploads.
3. Revisión exhaustiva de aislamiento tenant en Food y Commerce.
4. Consolidación de errores HTTP y observabilidad.
5. Revisión de persistencia y límites de la arquitectura JSON antes de producción real.
