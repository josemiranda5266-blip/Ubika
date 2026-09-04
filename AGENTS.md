# UBIKA — instrucciones para Codex

## Objetivo
UBIKA debe evolucionar hacia una aplicación funcional, segura, mantenible y publicable. Priorizar correcciones reales sobre explicaciones teóricas.

## Arquitectura actual
- Frontend: React 19 + Vite + TypeScript.
- Backend: Express + TypeScript (`server.ts`).
- Persistencia actual: módulo de base de datos local en `server/db` con archivo persistente JSON. Esto es válido para desarrollo/pruebas, pero NO debe considerarse solución final de producción multiinstancia.
- Módulo comercial: `server/commerce/`.
- Pruebas: `tests/`.
- CI: `.github/workflows/ci.yml`.

## Comandos obligatorios
Antes de considerar un cambio terminado, ejecutar cuando sea posible:
- `bun run lint`
- `bun run test`
- `bun run build`

Si existe `bun run verify`, preferirlo como puerta de validación integral.

## Reglas de seguridad
1. Nunca desactivar autenticación, autorización, aislamiento por tenant o validaciones para hacer pasar una prueba.
2. Toda ruta sensible debe validar identidad, rol y `companyId`/tenant correspondiente.
3. El servidor debe recalcular precios, totales y permisos; nunca confiar en valores críticos enviados por el frontend.
4. No introducir secretos, contraseñas reales, tokens ni claves API en el repositorio.
5. Para IDs nuevos, preferir `crypto.randomUUID()` o `crypto.randomBytes()` frente a `Date.now()` + `Math.random()`.
6. Las cargas de archivos deben validarse por tipo/tamaño y, cuando corresponda, por contenido real (magic bytes), no solo por MIME declarado.
7. Evitar traversal de rutas y acceso a recursos de otro tenant.
8. No aumentar límites de payload ni relajar CORS solo para evitar errores.

## Reglas de cambios
- Mantener compatibilidad con el código existente salvo que haya una razón técnica clara para cambiar una API.
- Hacer cambios pequeños, verificables y reversibles.
- No modificar fixtures de producción para solucionar problemas exclusivos de tests; aislar reparaciones de fixtures en `tests/`.
- No eliminar pruebas para hacer pasar CI.
- Después de modificar código, revisar los archivos afectados y ejecutar las pruebas relevantes.
- Si una solución temporal deja una deuda técnica, documentarla claramente.

## Prioridades de producción
Dar prioridad a:
1. Seguridad y aislamiento multi-tenant.
2. Integridad de pagos, stock, caja e idempotencia.
3. Persistencia fiable y transaccional.
4. Validación y seguridad de uploads.
5. Rate limiting y headers/CORS de producción.
6. Observabilidad, auditoría y manejo consistente de errores.
7. CI/CD reproducible y configuración de despliegue.
8. UX y rendimiento sin sacrificar seguridad.

## Estado conocido
Hay áreas que requieren revisión antes de declarar UBIKA lista para producción:
- Persistencia JSON y locks en memoria no son adecuados para despliegue multiinstancia.
- Revisar IDs heredados que usan `Date.now()`/`Math.random()`.
- Revisar upload de imágenes, límites de JSON y exposición pública de `/uploads`.
- Revisar rate limiting, CORS y headers de seguridad.
- Asegurar que CI use la misma puerta de validación que el desarrollo local.

## Criterio de finalización
No declarar UBIKA "lista para publicar" solamente porque compile. Debe compilar, pasar las pruebas relevantes, mantener aislamiento por tenant, proteger rutas sensibles, gestionar errores correctamente y tener identificadas explícitamente las dependencias de infraestructura que todavía impidan producción real.

<!-- [finalize-hito1] controlled security hardening trigger -->
