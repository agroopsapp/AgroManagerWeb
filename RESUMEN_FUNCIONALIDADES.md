# Resumen de funcionalidades — AgroManagerWeb (AgroOps)

## Prioridad del producto y criterios de desarrollo (obligatorio leer)

- **Clave (estado del proyecto):** esto es una **demo comercial** a punto de venderse. Prioridades: **estabilidad**, **cero errores de build**, **UX fluida**, y cambios de **riesgo mínimo** (evitar refactors grandes o experimentales justo antes de una entrega/demo).
- **Qué es lo importante:** el **fichador** (registro de jornada y todo el bloque **Jornada** conectado: vacaciones/festivos, partes de obra, **Fichajes y partes** del equipo, y la administración ligera de empresa/servicios según rol). El resto (operativa, tareas, animales, panel, etc.) es **complementario** y solo aplica si las banderas en **Ajustes** lo activan; no sustituye al fichador como eje.

- **Arquitectura en front:** se sigue la estructura acordada del repo (páginas ligeras, `features/`, `services/`, `hooks/`, `types/`, validación de contrato con el API). No mezclar lógica de negocio pesada en la UI sin criterio.

- **Dónde vive la lógica de negocio:** en el **backend**. El front **presenta**, **valida entradas** básicas y **consume** lo que el API expone. Cualquier regla de negocio no trivial (saldos, cierres, permisos reales, integridad) debe resolverse en servidor; el frontend se adapta al contrato (JSON, códigos HTTP, mensajes).

- **Dudas de producto, diseño o alcance:** **preguntar al responsable** antes de implementar; no asumir.

- **Cambios al código o a este documento:** **no se modifica nada sin consentimiento explícito** del responsable del proyecto (incluido “pequeños” ajustes que toquen flujos o contratos visibles al usuario).

---

## Qué es este documento

Documento de referencia para guardar y consultar **qué existe en la aplicación** y **cuándo aparece en el menú**. Las rutas y pantallas “grandes” (tareas, panel, granjas, estadísticas…) solo son navegables si el superadministrador las tiene activadas en **Ajustes**; si no, muchos usuarios solo ven **Jornada** y un bloque reducido de **Datos** / **Sistema**, como en una instalación centrada en fichaje.

Implementación de referencia: `src/components/Sidebar.tsx`, `src/lib/dashboardNavGating.ts`, `src/contexts/FeaturesContext.tsx`, `src/components/DashboardLayout.tsx`.

---

## 1. Menú lateral: qué entradas hay y cuándo se ven

### Banderas globales (`FeaturesContext`, `localStorage`: `agromanager_features`)

| Bandera | Efecto en el menú |
|--------|-------------------|
| **`enableTimeTracking`** | Si es **false**, desaparecen **Registro de jornada**, **Vacaciones y festivos**, **Partes de obra** y **Fichajes y partes** (y rutas bajo `/dashboard/time-tracking/*`). |
| **`enableOperativaYAnalisisMenu`** | Si es **false**, se ocultan del menú (y se redirige si se intenta entrar) las rutas del grupo operativo/análisis: **Panel** (`/dashboard`), **Tareas**, **Tareas sin asignar**, **Incidencias animales**, **Animales**, **Granjas**, **Estadísticas**. Ver lista exacta en `DASHBOARD_PATHS_OPERATIVA_Y_ANALISIS` en `dashboardNavGating.ts`. |
| **`enableAnimals`** | Solo relevante cuando el menú operativo **está activo**: si es **false**, no se muestran **Incidencias animales** ni **Animales** (y la pestaña de incidentes en el panel). |

### Secciones del sidebar (orden real)

1. **Operativa** — Panel, Tareas, Tareas sin asignar, Incidencias animales (solo si `enableOperativaYAnalisisMenu` y cada ítem supera sus filtros de rol/animales).
2. **Hoy** — Registro de jornada, Partes de obra, Fichajes y partes (según rol y `enableTimeTracking`).
3. **Gestión** — Vacaciones y festivos, Mi empresa, Empresas, Servicios, Trabajadores (según rol y `enableTimeTracking`; el trabajador solo suele ver aquí Vacaciones y festivos).
4. **Datos** — Animales, Granjas cuando el menú operativo lista ese bloque (**Trabajadores** está en Gestión).
5. **Análisis** — Estadísticas (solo con menú operativo activo).
6. **Sistema** — Superadmin, Ajustes (**solo rol SuperAdmin** en el sidebar).

### Restricción por rol (“caparazon fichador”)

Para usuarios que **no** son SuperAdmin, el layout solo permite navegar por rutas que devuelve `isDashboardPathAccessibleInFichadorShell`:

- **Worker:** **Hoy** (registro, partes de obra, fichajes y partes) y en **Gestión** solo **Vacaciones y festivos**. No ve Mi empresa, Empresas, Servicios ni Trabajadores en el menú.
- **Admin / Manager:** lo anterior más **Mi empresa**, **Empresas**, **Servicios** y **Trabajadores** (`/dashboard/users`).
- **SuperAdmin:** no aplica esta restricción de navegación en la visibilidad del sidebar (ve todas las entradas que no filtren las banderas anteriores).

### Ejemplo alineado con una instalación “solo lo esencial”

Con **`enableTimeTracking`** activo y **`enableOperativaYAnalisisMenu`** desactivado, un **SuperAdmin** ve típicamente:

- **Hoy:** Registro de jornada, Partes de obra, Fichajes y partes  
- **Gestión:** Vacaciones y festivos, Mi empresa, Empresas, Servicios, Trabajadores  
- **Datos:** vacío si el menú operativo está oculto (Animales y Granjas pertenecen a ese bloque)  
- **Sistema:** Superadmin, Ajustes  

Eso coincide con el menú reducido que quieres documentar como referencia para “solo fichaje + administración ligera”.

### Otras reglas rápidas

- **Panel (`/dashboard`):** oculto para **Worker** aunque el menú operativo esté activo.  
- **Tareas sin asignar:** solo perfiles **Admin / Manager / SuperAdmin**.  
- **Colapso del sidebar:** estado en `localStorage` (`agroops_sidebar_collapsed`).

---

## 2. Autenticación y roles

### Login (`/login`)

- **Qué hace:** Email y contraseña; llama al servicio de autenticación (`auth.service`). Si es correcto, guarda en `localStorage` `token`, `expiresAt` y `user` (id, email, role).
- **Redirección tras login:** **no** siempre a `/dashboard`: se usa `appHomePath(role, enableTimeTracking, enableOperativaYAnalisisMenu)` (`dashboardNavGating.ts`). Con fichaje activo suele abrirse **Registro de jornada**; con menú operativo activo y sin fichaje, el panel u otra entrada coherente según rol.
- **Persistencia:** `AuthContext` lee `localStorage`; sesión válida no caducada mantiene el usuario logueado.

### Roles

**SuperAdmin**, **Admin**, **Manager**, **Worker** (`types/index.ts`). El rol combina con las banderas de features y con `isDashboardPathAccessibleInFichadorShell` para decidir menú y rutas permitidas.

### Protección de rutas

Rutas bajo `/dashboard` van en `DashboardLayout`: sin usuario → `/login`; mientras `isReady`, spinner. Además hay redirecciones si la ruta no está permitida para el rol o si el menú operativo está desactivado y la URL pertenece a ese bloque.

---

## 3. Módulo Jornada y administración ligera del fichaje (prioridad del producto)

Cero de la experiencia: **fichar, consultar y gestionar jornada** (y, según rol, el equipo y la obra vinculada al fichaje). El resto de módulos del documento son secundarios respecto a este bloque.

### Registro de jornada (`/dashboard/time-tracking`)

Fichaje personal: panel de reloj, historial, pausas, olvidos de marcaje, integración con API de informes (`work-reports.service`, hooks en `features/time-tracking/`).

### Vacaciones y festivos (`/dashboard/time-tracking/vacaciones-y-festivos`)

Gestión de calendario laboral / ausencias en el ámbito del fichador (misma feature de tiempo).

### Partes de obra (`/dashboard/time-tracking/partes-de-obra`)

Partes vinculados al registro de jornada y obra (subruta bajo `time-tracking`).

### Fichajes y partes (`/dashboard/team-hours`)

Vista de equipo: resúmenes por fechas, fichajes del equipo, modales de edición/partes (`useEquipo`, `useEquipoModal`, APIs de empresas y servicios cuando aplica).

### Mi empresa (`/dashboard/my-company`)

Perfil de la empresa cliente: datos y recursos asociados (`myCompanyProfile`, `companies.service`). Accesible según rol en el modo fichador extendido (no Worker aislado).

### Empresas (`/dashboard/companies`) y Servicios (`/dashboard/services`)

Administración de empresas y catálogo de servicios en el contexto AgroOps / fichaje (consumo vía servicios en `src/services`).

---

## 4. Operativa y análisis (solo si `enableOperativaYAnalisisMenu`)

Cuando esta bandera está **true**, el menú recupera Panel, Tareas, incidencias, animales, granjas y estadísticas. El detalle funcional que tenías documentado antes sigue siendo válido para esas pantallas; resumen:

### Panel (`/dashboard`)

Pestañas: Tareas del día, Tareas sin asignar (admin), Animales con incidentes (si animales activo y rol adecuado). DatePicker, vista semanal, filtros para admin, columnas tipo Kanban / listados de incidentes.

### Tareas (`/dashboard/tasks`)

Kanban por estado, fecha, filtros, drag & drop en escritorio, `CreateTaskModal`.

### Tareas sin asignar (`/dashboard/unassigned-tasks`)

Solo Admin/SuperAdmin; tareas en `generalTasks`, asignación a trabajador.

### Incidencias animales (`/dashboard/incidents`)

Kanban por estado de caso; requiere menú operativo **y** `enableAnimals` y rol tipo admin.

### Animales (`/dashboard/animals`)

CRUD de animales; mismas condiciones de visibilidad que incidencias en el menú.

### Granjas (`/dashboard/farms`)

CRUD de granjas.

### Estadísticas (`/dashboard/stats`)

Gráficos sobre tareas, animales, usuarios e incidentes (día/semana).

---

## 5. Trabajadores (`/dashboard/users`)

CRUD de usuarios (nombre, email, teléfono, rol). En el menú aparece como “Trabajadores”. Visible en el shell fichador para **Admin/Manager/SuperAdmin**; con operativa desactivada suele ser la única entrada de **Datos** que queda para quien pueda gestionar personal.

---

## 6. Sistema — Superadmin (`/dashboard/superadmin`)

Solo **SuperAdmin**. Paneles de administración global (p. ej. empresas padre, errores de API). Quien no es SuperAdmin es redirigido.

---

## 7. Ajustes (`/dashboard/settings`)

Solo **SuperAdmin**. Incluye tema claro/oscuro (`ThemeContext`, `agromanager_theme`) y los **interruptores globales**: seguimiento de animales, **fichaje / registro de jornada**, **menú de operativa y análisis**. Esas tres banderas son las que explican por qué un entorno muestra solo el menú “de jornada” o el producto completo.

---

## 8. Componentes y contextos compartidos (resumen)

- **CreateTaskModal, DatePicker:** uso en flujos de tareas y fechas cuando operativa está activa.  
- **Header:** logo, menú móvil, menú rápido (filtrado con la misma lógica que el sidebar).  
- **Sidebar:** secciones anteriores; visibilidad centralizada en `isNavItemVisible` en `Sidebar.tsx`.  
- **AuthContext, ThemeContext, FeaturesContext, TasksContext:** igual que antes; **FeaturesContext** ahora incluye `enableTimeTracking` y `enableOperativaYAnalisisMenu`, no solo animales.

---

## 9. Datos y tipos principales

- **Task**, **AnimalCase**, **Animal**, **Farm**, **User**, **Worker:** definidos en tipos y mocks según corresponda.  
- Parte del dominio operativo sigue usando estado React y mocks donde no hay API aún; el fichador consume servicios reales (`auth`, `companies`, `work-reports`, etc.) según las pantallas implementadas. **Regla:** la fuente de verdad al conectar un flujo con el back sigue siendo el **API y el contrato**; el front no sustituye reglas de negocio del servidor.

---

## 10. Tabla rápida: menú operativo OFF vs ON

| Ámbito | `enableOperativaYAnalisisMenu` = false | = true |
|--------|----------------------------------------|--------|
| Panel, Tareas, sin asignar, incidencias, animales, granjas, stats | Ocultos / redirigen | Visibles según rol y `enableAnimals` |
| Jornada + (Admin/Manager/SA) empresa/servicios/users | Siguen según `enableTimeTracking` y rol | Se suman a la izquierda con el resto de secciones |
| Worker (no SA) | Solo rutas fichador + Fichajes y partes | + tareas si aplica; sin panel |

---

Con este documento queda explícito **por qué** un resumen antiguo (solo tareas y panel) no coincidía con el menú real: ese texto describía el producto **con operativa activa**, no el modo **solo Jornada + tramos de administración** que configuras desde **Ajustes** y que refleja el menú reducido. **Recordatorio:** el eje de producto es el **fichador**; el resto es opcional según entorno. Cualquier ampliación o cambio de flujo requiere **alineación con el back** y **acuerdo explícito** antes de tocar implementación.
