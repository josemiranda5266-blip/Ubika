# UBIKA — Fase 7: datos sensibles y exposición de API

Fecha: 2026-09-06
Rama: main

## Alcance

Auditoría estática de logs, respuestas HTTP y rutas sensibles, con foco en PII, credenciales, payloads de proveedores de pago, coordenadas y aislamiento multi-tenant.

## Corrección aplicada

### Mercado Pago — payloads de proveedor

`server/commerce/payments.ts` ya no conserva el payload arbitrario devuelto por Mercado Pago. Se agregó `sanitizeProviderResponse()` y se limita la persistencia a campos operativos explícitamente permitidos: estado, detalle de estado, ID externo, método de pago, importe y referencia externa.

Los errores del proveedor ya no se devuelven mediante `String(err)`; se reemplazan por códigos controlados `PAYMENT_PROVIDER_UNAVAILABLE` y `REFUND_PROVIDER_UNAVAILABLE`.

Commit de la corrección: `f0e7ffc9d8d764639f7cde82855529ff2d8fd91c`.

## Hallazgos verificados

### 1. Solicitudes de desistimiento

La ruta pública de consulta exige coincidencia por email o documento antes de devolver el estado. La respuesta pública contiene únicamente información necesaria para el seguimiento: ID, tipo, estado, fechas, mensaje de respuesta, importe/método de reembolso y datos de excepción legal. No devuelve email, teléfono, documento ni dirección.

La ruta autenticada de procesamiento verifica `companyId`, salvo SUPER_ADMIN.

### 2. Listado de usuarios

`GET /api/users` exige autenticación y rol `SUPER_ADMIN` o `COMPANY_ADMIN`. El resultado elimina explícitamente `passwordHash` antes de responder. El SUPER_ADMIN puede consultar una empresa específica mediante `companyId`; el COMPANY_ADMIN queda limitado a su propia empresa.

### 3. Entregas

Las rutas de aceptación/rechazo verifican primero pertenencia de la entrega a la empresa del usuario y, para DRIVER, además comprueban `driverId`. Esto reduce el riesgo de acceso cruzado entre tenants y entre repartidores.

### 4. Coordenadas

Las coordenadas de destinatario se utilizan en flujos de seguimiento y mapas. El diseño actual contempla limpiar `recipientLocation` al expirar/cancelar/purgar la sesión. No debe considerarse un dato público general: futuras rutas nuevas que devuelvan entregas deben aplicar el mismo control de tenant/rol.

### 5. Logs

La búsqueda de `console.log/error` no encontró una evidencia actual de logging sistemático de tokens, contraseñas o payloads completos de autenticación. Los logs de email ya fueron endurecidos previamente para no imprimir destinatarios. Los errores de proveedor de pagos fueron endurecidos en el commit indicado arriba.

## Riesgos pendientes

1. `server.ts` sigue siendo un archivo monolítico y contiene numerosas respuestas directas de objetos de dominio. Cada nuevo endpoint debe aplicar un DTO/serializer cuando el objeto contenga PII o coordenadas.
2. `db.getSaleById()` sigue existiendo como acceso sin tenant; aunque algunos callers ya utilizan variantes scoped, debe auditarse cada uso antes de producción.
3. CORS `*` y `trust proxy = 1` siguen pendientes de corrección.
4. Falta correlation/request ID y una política centralizada de logging estructurado/redacción.
5. Backup/restore y almacenamiento de PII requieren todavía endurecimiento operativo.

## Regla de cierre

No ejecutar tests, lint, typecheck ni build todavía. La verificación automatizada queda reservada para la Fase 8, después de terminar las correcciones de implementación pendientes.
