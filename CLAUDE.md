Actúa como arquitecto de software senior, security engineer, DBA MySQL y desarrollador full-stack experto en Electron + React + TypeScript + MySQL.

Vas a trabajar sobre el proyecto **Full Gas Gastrobar**, un sistema POS de escritorio para gastrobar.

## Stack del proyecto

- Electron 33
- React 18
- TypeScript
- TailwindCSS + shadcn/ui
- Zustand
- TanStack Query
- MySQL 8+
- mysql2/promise
- bcryptjs
- Zod
- electron-vite + Vite

## Arquitectura esperada

Renderer React
→ Preload IPC Bridge
→ Main Process
→ IPC Handlers
→ Services
→ Repositories / SQL
→ MySQL

## Instrucción principal

Necesito que analices el proyecto completo y realices las adiciones/correcciones necesarias de forma profesional, segura y consistente.

Si alguna instrucción no está totalmente clara, **no te detengas**. Toma la mejor decisión técnica para el proyecto, priorizando:

1. seguridad
2. consistencia de datos
3. auditoría completa
4. mantenibilidad
5. experiencia real de operación POS
6. compatibilidad con la arquitectura existente

No implementes parches superficiales. Implementa soluciones completas, tipadas, validadas y coherentes con el dominio.

---

# OBJETIVOS PRINCIPALES

Debes implementar o corregir los siguientes módulos y capacidades:

## 1. Recuperación de contraseña mediante preguntas de seguridad

Agregar recuperación de contraseña para usuarios nuevos y existentes mediante preguntas de seguridad.

### Requisitos funcionales

- Al crear un usuario nuevo, debe ser obligatorio configurar preguntas de seguridad.
- Cada usuario debe tener mínimo 2 o 3 preguntas de seguridad.
- Las respuestas NO deben guardarse en texto plano.
- Las respuestas deben almacenarse hasheadas.
- La recuperación debe permitir:
  - identificar usuario
  - responder preguntas de seguridad
  - validar respuestas
  - permitir cambio de contraseña
- El cambio de contraseña debe invalidar sesiones activas del usuario.
- Debe quedar registro en auditoría.

### Requisitos técnicos

- Crear migración SQL si faltan tablas/campos.
- Crear tipos compartidos en `src/shared/types`.
- Crear validaciones Zod.
- Crear handlers IPC seguros.
- Crear services en main.
- Crear UI en renderer.
- No permitir enumeración insegura de usuarios.
- No mostrar respuestas.
- No guardar respuestas en frontend.
- No usar preguntas débiles si se puede evitar.

### Tablas sugeridas

Puedes decidir el diseño final, pero considera algo como:

- `security_questions`
- `user_security_answers`
- `password_reset_attempts`
- `user_sessions`

Las respuestas deben ser hasheadas con bcrypt o mecanismo equivalente.

---

## 2. Modificación de datos del admin

Permitir modificar los datos del usuario administrador de forma segura.

### Datos modificables

- nombre
- username
- contraseña
- estado
- rol, si aplica
- preguntas de seguridad
- datos de contacto, si existen

### Restricciones

- No permitir dejar el sistema sin ningún admin activo.
- No permitir que un admin se quite permisos críticos a sí mismo sin confirmación fuerte.
- Cambios sensibles deben requerir contraseña actual o reautenticación.
- Cambios deben quedar auditados con antes/después.
- Si cambia contraseña, revocar sesiones previas.
- Si cambia username, validar unicidad.
- Si cambia rol/permisos, auditar como evento crítico.

---

## 3. Módulo adicional de promociones diarias

Crear un apartado para añadir, editar, activar, desactivar y consultar promociones diarias.

### Requisitos funcionales

- Crear pantalla de promociones diarias.
- Permitir:
  - crear promoción
  - editar promoción
  - activar/desactivar
  - definir días aplicables
  - definir horario
  - definir productos incluidos
  - definir tipo de descuento
  - definir porcentaje o valor fijo
  - definir vigencia
  - definir prioridad
- Debe integrarse con pedidos/ventas si corresponde.
- Debe quedar claro si la promoción se aplica automáticamente o manualmente.
- Debe evitar promociones inválidas o contradictorias.
- Debe quedar auditado quién creó, editó o desactivó una promoción.

### Tipos de promociones sugeridos

- descuento porcentual
- descuento fijo
- 2x1
- combo
- happy hour
- promoción por día de la semana

### Requisitos técnicos

- Revisar si ya existen tablas/canales relacionados con promociones.
- Si existen contratos IPC declarados pero no implementados, completarlos.
- Crear migración SQL si hace falta.
- Crear services e IPC handlers.
- Crear UI con formularios validados.
- Aplicar Zod en frontend y backend.
- El backend debe ser fuente de verdad para cálculos críticos.

---

# 4. Auditoría avanzada obligatoria

Ampliar y endurecer auditoría para registrar eventos críticos del sistema.

## Eventos obligatorios a auditar

Debes garantizar auditoría para:

- quién cambió un precio
- quién anuló una venta
- quién abrió caja
- quién cerró caja
- quién cambió inventario
- quién modificó permisos
- quién vio reportes sensibles
- quién modificó promociones
- quién modificó datos de admin
- quién cambió contraseña
- quién recuperó contraseña
- quién falló intentos de recuperación
- quién inició sesión
- quién cerró sesión
- quién fue revocado
- quién fue cerrado por inactividad

## Datos mínimos de auditoría

Cada evento crítico debe guardar:

- usuario actor
- rol del actor
- acción
- módulo
- entidad afectada
- ID de entidad
- descripción
- valores antes del cambio
- valores después del cambio
- fecha/hora
- equipo/dispositivo
- IP local o identificador disponible
- sucursal, si existe o se puede preparar el campo
- session_id
- resultado: éxito/fallo
- motivo, cuando aplique

## Requisitos importantes

- La auditoría de eventos críticos NO debe ser opcional.
- No silenciar errores de auditoría en acciones críticas.
- Si una acción crítica no puede auditarse, debe fallar o usar un mecanismo seguro tipo outbox transaccional.
- No registrar contraseñas ni respuestas de seguridad en texto plano.
- Los campos before/after deben excluir datos sensibles.
- Para cambios de precios, permisos, inventario y ventas anuladas, el before/after es obligatorio.
- Para reportes sensibles, registrar al menos quién los vio, cuándo, filtros usados y módulo consultado.

---

# 5. Políticas fuertes de sesión

Implementar sesiones seguras con:

- expiración
- revocación
- cierre por inactividad
- cierre manual
- revocación por cambio de contraseña
- revocación por modificación de permisos
- validación de sesión en backend

## Requisitos funcionales

- Al iniciar sesión, crear sesión persistida.
- Cada llamada IPC crítica debe validar sesión activa.
- La sesión debe expirar tras un tiempo configurado.
- Debe existir cierre por inactividad.
- Debe existir logout.
- Debe existir revocación de sesiones.
- Si el admin cambia permisos o contraseña de un usuario, sus sesiones deben invalidarse.
- Si un usuario cambia su contraseña, cerrar sus otras sesiones.
- Mostrar aviso de sesión expirada en UI.
- Redirigir a login al expirar o revocar sesión.

## Requisitos técnicos

- No confiar solo en estado del renderer.
- El main process debe validar sesión.
- No confiar solo en `actorId` enviado desde UI.
- Usar `session_id` o token seguro.
- Guardar hash del token o identificador seguro, no token plano si aplica.
- Registrar:
  - fecha creación
  - expiración
  - último uso
  - revocación
  - motivo de revocación
  - equipo/IP
  - usuario
- Implementar cierre por inactividad en renderer y validación en backend.
- Configurar tiempos desde settings si es posible.

---

# 6. Seguridad IPC obligatoria

Debes revisar y endurecer todos los IPC handlers.

## Requisitos

- Cada handler crítico debe validar:
  - sesión activa
  - permisos
  - payload con Zod
  - rol autorizado
- No aceptar acciones críticas solo porque el frontend muestra botones.
- No confiar en `actorId`, `actorUsername` o `role` enviados desde renderer.
- El actor debe derivarse de la sesión validada en backend.
- El preload debe tener allowlist de canales.
- Evitar `invoke(channel: string, ...args)` completamente abierto.
- Corregir listeners `on/off` para evitar fugas de memoria.
- No exponer APIs innecesarias en `window`.

---

# 7. Base de datos y migraciones

Debes revisar el esquema actual y crear migraciones nuevas sin romper datos existentes.

## Requisitos

- Crear migración incremental nueva.
- No editar destructivamente migraciones históricas salvo que el proyecto aún no esté en producción.
- Agregar índices necesarios.
- Agregar foreign keys necesarias.
- Agregar constraints donde aplique.
- Asegurar una sola orden activa por mesa si aún no está garantizado.
- Asegurar trazabilidad de sesiones, auditoría y promociones.
- Validar compatibilidad MySQL 8.

## Tablas/campos posibles

Puedes decidir el mejor diseño, pero probablemente necesitarás:

- `user_sessions`
- `security_questions`
- `user_security_answers`
- `password_reset_attempts`
- `daily_promotions`
- `promotion_products`
- `promotion_schedules`
- campos extra en `audit_logs`
- campos de dispositivo/IP/sucursal/session_id

---

# 8. UI/UX requerida

Implementar pantallas claras y utilizables.

## Nuevas pantallas o secciones

- Recuperación de contraseña
- Configuración de preguntas de seguridad
- Edición segura del admin
- Gestión de promociones diarias
- Sesiones activas, si aplica
- Auditoría avanzada, si aplica

## Requisitos UI

- Formularios validados
- Mensajes claros
- Estados de carga
- Manejo de errores
- Confirmaciones para acciones críticas
- No bloquear flujo operativo innecesariamente
- No mostrar datos sensibles
- Confirmación para cambios de permisos, precios, inventario y anulaciones
- Mostrar auditoría de before/after de forma legible

---

# 9. Reglas de negocio críticas a respetar

No rompas estas reglas existentes:

1. Una mesa solo puede tener una orden activa.
2. Una cuenta no puede cerrarse con saldo pendiente.
3. El servicio opcional debe registrarse.
4. Todo ítem cancelado debe auditarse con motivo y usuario.
5. Las ventas descuentan inventario al cierre.
6. El consecutivo de comprobantes debe ser único.
7. No se puede vender sin stock suficiente.
8. Enviar tanda no debe depender obligatoriamente de imprimir.
9. La impresora no debe bloquear operaciones críticas.
10. Los cálculos finales deben validarse en backend.

---

# 10. Entregables esperados

Debes entregar:

## A. Diagnóstico previo

Antes de modificar, explica:

- estado actual del proyecto
- qué ya existe
- qué falta
- riesgos detectados
- archivos que vas a intervenir

## B. Implementación

Realiza los cambios necesarios en:

- migraciones SQL
- tipos compartidos
- schemas Zod
- services
- IPC handlers
- preload
- renderer
- stores/hooks
- páginas/componentes
- settings si aplica

## C. Documentación

Actualizar o crear documentación:

- README si aplica
- docs de seguridad
- docs de auditoría
- instrucciones de migración
- usuarios/flujo de prueba

## D. Pruebas

Indica cómo probar:

- recuperación de contraseña
- modificación admin
- promociones diarias
- auditoría before/after
- auditoría de reportes sensibles
- expiración de sesión
- revocación de sesión
- cierre por inactividad
- permisos IPC
- bloqueo de usuario no autorizado

---

# 11. Formato de respuesta obligatorio

Quiero que respondas con esta estructura:

## 1. Resumen ejecutivo
- qué se analizó
- qué se implementó
- qué riesgos se resolvieron
- qué queda pendiente

## 2. Decisiones técnicas tomadas
Para cada decisión:
- problema
- opciones posibles
- decisión tomada
- razón
- impacto

## 3. Cambios por módulo

### Seguridad
### Sesiones
### Recuperación de contraseña
### Usuarios/Admin
### Promociones
### Auditoría
### IPC/Preload
### Base de datos
### UI/UX

## 4. Archivos modificados
Para cada archivo:
- ruta
- cambio realizado
- razón

## 5. Migraciones SQL
- nombre de migración
- tablas creadas
- columnas agregadas
- índices
- constraints
- compatibilidad

## 6. Validaciones agregadas
- schemas Zod
- validación backend
- validación frontend
- permisos por rol

## 7. Auditoría implementada
Para cada evento:
- acción
- módulo
- actor
- entidad
- before/after
- session_id
- IP/equipo/sucursal
- resultado

## 8. Pruebas manuales
Incluye pasos exactos para probar:
- crear usuario con preguntas
- recuperar contraseña
- modificar admin
- crear promoción diaria
- cambiar precio
- anular venta
- abrir/cerrar caja
- cambiar inventario
- modificar permisos
- ver reporte sensible
- expirar sesión
- revocar sesión
- cerrar por inactividad

## 9. Pruebas técnicas
Incluye comandos:
- npm install, si aplica
- npm run dev
- npm run build
- npm run typecheck
- npm run lint
- migraciones SQL
- queries de verificación

## 10. Checklist de aceptación
Marca cada punto como:
- completado
- parcial
- pendiente
- bloqueante

---

# 12. Criterios de aceptación estrictos

La implementación solo se considera válida si:

- La recuperación de contraseña funciona sin exponer respuestas.
- Las respuestas de seguridad están hasheadas.
- El admin puede modificar sus datos de forma segura.
- No se puede dejar el sistema sin admin activo.
- Las promociones diarias se pueden crear, editar, activar y desactivar.
- Los cambios de precio quedan auditados con before/after.
- Las anulaciones de venta quedan auditadas.
- Apertura y cierre de caja quedan auditados.
- Cambios de inventario quedan auditados.
- Cambios de permisos quedan auditados.
- Visualización de reportes sensibles queda auditada.
- Cada evento crítico registra usuario, fecha, equipo/IP/sucursal cuando sea posible.
- Cada cambio crítico registra antes y después.
- Las sesiones expiran.
- Las sesiones pueden revocarse.
- La app cierra sesión por inactividad.
- Los IPC críticos validan sesión y permisos.
- El renderer no es fuente de verdad de permisos.
- No se guardan contraseñas, tokens ni respuestas sensibles en texto plano.
- El proyecto compila.
- No se rompen flujos POS existentes.

---

# 13. Instrucción final

Si encuentras conflictos entre lo pedido y la implementación actual, toma la decisión más segura y profesional.

Si hay varias formas de resolver algo, elige la que mejor preserve:

- seguridad
- integridad transaccional
- mantenibilidad
- claridad de arquitectura
- experiencia real de operación en un bar

No entregues una solución parcial sin advertirlo claramente.
No maquilles deuda técnica.
No ocultes riesgos.
No asumas que algo está bien solo porque existe en frontend.
Verifica siempre backend, IPC, base de datos y UI.