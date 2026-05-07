# Guía de Usuario: Fichajes y Partes del Equipo

Pantalla: `Fichajes y partes`

Ruta local: `http://localhost:3000/dashboard/team-hours`

## Para Qué Sirve

Esta pantalla permite revisar el estado de los fichajes y partes de trabajo del equipo.

Desde aquí puedes:

- Ver quién ha fichado.
- Detectar personas sin fichar.
- Revisar jornadas sin parte de trabajo.
- Consultar vacaciones, bajas o días no laborables.
- Filtrar por fechas, personas, empresa o servicio.
- Editar fichajes o partes si tienes permisos.
- Exportar informes en PDF.

Es una pantalla pensada para controlar el día a día del equipo desde una sola vista.

## Quién Puede Usarla

La pantalla cambia según el tipo de usuario.

| Usuario | Qué puede hacer |
| --- | --- |
| Superadministrador | Puede ver y gestionar todos los datos disponibles. |
| Administrador | Puede revisar y gestionar fichajes dentro de su ámbito. |
| Manager | Puede revisar y gestionar el equipo asignado según permisos. |
| Trabajador | Puede consultar la información y editar solo fechas recientes si está permitido. |

Los trabajadores solo pueden editar fichajes o partes de los últimos días permitidos por la empresa.

## Vista General de la Pantalla

La pantalla se organiza en varias zonas:

1. Resumen superior del equipo.
2. Filtros.
3. Tabla de registros.
4. Resumen del día.
5. Paneles de cumplimiento.
6. Calendario de una persona.

En ordenador se ve todo distribuido en columnas.

En móvil, los filtros se abren desde un botón flotante y la información se adapta para ocupar mejor la pantalla.

## Resumen Superior

La parte superior muestra un resumen rápido del estado del equipo.

Puedes ver:

- Porcentaje de cumplimiento.
- Cuántas personas han fichado.
- Cuántas están sin fichar.
- Cuántas están de vacaciones.
- Cuántas jornadas están sin parte.
- Horas imputadas.
- Jornadas fichadas.
- Partes completados.
- Días sin imputar.

Este resumen cambia automáticamente cuando modificas filtros o periodo.

## Filtros

Los filtros sirven para acotar la información que quieres consultar.

### Periodo

Puedes elegir:

- Día.
- Semana.
- Mes.
- Trimestre.
- Año.

Según lo que elijas, aparecerá un selector diferente.

Por ejemplo:

- Si eliges **Día**, seleccionas una fecha concreta.
- Si eliges **Mes**, seleccionas el mes.
- Si eliges **Año**, puedes revisar el año y cambiar el mes visible de la tabla.

### Empresa

Permite ver los datos de una empresa concreta.

Este filtro solo aparece si tu usuario tiene permisos para trabajar con varias empresas.

### Persona

Permite consultar los fichajes de una persona concreta.

Cuando seleccionas una persona, también se activa el calendario lateral con el resumen de sus días.

### Servicio

Permite filtrar por servicio o área de trabajo.

### Vista Rápida

Son accesos directos para encontrar incidencias más rápido.

Opciones:

- **Sin fichar:** muestra días laborables sin fichaje.
- **Sin parte:** muestra jornadas cerradas que no tienen parte de trabajo.
- **Con parte:** muestra jornadas que sí tienen parte.

### Borrar Filtros

El botón **Borrar filtros** limpia empresa, persona, servicio y vista rápida.

No cambia el periodo seleccionado.

## Tabla de Registros

La tabla es la zona principal de trabajo.

Muestra los fichajes y estados del periodo seleccionado.

Columnas habituales:

- Trabajador.
- Fecha.
- Estado.
- Entrada.
- Salida.
- Descanso.
- Razón.
- Modificado por.
- Fecha de modificación.
- Duración.
- Horas extra.
- Parte en servidor.
- Acciones.

## Qué Significa Cada Estado

### Closed

La jornada está cerrada. Normalmente significa que hay entrada y salida.

### Vacaciones

La persona está marcada como vacaciones ese día.

### Baja

La persona está marcada como baja o ausencia.

### Sin imputar

Es un día laborable en el que no aparece fichaje.

### No laboral

Es un día que no cuenta como jornada normal, por ejemplo fin de semana, festivo o día marcado como no laborable.

## Acciones de la Tabla

En la columna **Acciones** pueden aparecer botones para trabajar con cada fila.

Según permisos, podrás:

- Crear una jornada en un día sin fichaje.
- Editar la hora de entrada, salida o descanso.
- Añadir o editar el parte de trabajo.

Si no tienes permisos o la fecha no es editable, la acción no aparecerá.

## Editar un Día

Al editar un día, se abre una ventana con varias opciones.

Puedes:

- Añadir vacaciones.
- Añadir baja o ausencia.
- Marcar el día como no laboral.
- Modificar el horario manualmente.
- Eliminar un fichaje si existe en el servidor.

Cuando se modifica un fichaje, la pantalla refresca los datos para que la tabla y el resumen queden actualizados.

## Añadir o Editar Parte

Si una jornada está cerrada, puedes añadir o editar su parte de trabajo.

Desde el editor de parte puedes:

- Añadir líneas de trabajo.
- Seleccionar empresa o servicio si aplica.
- Guardar el parte.
- Gestionar firma.
- Generar PDF del parte.

Si la jornada no está cerrada o no tiene salida, puede que el botón de parte esté desactivado.

## Expandir o Compactar la Tabla

Cuando hay muchos registros, la tabla aparece en modo compacto.

Puedes usar:

- **Expandir grid:** para ver más altura de tabla.
- **Compactar grid:** para volver a la vista resumida.

En modo compacto puedes desplazarte dentro de la tabla para ver el resto de registros.

## Resumen Equipo

En la columna lateral aparece el bloque **Resumen equipo**.

Sirve para ver rápidamente el estado del día.

Puedes alternar entre:

- Hoy.
- Una fecha manual.

El resumen prioriza incidencias importantes:

1. Personas sin fichar.
2. Bajas.
3. Vacaciones.
4. Jornadas sin parte.

El botón **Ver todos los trabajadores** abre un listado completo del día seleccionado.

## Cumplimiento Semanal

Este panel muestra un calendario visual de cumplimiento de horas.

Los colores ayudan a detectar rápidamente si el equipo cumple o no las horas previstas.

Solo está disponible para periodos cortos:

- Día.
- Semana.
- Mes.

Para trimestre o año, la pantalla mostrará un mensaje indicando que no está disponible.

## Cumplimiento de Partes

Este panel muestra si las jornadas cerradas tienen parte de trabajo creado.

Ayuda a detectar trabajadores o días con fichaje cerrado pero sin parte.

También está disponible solo para:

- Día.
- Semana.
- Mes.

## Calendario de Persona

El calendario lateral aparece cuando seleccionas una persona concreta en el filtro **Persona**.

Sirve para ver el estado de esa persona día por día.

Si no has seleccionado persona, el panel mostrará un mensaje indicando que debes filtrar por una persona.

## Exportar PDF

La pantalla permite exportar información en PDF.

### Exportar Tabla

El botón **Exportar PDF** genera un informe con la tabla actual.

Respeta los filtros aplicados:

- Periodo.
- Empresa.
- Persona.
- Servicio.
- Vista rápida.

### PDF Partes + Fichajes

Este botón aparece solo en algunos casos.

Normalmente necesitas:

- Haber seleccionado una persona concreta.
- Estar en periodo día, semana o mes.
- Tener permisos suficientes.

Genera un PDF agrupado con los fichajes y partes de esa persona.

## Uso Recomendado

Para revisar el estado diario del equipo:

1. Entra en **Fichajes y partes**.
2. Selecciona el periodo que quieres revisar.
3. Usa **Vista rápida > Sin fichar** para detectar ausencias de fichaje.
4. Usa **Vista rápida > Sin parte** para detectar jornadas cerradas sin parte.
5. Revisa la tabla.
6. Corrige o completa fichajes/partes si tienes permisos.
7. Exporta PDF si necesitas guardar o enviar el informe.

## Consejos

- Si buscas una incidencia concreta, usa primero los filtros antes de revisar toda la tabla.
- Si quieres revisar a una persona, selecciona su nombre en el filtro **Persona**.
- Si la tabla parece corta, usa **Expandir grid**.
- Si no ves botones de edición, puede ser por permisos o porque la fecha ya no es editable.
- Si un heatmap no aparece, revisa que el periodo no sea trimestre o año.

## Problemas Habituales

### No veo una persona en el filtro

Puede deberse al filtro de empresa, servicio o permisos del usuario.

### No puedo editar una fila

Puede deberse a:

- No tienes permisos.
- La fecha está fuera de la ventana editable.
- La fila representa un día no laboral o una ausencia especial.

### No aparece el botón de parte

Puede deberse a:

- La jornada no está cerrada.
- No hay hora de salida.
- La fila oculta horas por ser ausencia o no laboral.
- No tienes permisos.

### El PDF de partes + fichajes no aparece

Comprueba que:

- Hay una persona seleccionada.
- El periodo es día, semana o mes.
- Tu usuario tiene permisos.

## Resumen

Esta pantalla sirve para controlar el estado real de fichajes y partes del equipo.

La forma más rápida de trabajar es:

1. Elegir periodo.
2. Filtrar por persona, empresa o servicio si hace falta.
3. Usar vistas rápidas para encontrar incidencias.
4. Revisar o corregir desde la tabla.
5. Exportar si necesitas informe.
