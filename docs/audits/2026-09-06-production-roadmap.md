# UBIKA — Plan de mejora y endurecimiento para producción

Fecha: 2026-09-06
Rama: `main`

## Objetivo
Llevar UBIKA desde el estado funcional actual a una arquitectura operable en producción, con seguridad multi-tenant, consistencia financiera, trazabilidad, persistencia fiable y despliegue reproducible.

## Fase 0 — Baseline y control de cambios
- Mantener auditorías técnicas dentro de `docs/audits/`.
- Separar explícitamente cambios funcionales, seguridad y migraciones.
- No ejecutar tests/build durante esta campaña; la verificación queda para la fase final solicitada.

## Fase 1 — Seguridad de perímetro
- Sustituir CORS `*` por allowlist configurable por entorno.
- Revisar `trust proxy` para que solo se habilite según configuración explícita.
- Endurecer CSP y retirar directivas innecesarias como `unsafe-eval` en producción.
- Mantener headers de seguridad y `Cache-Control` para APIs.
- Validar uploads por firma/magic bytes además del MIME declarado.

## Fase 2 — Identidad, autorización y sesión
- Consolidar autenticación y autorización en `server/auth.ts`.
- Evitar IDs predecibles en usuarios, empresas, ventas y recursos.
- Revisar expiración/revocación de sesiones y cambios de rol.
- Aplicar aislamiento de tenant a cada endpoint que acepte IDs externos.
- Completar aceptación de invitaciones como operación de un solo uso.

## Fase 3 — Persistencia y concurrencia
- Eliminar locks exclusivamente en memoria para operaciones críticas.
- Introducir una capa transaccional única para mutaciones de negocio.
- Diseñar migración de JSON persistente hacia una base de datos transaccional antes de escalar horizontalmente.
- Garantizar idempotencia en pagos, ventas, reembolsos, caja y órdenes.

## Fase 4 — Finanzas y pagos
- Impedir sobre-reembolsos mediante acumulación de reembolsos por venta/orden.
- Separar estado solicitado, procesado y liquidado.
- Hacer que créditos internos y movimientos de caja sean atómicos.
- Persistir referencias externas de Mercado Pago y reconciliarlas mediante webhooks.
- Nunca presentar como liquidado un reintegro manual aún pendiente.

## Fase 5 — Food / logística
- Consolidar las máquinas de estado de órdenes y entregas.
- Verificar transiciones exclusivamente mediante funciones de dominio.
- Asegurar tenant isolation para tiendas, productos, pedidos, repartidores y archivos.
- Eliminar datos de geolocalización conforme a retención y auditar la purga.

## Fase 6 — Privacidad y derechos del consumidor
- Mantener exportación y desactivación de cuenta sin exponer hashes ni secretos.
- Asegurar trazabilidad de solicitudes legales.
- Separar anonimización de conservación legal.
- Hacer idempotentes los procesos de desistimiento/reembolso.

## Fase 7 — Observabilidad y operación
- Logs estructurados sin secretos ni datos personales innecesarios.
- Correlation/request IDs.
- Health/readiness separados.
- Métricas de errores, pagos, colas y latencia.
- Alertas para fallos de liquidación y estados atascados.

## Fase 8 — Calidad y release
- Recién después de terminar las correcciones: ejecutar la batería completa de tests, lint, typecheck y build.
- Revisar migraciones y rollback.
- Auditoría final de secretos, dependencias, CORS, CSP, uploads, RBAC y tenant isolation.
- Release candidate y checklist de producción.

## Orden de ejecución
`Fase 1 → Fase 2 → Fase 3 → Fase 4 → Fase 5 → Fase 6 → Fase 7 → Fase 8`.

Las fases 1–7 se corrigen primero. La fase 8 es exclusivamente de verificación final y no se ejecuta durante esta campaña.
