# UBIKA — Documentación Maestra Integral

> **Documento maestro del producto, arquitectura, funcionamiento, seguridad, distribución y roadmap de UBIKA.**
>
> Fuente auditada: repositorio `josemiranda5266-blip/Ubika`, rama `main`.
>
> Versión documental: 2026-09-10.

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [¿Qué es UBIKA?](#2-qué-es-ubika)
3. [Estructura funcional](#3-estructura-funcional)
4. [Público objetivo y nichos](#4-público-objetivo-y-nichos)
5. [Usuarios y roles](#5-usuarios-y-roles)
6. [Flujos de funcionamiento](#6-flujos-de-funcionamiento)
7. [Arquitectura técnica](#7-arquitectura-técnica)
8. [Seguridad y privacidad](#8-seguridad-y-privacidad)
9. [Cumplimiento legal](#9-cumplimiento-legal)
10. [Layout y UX](#10-layout-y-ux)
11. [Plataformas e instalación](#11-plataformas-e-instalación)
12. [Despliegue y producción](#12-despliegue-y-producción)
13. [Modelo de datos](#13-modelo-de-datos)
14. [Integraciones](#14-integraciones)
15. [Pruebas y calidad](#15-pruebas-y-calidad)
16. [Hallazgos de auditoría](#16-hallazgos-de-auditoría)
17. [Modelo de negocio](#17-modelo-de-negocio)
18. [Desarrollo de funciones](#18-desarrollo-de-funciones)
19. [Roadmap](#19-roadmap)
20. [Recomendaciones prioritarias](#20-recomendaciones-prioritarias)
21. [Distribución comercial](#21-distribución-comercial)
22. [Limitaciones de la auditoría](#22-limitaciones-de-la-auditoría)
23. [Evidencia técnica](#23-evidencia-técnica)
24. [Glosario](#24-glosario)
25. [Conclusión](#25-conclusión)

---

## 1. Resumen ejecutivo

UBIKA es una plataforma web full-stack orientada a empresas que necesitan coordinar entregas, repartos y operaciones de última milla. El repositorio actual amplía ese núcleo con UBIKA FOOD, UBIKA COMMERCE y controles de cumplimiento legal, además de una interfaz de cliente para seguimiento público mediante token.

La arquitectura combina React 19 + Vite en frontend con Express + TypeScript en backend, persistencia basada en archivos/JSON y módulos especializados de autenticación, comercio, gastronomía, legalidad y operaciones. El proyecto incorpora una batería extensa de pruebas y un workflow de CI que ejecuta typecheck, tests y build.

### Estado general

| Dimensión | Hallazgo |
|---|---|
| Producto | Plataforma operativa B2B/B2B2C para logística y negocios con reparto. |
| Experiencias | UBIKA CONTROL, UBIKA DRIVER, UBIKA CLIENT, UBIKA FOOD y UBIKA COMMERCE. |
| Frontend | React + Vite + Tailwind CSS + Lucide + Motion + Leaflet. |
| Backend | Node/Express + TypeScript. |
| Persistencia | Almacenamiento persistente JSON mediante capa `db`. |
| Seguridad | JWT, bcrypt, rate limiting, validaciones, auditoría y purga de coordenadas. |
| Operación | Dashboard, flota, conductores, entregas, historial, rutas y eventos. |
| Gastronomía | Catálogo, opciones, pedidos, delivery/pickup, pagos y tracking. |
| Comercio | Ventas con stock, caja, idempotencia, concurrencia y rollback según suite de pruebas. |

## 2. ¿Qué es UBIKA?

UBIKA puede entenderse como una plataforma operativa para transformar un negocio que hoy coordina pedidos y repartos por WhatsApp, llamadas, planillas o sistemas aislados en una operación centralizada.

### 2.1 Propuesta de valor

- Centralizar pedidos, entregas y conductores.
- Dar al cliente seguimiento web sin instalación.
- Compartir ubicación de forma controlada y temporal.
- Registrar eventos de la operación para trazabilidad.
- Extender la operación hacia gastronomía y comercio.
- Incorporar controles de privacidad y derechos del consumidor.

### 2.2 Problema que resuelve

El problema central es la coordinación de la última milla: quién debe retirar o entregar, dónde está, qué prioridad tiene la tarea, cuál es el estado, cuánto demora y qué ocurrió durante el proceso.

## 3. Estructura funcional

### 3.1 UBIKA CONTROL

Es el centro de operaciones de la empresa. El repositorio contiene componentes para dashboard, gestión de conductores, historial de entregas, mapa de flota, rutas, eventos de auditoría, usuarios y creación de tareas.

Funciones principales:

- Dashboard y métricas.
- Creación/asignación de tareas.
- Gestión de conductores.
- Mapa de flota.
- Historial de entregas.
- Historial de rutas.
- Eventos de auditoría.
- Gestión de usuarios.

### 3.2 UBIKA DRIVER

Experiencia orientada al repartidor. El modelo contempla estados disponible, en tarea, pausado, desconectado e inactivo, además de vehículo, ubicación, tarea activa y métricas.

Funciones:

- Recepción de tareas.
- Aceptación/rechazo.
- Inicio de recorrido.
- Actualización de ubicación.
- Distancia y ETA.
- Confirmación de llegada/entrega.
- Enlace de tracking para cliente.

### 3.3 UBIKA CLIENT

Experiencia pública para el destinatario mediante token. Permite visualizar información limitada de la entrega, estado y ubicación del conductor cuando corresponde.

Funciones:

- Seguimiento mediante URL/token.
- Estado de entrega.
- Datos controlados del conductor.
- Ubicación del conductor.
- Distancia.
- Caducidad de sesión.

### 3.4 UBIKA FOOD

Módulo gastronómico con locales, horarios, categorías, productos, imágenes, grupos de opciones, tarifas de envío, pedidos, delivery/pickup y métodos de pago modelados.

Funciones:

- Catálogo.
- Categorías y productos.
- Adicionales y opciones.
- Horarios y apertura.
- Tarifas de delivery.
- Pedidos.
- Delivery o retiro.
- Tracking.
- Transferencia, Mercado Pago y efectivo.
- Código seguro de pickup.

### 3.5 UBIKA COMMERCE

Módulo de comercio que amplía la plataforma más allá del delivery. La suite de pruebas muestra cobertura de aislamiento por empresa, RBAC, idempotencia, concurrencia, stock, caja, persistencia, rollback y fiscalidad.

## 4. Público objetivo y nichos

| Segmento | Necesidad | Encaje |
|---|---|---|
| Restaurantes | Pedidos + cocina + delivery | Muy alto |
| Rotiserías/comidas | Catálogo + delivery local | Muy alto |
| Farmacias | Entregas controladas | Alto |
| Supermercados/almacenes | Pedidos y reparto | Alto |
| Distribuidoras | Ruteo y flota | Alto |
| Cadeterías | Asignación y tracking | Muy alto |
| Servicios técnicos | Tareas en domicilio | Medio/alto |
| Comercios con flota | Control de repartidores | Muy alto |

### 4.1 Nicho recomendado para iniciar

La recomendación comercial es comenzar con empresas locales que tengan repartidores propios y sufran problemas de coordinación. Luego incorporar FOOD y COMMERCE como módulos de expansión.

## 5. Usuarios y roles

| Usuario | Función |
|---|---|
| Administrador de empresa | Configura empresa, usuarios y operación. |
| Operador/dispatcher | Crea, asigna y controla entregas. |
| Conductor/repartidor | Ejecuta la entrega y comparte ubicación. |
| Cliente/destinatario | Consulta el estado mediante tracking. |
| Operador gastronómico | Administra pedidos y preparación. |
| Personal de comercio | Opera ventas, stock y caja según permisos. |

La aplicación enruta la experiencia según el rol autenticado y contempla, entre otros, `DRIVER`, `KITCHEN` y `COMPANY_ADMIN`.

## 6. Flujos de funcionamiento

### 6.1 Flujo logístico principal

1. La empresa crea una tarea.
2. Se asigna un conductor.
3. El conductor acepta o rechaza.
4. Se inicia el recorrido.
5. Se calcula distancia y ETA.
6. Se comparte el enlace de tracking.
7. Se actualiza la ubicación.
8. Se registra llegada y entrega.
9. Al finalizar, se purgan coordenadas del destinatario según la lógica implementada.

### 6.2 Flujo gastronómico

1. Cliente consulta catálogo.
2. Selecciona productos y opciones.
3. Se calcula subtotal + envío.
4. Se crea el pedido.
5. Se confirma/prepara.
6. Se marca listo.
7. Retiro o delivery.
8. Conductor ejecuta entrega.
9. Pedido finaliza.

### 6.3 Flujo de seguimiento

La aplicación reconoce una ruta de tracking del tipo `#track/{token}`. El modelo `PublicSessionData` contempla estado, vencimiento, ubicación del conductor, distancia y autorización de ubicación.

## 7. Arquitectura técnica

### 7.1 Frontend

React 19 + Vite. `App.tsx` orquesta las experiencias. Tailwind CSS gestiona estilos; Lucide iconografía; Leaflet mapas; Motion animaciones.

### 7.2 Backend

Express + TypeScript. `server.ts` concentra rutas y lógica de autenticación, entregas, gastronomía, comercio, legalidad y operaciones.

### 7.3 Persistencia

La capa `server/db.ts` utiliza almacenamiento persistente JSON. Es simple para una primera etapa, pero es un punto importante de evolución para concurrencia y escalamiento.

### 7.4 Estructura del repositorio

| Ruta | Responsabilidad |
|---|---|
| `src/App.tsx` | Orquestación de experiencias y autenticación de UI. |
| `src/components/control` | Operación y administración logística. |
| `src/components/food` | Gastronomía. |
| `src/components/commerce` | Comercio. |
| `src/components/legal` | Interfaces legales. |
| `src/components/DriverApp.tsx` | Conductor. |
| `src/components/CustomerWebApp.tsx` | Cliente/tracking. |
| `src/types.ts` | Modelos de dominio. |
| `server.ts` | Servidor Express y endpoints. |
| `server/auth.ts` | Autenticación/autorización. |
| `server/db.ts` | Persistencia. |
| `server/commerce` | Lógica de comercio. |
| `server/legal` | Procesos legales. |
| `server/ops` | Operaciones/readiness/shutdown. |
| `tests` | Pruebas. |

## 8. Seguridad y privacidad

La orientación de seguridad del proyecto es una fortaleza, aunque aún hay controles de infraestructura que deben endurecerse antes de producción.

### 8.1 Controles implementados

- `JWT_SECRET` obligatorio y mínimo de 32 caracteres.
- `bcryptjs` para contraseñas.
- Rate limiting.
- Autenticación/autorización por roles.
- Auditoría con IP y User-Agent.
- Purga de coordenadas.
- Tokens de tracking.
- JSON limitado a 1 MB.
- Uploads de imágenes limitados a 5 MB y MIME allowlist.
- Headers de seguridad.
- Tests de auth, seguridad y aislamiento.

### 8.2 Riesgos a corregir

- CORS está abierto con `*`. En producción debe utilizar allowlist.
- CSP contiene `unsafe-inline`/`unsafe-eval` y fuentes amplias; debe endurecerse.
- `trust proxy` debe ajustarse al proveedor real.
- JSON no es ideal para múltiples réplicas/alta concurrencia.
- Uploads requieren lifecycle y storage seguro.
- Tracking público requiere controles de abuso, expiración y revocación.

> **Nota:** la existencia de controles no equivale a una certificación de seguridad. Antes de producción debe hacerse threat modeling y pruebas BOLA/IDOR, tokens, CORS/CSP y abuso.

## 9. Cumplimiento legal

El repositorio declara controles orientados al marco argentino: consentimiento, exportación de datos, desactivación/anonimización, auditoría, facturación electrónica y libro de quejas digital.

Se contemplan referencias a:

- Ley 25.326 y criterios de privacidad.
- Ley 24.240 y Ley 26.361.
- ARCA para comprobantes electrónicos y CAE.
- Mecanismo de arrepentimiento/desistimiento.

> **Importante:** la implementación debe revisarse con asesoramiento jurídico antes de publicitar cumplimiento legal.

## 10. Layout y UX

La aplicación utiliza una barra superior común y un selector de experiencias: CONTROL, DRIVER, CLIENT, FOOD y COMMERCE.

### 10.1 Sistema visual

- Base clara con slate/grises.
- Naranja como color de marca.
- Azul para cliente.
- Ámbar para FOOD.
- Naranja oscuro para COMMERCE.
- Cards, bordes redondeados y sombras.
- Lucide.
- Responsive con breakpoints.

### 10.2 Recomendación UX

El selector es excelente para demo/desarrollo. Comercialmente conviene separar experiencias en URLs/subdominios claros, manteniendo un backend común.

## 11. Plataformas e instalación

### 11.1 Estado actual

La plataforma comprobable en el repositorio es Web. No se observa un proyecto nativo Android/iOS ni pipeline de APK/AAB/IPA.

### 11.2 Plataformas recomendadas

| Plataforma | Estrategia | Prioridad |
|---|---|---|
| Web PC | Web responsive | Inmediata |
| Android | PWA primero; Capacitor/native después | Alta |
| iPhone/iPad | PWA primero; wrapper después | Media/alta |
| Windows | PWA/navegador | Media |
| macOS | PWA/navegador | Media |

### 11.3 Cómo se instalaría

Inicialmente se accede por HTTPS. Para una instalación tipo app debe agregarse manifest + service worker y validar criterios PWA. Las apps nativas requerirían empaquetado, firma y publicación en tiendas.

## 12. Despliegue y producción

`package.json` define scripts de desarrollo, build, start, preview, lint, test y verify. GitHub Actions ejecuta instalación, typecheck, tests y build para `main` y pull requests.

### 12.1 Pipeline actual

1. Checkout.
2. Setup Bun.
3. `bun install --frozen-lockfile`.
4. `bun run lint`.
5. `bun run test`.
6. `bun run build`.

### 12.2 Verificación de release

`scripts/verify-release.ts` ejecuta typecheck, tests y build y falla el proceso si cualquiera no termina correctamente.

### 12.3 Infraestructura recomendada

- HTTPS.
- DB transaccional al escalar.
- Object storage para imágenes.
- Logs estructurados.
- Métricas/alertas.
- Backups y restauración.
- Secret manager.
- CORS/CSP restringidos.
- Health/readiness.
- Graceful shutdown.

## 13. Modelo de datos

`types.ts` define entidades como `Company`, `Driver`, `Delivery`, `DeliveryEvent`, `FoodStore`, `FoodProduct`, `FoodOrder`, `PublicSessionData` y `WithdrawalRequest`, entre otras.

### 13.1 Entrega

`Delivery` reúne empresa, conductor, destinatario, estado, timestamps, ubicación del destinatario, ubicación del conductor, ruta, distancia, ETA, token y vínculo opcional con FOOD.

### 13.2 Estados de entrega

- `asignado`
- `esperando_autorizacion`
- `ubicacion_compartida`
- `en_camino`
- `cerca`
- `entregado`
- `rechazado`
- `cancelado`
- `expirado`
- `fallido`

### 13.3 Eventos

`DeliveryEvent` registra creación, asignación, aceptación, inicio, solicitud/compartición de ubicación, llegada, finalización, cancelación, purga y eventos FOOD.

## 14. Integraciones

- Leaflet para mapas.
- Mercado Pago contemplado en pagos FOOD.
- Transferencia y efectivo.
- WhatsApp mediante payload de mensajes.
- ARCA en el dominio fiscal/legal.
- La dependencia `@google/genai` está presente; no se debe asumir una funcionalidad de IA concreta sin verificar cada uso.

> Una dependencia en `package.json` no demuestra que una funcionalidad esté activa en producción.

## 15. Pruebas y calidad

La suite cubre autenticación, seguridad, Food, Commerce, tenant isolation, RBAC, idempotencia, concurrencia, locks, stock, caja, persistencia, rollback, fiscalidad, retiros, backups, HTTP, readiness, runtime configuration y graceful shutdown.

| Área | Cobertura observada |
|---|---|
| Auth | Email y seguridad. |
| Tenant isolation | Food y Commerce. |
| RBAC | Commerce y rutas protegidas. |
| Concurrencia | Locks y operaciones concurrentes. |
| Idempotencia | Operaciones de comercio. |
| Stock/caja | Inventario y caja. |
| Fiscal | Fiscalidad. |
| HTTP | Seguridad y errores. |
| Ops | Readiness y graceful shutdown. |

> La siguiente validación debe ejecutarse también contra un entorno desplegado y no solo contra pruebas locales.

## 16. Hallazgos de auditoría

| Prioridad | Hallazgo | Acción |
|---|---|---|
| P0 | Seguridad del despliegue real | Pentest/abuse tests antes de usuarios reales. |
| P0 | CORS/CSP | Allowlist y CSP mínima. |
| P0 | Persistencia | Validar DB frente a concurrencia real. |
| P1 | Observabilidad | Logs, métricas, alertas. |
| P1 | Uploads | Storage dedicado y lifecycle. |
| P1 | Tracking | TTL, rate limit y revocación. |
| P1 | CI | Mantener typecheck/tests/build como gate. |
| P2 | PWA | Manifest + service worker. |
| P2 | Móviles | Capacitor/native cuando haya demanda. |
| P2 | Documentación | Versionar documentación técnica. |

## 17. Modelo de negocio

UBIKA encaja especialmente bien en un modelo SaaS B2B, evitando depender inicialmente de una comisión por entrega.

Posibles líneas:

- Plan inicial para pequeñas empresas.
- Plan profesional por volumen de conductores/tareas.
- FOOD como módulo adicional.
- COMMERCE como módulo adicional.
- Servicios premium de configuración y soporte.

### 17.1 Estrategia de entrada

1. Elegir 1–3 comercios locales.
2. Implementar piloto real.
3. Medir entregas, asignación, demoras y uso del tracking.
4. Corregir fricciones.
5. Conseguir primeros clientes pagos.
6. Ampliar módulos.

## 18. Desarrollo de funciones

El enfoque recomendado es separar UI, dominio, API, persistencia y pruebas. La base actual ya contiene parte de esa separación, pero `server.ts` concentra bastante lógica.

| Función | UI | Backend | Datos | Pruebas |
|---|---|---|---|---|
| Crear entrega | NewTaskModal | API delivery | deliveries | flow/security |
| Asignar conductor | Control/Driver | auth + delivery | drivers | flow |
| Tracking | CustomerWebApp | token/session | sessions | HTTP/security |
| Mapa | MapView/FleetMap | locations | driver/delivery | flow |
| FOOD | food components | food endpoints | food entities | food E2E |
| Commerce | commerce | commerce service | commerce state | commerce suite |
| Legal | legal components | legal endpoints | legal/audit | legal tests |

## 19. Roadmap

| Fase | Objetivo | Resultado |
|---|---|---|
| 1. Auditar | Cerrar hallazgos | Baseline confiable |
| 2. Corregir | Modularizar/endurecer | Código mantenible |
| 3. Seguridad | Threat model + pruebas | Riesgo controlado |
| 4. Producción | Deploy + observabilidad | Sistema operable |
| 5. Primeros usuarios | Piloto | Feedback real |
| 6. Primeros clientes pagos | SaaS validado | Ingresos iniciales |
| 7. Escalar | DB/infra/UX/apps | Crecimiento |

## 20. Recomendaciones prioritarias

1. Congelar una versión estable de `main`.
2. Mantener `verify`/CI como gate.
3. Modularizar `server.ts`.
4. Separar API pública de tracking y API administrativa.
5. Endurecer CORS/CSP.
6. Configurar `trust proxy` según hosting.
7. Migrar a DB transaccional cuando exista concurrencia real.
8. Separar uploads de la máquina de aplicación.
9. Agregar pruebas BOLA/IDOR por tenant.
10. Agregar observabilidad.
11. Documentar variables de entorno.
12. Crear staging equivalente a producción.
13. Ejecutar E2E contra staging.
14. Definir backups y recuperación.

## 21. Distribución comercial

La mejor estrategia inicial es vender UBIKA como servicio web. Esto reduce fricción de instalación y permite actualizar sin depender de tiendas.

- Web por dominio HTTPS.
- PWA para instalación tipo app.
- Android nativo si el mercado lo justifica.
- iOS nativo si el mercado lo justifica.
- Onboarding asistido para empresas.

### 21.1 Cómo llega al cliente

1. Landing comercial.
2. Demo.
3. Alta de empresa.
4. Configuración de usuarios/conductores.
5. Primera operación.
6. Piloto.
7. Conversión a plan pago.

## 22. Limitaciones de la auditoría

- Se auditó el repositorio GitHub y su estructura/código accesible, principalmente `main`.
- No se realizó pentest externo.
- No se certificó producción.
- No se verificaron credenciales reales.
- Una función en código no implica que esté configurada en producción.
- Las cuestiones legales requieren validación profesional.
- El documento debe actualizarse con cambios de arquitectura/API.

## 23. Evidencia técnica

Fuentes principales de la auditoría:

- Repositorio `josemiranda5266-blip/Ubika`.
- `README.md`.
- `package.json`.
- `src/App.tsx`.
- `src/types.ts`.
- `server.ts`.
- `server/auth.ts`.
- `server/db.ts`.
- `.github/workflows/ci.yml`.
- `scripts/verify-release.ts`.
- Estructura de `src/components` y `server/`.
- Suite de pruebas del repositorio.

## 24. Glosario

| Término | Significado |
|---|---|
| Tracking | Seguimiento público mediante token. |
| ETA | Tiempo estimado de llegada. |
| RBAC | Control de acceso basado en roles. |
| Tenant | Empresa/cliente aislado. |
| PWA | Aplicación web instalable. |
| BOLA/IDOR | Acceso indebido a recursos de otro usuario/tenant. |
| Readiness | Comprobación de preparación para recibir tráfico. |
| Graceful shutdown | Cierre ordenado del servidor. |
| Idempotencia | Repetición segura de una operación. |

## 25. Conclusión

UBIKA ya no es solamente un prototipo de seguimiento de repartos. El repositorio muestra una plataforma con varias superficies de producto, dominio logístico, gastronomía, comercio, autenticación, auditoría, privacidad y una batería considerable de pruebas.

La principal recomendación es convertir primero el núcleo logístico en un producto estable y vendible. El camino más sólido es:

**Auditar → Corregir → Seguridad → Producción → Primeros usuarios → Primeros clientes pagos → Escalar.**

Este documento constituye la documentación maestra inicial de UBIKA y debe mantenerse sincronizado con la arquitectura y el código del repositorio.

---

## Documento complementario

La versión DOCX de esta documentación debe conservarse como `docs/UBIKA_Auditoria_y_Documentacion_Integral.docx` cuando se incorpore mediante Git/GitHub Desktop o una herramienta con soporte para archivos binarios. El archivo DOCX contiene portada, introducción, índice navegable y navegación interna de Word.
