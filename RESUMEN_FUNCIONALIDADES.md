# Resumen de funcionalidades — AgroManagerWeb (AgroOps)

Documento de referencia con el detalle de cada funcionalidad de la aplicación para guardar y consultar.

---

## 1. Autenticación y roles

### Login (`/login`)
- **Qué hace:** Pantalla de inicio de sesión con email y contraseña.
- **Flujo:** El usuario introduce email y contraseña; la app llama al servicio de autenticación (`auth.service`). Si la respuesta es correcta, se guarda en `localStorage` un objeto con `token`, `expiresAt` (caducidad) y `user` (id, email, role). Luego se redirige a `/dashboard`.
- **Validación:** Comprueba que email y contraseña no estén vacíos antes de enviar. Muestra mensaje de error si el login falla.
- **Persistencia:** Al cargar la app, `AuthContext` lee `localStorage`; si hay sesión válida y no ha caducado, el usuario queda logueado. Si ha caducado, se borra la sesión.

### Roles de usuario
- **SuperAdmin**, **Admin**, **Manager**, **Worker** (definidos en `types/index.ts`).
- **Uso:** El rol determina qué pantallas y acciones ve cada usuario:
  - **Tareas sin asignar:** solo Admin y SuperAdmin.
  - **Animals** e **Animal incidents:** visibles si está activada la funcionalidad “animales” en Ajustes y el usuario es Admin o SuperAdmin.
  - En **Dashboard** y **Tasks**, los administradores tienen filtros extra (trabajador, granja, código de tarea).

### Protección de rutas
- Las rutas bajo `/dashboard` están envueltas en `DashboardLayout`. Si no hay usuario logueado (`AuthContext`), se redirige a `/login`. Mientras se resuelve el estado de auth (`isReady`), se muestra un spinner.

---

## 2. Dashboard principal (`/dashboard`)

### Descripción
Vista resumen con tres secciones (pestañas) que se eligen en la parte superior: **Tareas del día**, **Tareas sin asignar** y **Animales con incidentes** (esta última solo si la funcionalidad “animales” está activa y el usuario es Admin/SuperAdmin).

### Selector de fecha y semana
- **DatePicker** para elegir un día. Opción “Ver semana” que muestra una fila con los 7 días de la semana (Lun–Dom) y el día seleccionado resaltado.
- Las tareas mostradas en “Tareas del día” dependen de la **fecha seleccionada**: se filtran por `date` (o “hoy” si no tienen fecha).

### Filtros (solo Admin/SuperAdmin)
- **Trabajador:** selector (todos o un trabajador concreto) y/o campo de texto para buscar por nombre.
- **Granja:** selector (todas o una granja) y/o texto para filtrar por nombre de granja.
- **Código de tarea:** campo de texto; filtra por número de tarea (ej. 0012 o 12).
- Los filtros se aplican a la lista de tareas del día antes de agrupar por estado.

### Pestaña “Tareas del día”
- Tres columnas tipo Kanban: **Lista para empezar**, **En desarrollo**, **Finalizada**.
- Cada tarea se muestra en una tarjeta (`TaskPreviewCard`) con: número (#0001), título, prioridad (Alta/Media/Baja), granja, fecha de creación, trabajador asignado y resumen de detalles.
- Los conteos por columna se actualizan según la fecha y los filtros.

### Pestaña “Tareas sin asignar”
- Misma estructura de tres columnas, pero con las **tareas generales** (sin trabajador asignado).
- Opción para filtrar por la fecha seleccionada o ver todas las tareas sin asignar.
- Solo visible y usable por Admin/SuperAdmin.

### Pestaña “Animales con incidentes”
- Lista de incidentes de animales cuya **fecha** coincide con la fecha seleccionada.
- Cada ítem muestra: número de incidencia, tipo de caso, importancia (severidad), animal (crotal y nombre), fecha de creación, estado (Reportado / En tratamiento / Resuelto) y resumen.
- Colores según importancia (crítica/alta en rojo, media en ámbar, baja en gris).

---

## 3. Tasks — Tareas (`/dashboard/tasks`)

### Descripción
Vista principal de gestión de tareas asignadas a trabajadores, organizadas por estado en un Kanban de tres columnas y filtrada por **fecha**.

### Selector de fecha
- Un **DatePicker** permite elegir el día. Solo se muestran tareas cuya `date` (o “hoy” por defecto) coincide con la fecha elegida.

### Filtros
- **Código de tarea:** texto; filtra por número visible (ej. 0005, 5).
- **Trabajador:** selector (todos o uno concreto) y campo de texto para buscar por nombre.
- **Granja:** selector (todas o una) y campo de texto por nombre.
- Misma estética que en Dashboard: bloque “Filtros” con cabecera y grid de campos.

### Columnas Kanban
- **Lista para empezar** → **En desarrollo** → **Finalizada**.
- En escritorio, las tarjetas se pueden **arrastrar y soltar** (drag and drop con `@dnd-kit`) entre columnas; al soltar se actualiza el estado de la tarea.
- En móvil no hay drag; se usa un selector de estado o botones en la tarjeta.

### Tarjeta de tarea (`TaskCard`)
- Muestra: número (#0001), título, prioridad (badge de color), granja, trabajador, **fecha de creación** y **fecha de la tarea** (día asignado), detalles del manager, estado actual.
- Acciones: avanzar/retroceder estado, editar fecha (si está permitido), añadir comentarios, eliminar (si hay callback).
- Si se pasa `dragRef` y `dragListeners`, la tarjeta es arrastrable; durante el arrastre se muestra un overlay con una copia de la tarjeta que sigue al cursor.

### Crear tarea
- Botón “Crear tarea” abre el **CreateTaskModal** (componente compartido).
- **Modos:** “Desde plantilla” (elige una plantilla predefinida y rellena título y detalles) o “Personalizada” (título y detalles libres).
- Campos: plantilla o título/detalles, **trabajador** (opcional), **granja**, **prioridad**, **fecha**.
- Si se asigna trabajador y granja, la tarea se crea en la lista de **tareas asignadas** (`tasks`). Si no se asigna trabajador, se crea como **tarea general** (`generalTasks`) y aparecerá en “Tareas sin asignar”.

### Tareas recurrentes (opcional en la página)
- Existe el concepto de **RecurringTaskSchedule** en tipos y mock: tareas que se repiten en días de la semana. La UI puede permitir crear/editar estos horarios para que se generen tareas automáticamente (la implementación exacta depende del flujo en la página).

---

## 4. Tareas sin asignar (`/dashboard/unassigned-tasks`)

### Descripción
Lista de tareas que **no tienen trabajador asignado** (solo granja y fecha, si se desea). Solo accesible por **Admin** y **SuperAdmin**.

### Comportamiento
- Las tareas se obtienen del contexto `generalTasks` (estado en `TasksContext`).
- Filtro por **código de tarea** (número).
- Cada tarea se puede **asignar**: se abre un modal para elegir **trabajador**, **granja** y **fecha**. Al guardar con trabajador, la tarea se mueve de `generalTasks` a `tasks` (ya asignada) y desaparece de esta vista.
- Se puede cambiar solo granja y fecha sin asignar trabajador; la tarea sigue en “sin asignar”.
- Botón “Crear tarea” abre el mismo **CreateTaskModal**; si se crea sin trabajador, la tarea aparece aquí.

---

## 5. Animal incidents — Incidentes de animales (`/dashboard/incidents`)

### Descripción
Gestión de **casos/incidentes** vinculados a un animal (modelo `AnimalCase`): tipo de caso, estado, severidad, fecha, resumen.

### Columnas por estado
- **Reportado** → **En tratamiento** → **Resuelto**.
- Las tarjetas se pueden **arrastrar y soltar** entre columnas para cambiar el estado del caso.

### Filtros
- **Crotal:** texto; filtra por número de crotal del animal (coincidencia parcial sobre `Animal.identification`).
- **Fecha:** input `type="date"`; solo incidentes de esa fecha; enlace “Todas las fechas” para limpiar.
- **Importancia:** select: Todas, Alta, Media, Baja (sin “Crítico” en la UI).
- **Tarea / tipo:** texto; filtra por tipo de caso (ej. Cojera, Herida) con coincidencia parcial en `caseType`.
- Debajo de los filtros se muestra un resumen de filtros activos cuando hay alguno aplicado.

### Tarjeta de incidente (`IncidentCard`)
- Muestra: número (#0001), tipo de caso, prioridad/importancia (chip de color), animal (crotal y nombre), fecha de creación, estado, resumen.
- Acciones: cambiar estado (avanzar/retroceder), eliminar. Diseño con borde izquierdo de color según severidad.

### Crear incidente
- Modal con dos modos: **plantilla** (tipos predefinidos en `INCIDENT_TEMPLATES` con resumen por defecto) o **personalizado** (tipo y resumen libres).
- Campos: plantilla o tipo/resumen, **animal** (select de animales), **importancia** (Alta, Media, Baja), **fecha**.
- Se genera un número de incidencia secuencial y el caso se añade con estado “Reportado”.

---

## 6. Animals — Animales (`/dashboard/animals`)

### Descripción
CRUD de **animales**: nombre, granja, especie, sexo, fecha de nacimiento, identificación (crotal). Visible solo si la funcionalidad “animales” está activa en Ajustes y el usuario es Admin/SuperAdmin.

### Listado
- Tabla (o lista) con columnas ordenables: nombre, granja, especie, sexo, fecha nacimiento, identificación.
- **Ordenación:** clic en la cabecera de columna alterna ascendente/descendente.
- **Filtros:** búsqueda por texto (nombre, crotal, granja, especie), filtro por granja, por especie, por sexo.

### Crear / Editar
- Modal con: nombre, granja (select), especie (select), sexo (Macho/Hembra), fecha de nacimiento, identificación (crotal).
- Al guardar, si es edición se actualiza el animal; si es nuevo se genera un id y se añade a la lista.

### Eliminar
- Confirmación antes de borrar; al confirmar se elimina de la lista (estado local).

---

## 7. Workers / Users — Trabajadores y usuarios (`/dashboard/users`)

### Descripción
CRUD de **usuarios** del sistema: nombre, email, teléfono, rol. Los datos se muestran como “Workers” en el menú pero el modelo es User con roles.

### Listado
- Tabla con: nombre, email, teléfono, rol. Ordenación por nombre, email o rol. Filtro por texto (nombre, email, teléfono) y por rol.

### Crear / Editar
- Modal: nombre, email, teléfono, contraseña (solo para crear o si se desea cambiar), rol (select con roles de `MOCK_ROLES`).
- En edición la contraseña puede dejarse en blanco para no cambiarla.

### Copiar teléfono
- Botón para copiar el teléfono al portapapeles; feedback visual temporal (ej. “Copiado”).

### Eliminar
- Confirmación antes de eliminar el usuario de la lista.

---

## 8. Farms — Granjas (`/dashboard/farms`)

### Descripción
CRUD de **granjas**: nombre y ubicación.

### Listado
- Tabla con nombre y ubicación. Ordenación por nombre o ubicación. Filtro por texto en nombre o ubicación.

### Crear / Editar / Eliminar
- Modal para crear/editar con nombre y ubicación. Confirmación para eliminar; al confirmar se quita la granja de la lista.

---

## 9. Stats — Estadísticas (`/dashboard/stats`)

### Descripción
Vista de **gráficos** sobre tareas, animales, usuarios e incidentes. Los datos de tareas e incidentes se pueden ver **por día** o **por semana**.

### Selector de período
- Botones “Día” y “Semana”. Selector de fecha: si es día, se usa esa fecha; si es semana, se calcula el rango lunes–domingo de la semana que contiene esa fecha.

### Gráficos
- **Tareas por estado:** barras con conteo de tareas en Lista para empezar, En desarrollo, Finalizada (para el día o semana elegidos). Usa datos mock de tareas (`MOCK_TASKS` o el origen que use la página).
- **Animales por granja:** gráfico de tarta o barras con número de animales por granja (datos de `MOCK_ANIMALS`).
- **Usuarios por rol:** distribución de usuarios por rol (`MOCK_USERS` + `MOCK_ROLES`).
- **Incidentes por estado:** barras o tarta con Reportado, En tratamiento, Resuelto (filtrados por fecha o semana).
- **Incidentes por importancia:** distribución por severidad (Baja, Media, Alta, Crítica) en el período elegido.

Las series se filtran por la fecha o rango de semana seleccionado cuando aplica (tareas e incidentes).

---

## 10. Settings — Ajustes (`/dashboard/settings`)

### Apariencia
- **Tema claro / oscuro:** dos botones; al elegir uno se guarda en `ThemeContext` y en `localStorage` (`agromanager_theme`). Un script en el layout raíz aplica el tema al cargar para evitar parpadeo.

### Funcionalidad de animales
- **Solo Admin/SuperAdmin.** Switch “Activar seguimiento de animales”.
- Si está **activado:** se muestran en el menú y en el dashboard las secciones de Animals, Animal incidents y la pestaña “Animales con incidentes”.
- Si está **desactivado:** se ocultan esas rutas y la pestaña. El valor se persiste en `FeaturesContext` y en `localStorage` (`agromanager_features`).

---

## 11. Componentes y contexto compartidos

### CreateTaskModal
- Modal reutilizado en **Tasks** y **Tareas sin asignar** para crear tareas.
- Modo plantilla (lista de `TASK_TEMPLATES`) o personalizado. Campos: trabajador, granja, prioridad, fecha. Si no hay trabajador, la tarea se crea en `generalTasks`; si hay trabajador, en `tasks`. Usa `getNextTaskNumber()` del contexto para el número de tarea.

### DatePicker
- Componente para elegir una fecha (calendario); devuelve valor en formato `YYYY-MM-DD`. Usado en Dashboard, Tasks, Stats, Tareas sin asignar y en tarjetas de tarea para cambiar fecha.

### Header
- Cabecera del dashboard: logo, menú móvil (hamburguesa), menú rápido (grid de accesos), y posiblemente usuario/cierre de sesión si está implementado.

### Sidebar
- Navegación lateral por secciones: Operativa (Dashboard, Tasks, Tareas sin asignar, Animal incidents), Datos (Animals, Workers, Farms), Análisis (Stats), Sistema (Settings). Respeta rol (oculta “Tareas sin asignar” a no admin) y funcionalidad animales (oculta Animals e Incidents si está desactivada). Se puede colapsar; el estado se guarda en `localStorage`.

### AuthContext
- Gestiona usuario, token y estado `isReady`. Métodos `login` y `logout`. Persiste sesión en `localStorage` y comprueba caducidad al iniciar.

### ThemeContext
- Tema `light` / `dark`; lo aplica a `document` y lo persiste en `localStorage`.

### FeaturesContext
- Bandera `enableAnimals`; la persiste en `localStorage` y la usan Sidebar y páginas para mostrar u ocultar rutas de animales e incidentes.

### TasksContext
- **tasks:** tareas asignadas a trabajadores. **generalTasks:** tareas sin asignar.
- **setTasks / setGeneralTasks** para modificar listas.
- **assignUnassignedTask(taskId, { workerId, farmName, date }):** mueve una tarea de `generalTasks` a `tasks` con el trabajador, granja y fecha indicados.
- **getNextTaskNumber():** devuelve el siguiente número de tarea (máximo entre ambas listas + 1).

---

## 12. Datos y tipos principales

- **Task:** id, taskNumber, title, priority (high/medium/low), farmName, workerId, status (ready/in_progress/completed), managerDetails, comments, createdAt, date.
- **AnimalCase:** id, incidentNumber, animalId, caseType, status (reported/in_treatment/resolved), summary, severity (high/medium/low; en tipos también critical), date.
- **Animal:** id, name, farmId, speciesId, sex, birthDate, identification (crotal).
- **Farm:** id, name, location.
- **User:** id, name, email, phone, roleId.
- **Worker:** id, name (usado para mostrar en tareas; puede estar ligado a User en backend).

Los datos por ahora viven en estado React y en mocks (`src/data/mock.ts`); no hay persistencia en base de datos desde este resumen.

---

## 13. Diferencias clave entre vistas

| Concepto        | Dashboard                         | Tasks                    | Tareas sin asignar     |
|----------------|-----------------------------------|--------------------------|-------------------------|
| Fuente de tareas | `tasks` (por fecha) + `generalTasks` | `tasks` (por fecha)      | `generalTasks`          |
| Filtro principal | Fecha + (admin) trabajador/granja/código | Fecha + filtros detallados | Código de tarea         |
| Crear tarea    | No (se va a Tasks o Sin asignar)  | CreateTaskModal          | CreateTaskModal         |
| Drag & drop    | No                                | Sí (Kanban)              | No                      |

Con este documento puedes recordar con detalle qué hace cada pantalla y cada bloque de la aplicación para guardarlo o compartirlo.
