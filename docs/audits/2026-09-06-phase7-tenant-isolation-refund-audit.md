# UBIKA — Auditoría Fase 7: aislamiento multi-tenant en reembolsos

Fecha: 2026-09-06

## Estado
ABIERTO — hallazgo crítico pendiente de corrección segura.

## Hallazgo
`server/legal/refunds.ts` resuelve una venta mediante `CommerceRepository.getSaleById(saleId)` sin `companyId`. El repositorio también expone `getSaleByIdForCompany(id, companyId)`, que sí valida pertenencia del tenant.

La ruta legal que invoca `processRefund()` primero valida que la solicitud de desistimiento pertenezca a la empresa autenticada, pero el motor de reembolso vuelve a resolver la venta únicamente por ID. Por diseño, un `saleId` perteneciente a otra empresa podría ser alcanzado si un registro legal autorizado contiene o recibe ese ID.

El mismo módulo resuelve pedidos Food con `db.getFoodOrderById(saleId)` sin filtro explícito de empresa.

## Evidencia
- `server/legal/refunds.ts`: `CommerceRepository.getSaleById(saleId)`.
- `server/legal/refunds.ts`: `db.getFoodOrderById(saleId)`.
- `server/commerce/repository.ts`: existe `getSaleByIdForCompany(id, companyId)` y valida `sale.companyId === companyId`.
- `server.ts`: `/api/legal/withdrawal-process/:withdrawalId` valida `request.companyId` contra `req.user.companyId` antes de llamar al reembolso.

## Corrección requerida
El contexto de tenant debe viajar explícitamente hasta `processRefund()` y ambas búsquedas deben ser tenant-scoped. No se debe intentar resolver el tenant únicamente desde `saleId`.

Para Commerce: usar `getSaleByIdForCompany(saleId, companyId)`.

Para Food: resolver únicamente pedidos cuyo `companyId` coincida con el tenant autorizado.

El cambio debe incluir el caller de `server.ts` y `server/legal/refunds.ts` de forma coordinada.

## Riesgo
ALTO. Es un punto de control financiero y multi-tenant. No se considera cerrado hasta modificar ambos lados y verificar los usos.

## Verificación
No se ejecutaron tests/build/lint/typecheck, siguiendo la política del proyecto de terminar primero todas las correcciones de implementación.
