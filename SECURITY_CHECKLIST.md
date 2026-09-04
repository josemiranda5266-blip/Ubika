# 🔒 UBIKA — SECURITY CHECKLIST

Usa esta checklist para validar que cada cambio de seguridad está implementado correctamente.

## 1. Autenticación

- [ ] JWT firmados con RS256 en producción
- [ ] Expiration claims (`exp`, `iat`, `nbf`) validados
- [ ] Refresh tokens implementados (7 días)
- [ ] Access tokens de 1 hora
- [ ] Logout revoca tokens
- [ ] Tokens blacklist funcional
- [ ] No hay tokens en localStorage después de logout
- [ ] Password reset usa tokens temporales
- [ ] Reset tokens expiran en 24h
- [ ] Invitaciones expiran en 7 días

## 2. Validación de Entrada

- [ ] Email validado con regex + MX check en producción
- [ ] Teléfono validado con libphonenumber
- [ ] Contraseña con requisitos mínimos
- [ ] Coordenadas con -90/90, -180/180 y `Number.isFinite()`
- [ ] Precios como `Decimal`, no float
- [ ] IDs validados (no inyección NoSQL)
- [ ] Strings truncados a longitud máxima
- [ ] Archivos validados por MIME + extensión
- [ ] No se acepta `..` en paths

## 3. Multi-tenant

- [ ] Cada request valida `req.user.companyId`
- [ ] NUNCA confiar en `companyId` del cliente
- [ ] Empresa siempre obtenida del usuario autenticado
- [ ] Tests que verifican aislamiento:
  - `GET /api/drivers?companyId=OTHER` → 403
  - `PATCH /api/deliveries/OTHER_ID` → 403
  - `POST /api/food/orders` con otra empresa → 403
- [ ] SUPER_ADMIN tiene auditoría completa de accesos

## 4. Autorización

- [ ] Matriz de permisos documentada
- [ ] Middleware `requireRole()` en todos los endpoints
- [ ] Tests por cada rol + acción combinación
- [ ] SUPER_ADMIN bypass evaluado pero logueado
- [ ] Operadores sin permisos sobre otras empresas

## 5. Manejo de Secretos

- [ ] `.env.example` sin valores reales
- [ ] `JWT_SECRET` mínimo 32 caracteres
- [ ] `INITIAL_ADMIN_PASSWORD` cambiado en producción
- [ ] Credenciales de email/SMS en variables de entorno
- [ ] AWS keys rotadas regularmente
- [ ] No hay secretos en código fuente
- [ ] No hay secretos en logs
- [ ] `git-secrets` instalado en local

## 6. Errores y Logs

- [ ] Stack traces NO expuestos al cliente en producción
- [ ] Mensajes genéricos: "Credenciales inválidas", no "Usuario no existe"
- [ ] Logs incluyen request_id
- [ ] Logs NO incluyen passwords, tokens, datos personales
- [ ] Error messages seguros (no revelan arquitectura)
- [ ] Rate limit errors con `Retry-After`
- [ ] 404 idéntico para recurso no existe vs sin permisos

## 7. HTTPS y Headers

- [ ] HTTPS obligatorio en producción
- [ ] HSTS header: `max-age=31536000; includeSubDomains`
- [ ] CSP header: `default-src 'self'`
- [ ] X-Content-Type-Options: `nosniff`
- [ ] X-Frame-Options: `SAMEORIGIN`
- [ ] X-XSS-Protection: `1; mode=block`
- [ ] Referrer-Policy: `strict-origin-when-cross-origin`
- [ ] CORS origin whitelist (no `*`)
- [ ] No se acepta `Access-Control-Allow-Origin: *`

## 8. Rate Limiting

- [ ] Rate limit por IP: 1000 req/hora
- [ ] Rate limit por usuario: 100 req/hora (endpoints sensibles)
- [ ] Rate limit por email: 3 reset/hora
- [ ] Rate limit por login: 5 intentos/5 minutos
- [ ] Redis para rate limiting distribuido
- [ ] Retry-After header en 429
- [ ] IPs bloqueadas temporalmente después de N intentos

## 9. Archivos

- [ ] Upload en S3, no en disk
- [ ] Archivos renombrados con UUID
- [ ] MIME validado (magic bytes)
- [ ] Malware scan con ClamAV
- [ ] Máximo 5MB por archivo
- [ ] Signed URLs con expiración
- [ ] CDN caching
- [ ] No se permite directory traversal
- [ ] Acceso verificado por companyId

## 10. Base de Datos

- [ ] Migraciones versionadas
- [ ] FK constraints habilitadas
- [ ] Índices en campos de búsqueda
- [ ] Transacciones en operaciones críticas
- [ ] No hay N+1 queries
- [ ] Prepared statements (no SQL injection)
- [ ] Backups automatizados
- [ ] Backup test (restauración validada)
- [ ] Connection pool configurado
- [ ] Timeouts en queries largas

## 11. Privacidad

- [ ] Política de privacidad documentada
- [ ] Términos de servicio documentados
- [ ] Consentimiento explícito para GPS
- [ ] Datos purgados al completar entrega
- [ ] Coordenadas no almacenadas indefinidamente
- [ ] GDPR compliance (si aplica)
- [ ] Derecho al olvido implementado
- [ ] Exportación de datos del usuario

## 12. Testing de Seguridad

- [ ] SAST ejecutado (SonarQube/Snyk)
- [ ] Dependency check (npm audit)
- [ ] Manual penetration test
- [ ] SQL injection tests
- [ ] XSS tests
- [ ] CSRF tests
- [ ] Credential stuffing tests
- [ ] Multi-tenant isolation tests

## 13. Monitoreo

- [ ] Logs centralizados
- [ ] Alertas por errores 5xx
- [ ] Alertas por rate limit exceed
- [ ] Alertas por login failed
- [ ] Alertas por permission denied
- [ ] Alertas por anomalías (spike de requests)
- [ ] Dashboard de seguridad

## 14. Incidente Response

- [ ] Runbook de breach de credenciales
- [ ] Runbook de data exfiltration
- [ ] Proceso de revocación de tokens
- [ ] Notificación a usuarios
- [ ] Post-mortem después de incidente
- [ ] Automatización de bloqueos

---

**Documentar fecha de última revisión:** _____
**Responsable:** _____
