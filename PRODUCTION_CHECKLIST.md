# UBIKA — Checklist de producción

## Antes de publicar

- [ ] Configurar `JWT_SECRET` con un valor aleatorio de al menos 32 caracteres.
- [ ] Configurar `INITIAL_ADMIN_PASSWORD` con una contraseña fuerte y única.
- [ ] Configurar `APP_URL` con HTTPS y el dominio real.
- [ ] Configurar `EMAIL_PROVIDER=sendgrid` y `SENDGRID_API_KEY`, o implementar un transporte SMTP real.
- [ ] No usar `console` ni `mock` como proveedor de correo en producción.
- [ ] Configurar `MERCADO_PAGO_ACCESS_TOKEN` solo si se habilita el cobro online.
- [ ] No considerar la facturación ARCA habilitada hasta integrar WSFE real y credenciales de producción.
- [ ] Confirmar que `data/ubika_persistent_db.json` y credenciales no estén versionados.
- [ ] Configurar HTTPS delante de Express.
- [ ] Configurar backups externos y recuperación probada; los backups locales no sustituyen una copia fuera del servidor.
- [ ] Configurar monitoreo, logs y alertas.
- [ ] Usar una base de datos transaccional antes de escalar a múltiples instancias.
- [ ] Usar un rate limiter compartido (por ejemplo Redis) si se despliega en múltiples instancias.

## Seguridad

- El frontend actualmente conserva el JWT en `localStorage`. Para un despliegue con requisitos de seguridad altos, migrar a sesión mediante cookie `HttpOnly`, `Secure` y `SameSite`.
- Mantener la validación de permisos por `companyId` en el servidor; nunca confiar en el `companyId` enviado por el navegador.
- Revisar periódicamente los permisos de cada endpoint.
- No exponer tokens de invitación o recuperación fuera de entornos de prueba.

## Datos y escalabilidad

La persistencia actual utiliza un archivo JSON en disco. Es adecuada para un MVP o instalación de baja concurrencia, pero no debe considerarse una solución multi-instancia. Para crecimiento real, migrar a PostgreSQL (o equivalente transaccional) y mover archivos subidos a almacenamiento de objetos.

## Verificación final

```bash
npm install
npm run lint
npm test
npm run build
NODE_ENV=production npm start
```

Comprobar después del despliegue:

- `GET /api/health` responde correctamente.
- Login, invitaciones y recuperación funcionan.
- Un usuario de una empresa no puede leer ni modificar datos de otra empresa.
- Las ubicaciones del destinatario se purgan al finalizar/cancelar el envío.
- Las credenciales reales nunca aparecen en logs ni en el repositorio.
