# UBIKA — Phase 7: Commerce Tenant Isolation Audit

**Fecha:** 2026-09-06  
**Rama:** `main`

## Alcance

Auditoría de los accesos de Commerce a categorías, productos, clientes, stock, cajas, ventas y facturación, con foco en aislamiento multi-tenant y accesos directos al repositorio.

## Hallazgos verificados

### Categorías

- Lecturas de listado usan `getCategoriesByCompany(companyId)`.
- Actualización y eliminación pasan primero por `getCategoryByIdForCompany(id, companyId)`.
- No se detectaron consumidores externos del mutador `updateCategory` sin esa comprobación previa.

### Productos

- Listado y lectura individual están limitados por `companyId`.
- `updateProduct` y `deleteProduct` verifican pertenencia al tenant antes de mutar.
- `adjustStock` obtiene el producto mediante `getProductByIdForCompany` y crea el movimiento con el mismo `companyId`.
- La búsqueda de consumidores de `CommerceRepository.updateProduct` encontró únicamente los usos controlados del servicio de Commerce.

### Clientes

- Listado y lectura individual están limitados por `companyId`.
- `updateCustomer` y `deleteCustomer` verifican pertenencia antes de mutar.
- El servicio aplica whitelist de campos para evitar mass assignment de `id`, `companyId` y otros campos estructurales.

### Stock

- Los listados usan `getStockMovementsByCompany`.
- Las operaciones de ajuste validan producto + tenant antes de modificar stock.
- Existe lock de producto por proceso para reducir carreras dentro de una única instancia.
- **Limitación pendiente:** el lock es en memoria y no protege múltiples procesos/containers.

### Cajas

- Listados usan `getCashSessionsByCompany`.
- La caja actual se resuelve por `companyId` y opcionalmente `userId`.
- El cierre usa `getCashSessionByIdForCompany` y además valida el operador, salvo roles administrativos autorizados.
- Las ventas consideradas para el cierre se obtienen mediante `getSalesByCompany(companyId)`.

### Ventas / devoluciones

- Las lecturas normales usan `getSaleByIdForCompany`.
- El motor de devoluciones fue endurecido previamente para resolver el tenant desde el registro legal de retiro y fallar cerrado ante ausencia o ambigüedad.
- La devolución de saldo de tienda valida simultáneamente venta + cliente + companyId.

### Facturación

- Las facturas se consultan mediante `getInvoicesByCompany(companyId)`.
- La creación recibe una entidad ya asociada al tenant desde el servicio.

## Accesos directos revisados

Las búsquedas de consumidores de:

- `CommerceRepository.updateCustomer`
- `CommerceRepository.deleteCustomer`
- `CommerceRepository.updateProduct`
- `CommerceRepository.deleteProduct`
- `CommerceRepository.getSaleById`
- `CommerceRepository.getCustomerById`
- `CommerceRepository.getProductById`
- `CommerceRepository.getCategoryById`

no revelaron rutas de negocio adicionales que eviten las comprobaciones tenant-scoped del servicio. Los getters por ID sin tenant permanecen como primitivas internas del repositorio y no deben exponerse directamente a handlers HTTP.

## Riesgos pendientes

1. El repositorio todavía permite mutadores por ID sin `companyId` como contrato. La protección actual depende de que los consumidores externos pasen por el servicio.
2. La persistencia JSON/in-memory no ofrece aislamiento transaccional entre múltiples instancias.
3. Los locks de idempotencia y stock son únicamente single-instance.
4. Debe mantenerse la regla de que nuevos endpoints Commerce reciban el `companyId` desde la identidad autenticada, nunca desde un campo controlado por el cliente.

## Estado

**Tenant isolation en la capa de servicio: VERIFICADO.**  
**Defensa adicional a nivel de repositorio: PENDIENTE.**  
**Multi-instancia transaccional: PENDIENTE de migración de persistencia.

## Próximo bloque

Continuar con endurecimiento de perímetro y operación: `trust proxy` configurable, CORS allowlist compatible con el preview de AI Studio, request/correlation ID, readiness, error handler global y graceful shutdown. Las verificaciones de release (lint/tests/build) se mantienen deliberadamente postergadas hasta cerrar todas las correcciones de implementación.
