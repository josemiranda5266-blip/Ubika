# UBIKA — Estado de ejecución del hardening

Fecha: 2026-09-06

## Regla de ejecución

Las correcciones se ejecutan por fases. No se ejecutan `test`, `lint`, `typecheck` ni `build` hasta terminar todas las correcciones de código previstas y llegar a la verificación final.

## Fase 0 — Control y baseline

- Auditoría y roadmap registrados.
- Se conserva un historial de commits por corrección.

## Fase 1 — Perímetro

### Confirmado

- Se detectó que `server.ts` todavía contiene CORS wildcard (`Access-Control-Allow-Origin: *`), `trust proxy` fijo y una CSP excesivamente permisiva.
- La automatización temporal creada para modificar `server.ts` fue retirada porque no es aceptable depender de workflows auto-modificables para cambios de producción.
- También se retiró el workflow histórico `finalize-hito1.yml`, que podía ejecutar validaciones y modificaciones fuera del flujo actual.

### Pendiente

- Aplicar directamente en `server.ts` el allowlist de CORS, `trust proxy` explícito por entorno y CSP de producción estricta.
- Revisar y endurecer límites del parser HTTP y política de archivos.

## Fase 2 — Identidad y autorización

### Confirmado

- JWT exige secreto de al menos 32 caracteres al iniciar.
- La autenticación revalida existencia/estado del usuario y obtiene rol/tenant persistentes.
- El rate limiter fue endurecido.
- Se mantienen controles de tenant en las operaciones de comercio auditadas.

## Fase 3/4 — Persistencia y finanzas

### Corrección aplicada

`server/legal/refunds.ts` ahora:

- valida importes finitos, positivos y no superiores al total;
- evita superar el saldo reintegrable acumulando reintegros completados y operaciones manuales pendientes;
- registra cada reintegro con ID criptográficamente aleatorio;
- evita sobreacreditar crédito interno mediante reintegros secuenciales;
- marca Mercado Pago como completado solamente después de una respuesta exitosa del proveedor;
- representa reintegros manuales como `PENDING_MANUAL` en lugar de tratarlos como liquidación automática.

### Pendiente

- Migrar persistencia JSON a almacenamiento transaccional para resolver carreras entre múltiples instancias.
- Implementar idempotencia fuerte y transacciones atómicas para dinero, stock y cambios de estado.

## Fase 5 — Food/Logística

- La máquina de estados de Food fue revisada estáticamente: `READY` solo puede pasar a `ASSIGNED`, y `ASSIGNED` a `IN_TRANSIT`; no se permite salto directo `ASSIGNED -> DELIVERED`.
- Falta completar la auditoría de todas las transiciones de Food y Logística, incluidos roles, tenant y concurrencia.

## Fase 6 — Privacidad/Legal

- La purga de coordenadas exactas al finalizar/cancelar una entrega y el registro de auditoría ya están presentes.
- Los reintegros legales quedan registrados como operaciones completadas o pendientes según el mecanismo real.
- Falta revisar retención, minimización y exposición de datos personales endpoint por endpoint.

## Fase 7 — Observabilidad/operación

Pendiente: logging estructurado, correlación de requests, health/readiness, manejo uniforme de errores y métricas de seguridad.

## Fase 8 — Verificación final

NO EJECUTADA todavía por diseño. Se realizará únicamente cuando finalicen las correcciones de las fases anteriores.
