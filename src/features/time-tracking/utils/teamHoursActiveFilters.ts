import type { UseEquipoResult } from "@/features/time-tracking/hooks/useEquipo";

export type TeamHoursActiveFilterChip = {
  id: string;
  /** Texto ya formateado para la UI (ej. `Mes · Mayo de 2026`). */
  text: string;
};

function periodKindShort(eq: UseEquipoResult["equipoPeriodo"]): string {
  switch (eq) {
    case "dia":
      return "Día";
    case "semana":
      return "Semana";
    case "mes":
      return "Mes";
    case "trimestre":
      return "Trimestre";
    case "anio":
      return "Año";
    default:
      return "Periodo";
  }
}

/**
 * Chips de resumen de filtros aplicados en Fichajes del equipo (barra KPI verde).
 * Incluye periodo, alcance (empresa/persona/servicio), vista rápida y mes de tabla en vista anual.
 */
export function buildTeamHoursActiveFilterChips(
  eq: UseEquipoResult,
  periodoEtiqueta: string,
): TeamHoursActiveFilterChip[] {
  const chips: TeamHoursActiveFilterChip[] = [];

  const pk = periodKindShort(eq.equipoPeriodo);
  const periodText = periodoEtiqueta.trim()
    ? `${pk} · ${periodoEtiqueta.trim()}`
    : pk;
  chips.push({ id: "periodo", text: periodText });

  if (eq.equipoPeriodo === "anio") {
    const mesTabla =
      eq.opcionesMesDentroAnioEquipo.find((o) => o.value === eq.equipoAnioMesPagina)?.label ??
      `Mes ${eq.equipoAnioMesPagina}`;
    chips.push({ id: "mesTablaAnio", text: `Tabla · ${mesTabla}` });
  }

  const empresaId = eq.equipoSuperAdminCompanyId?.trim();
  if (empresaId) {
    const name =
      eq.equipoCompaniesCatalog.find((c) => c.id === empresaId)?.name ?? empresaId;
    chips.push({ id: "empresa", text: `Empresa · ${name}` });
  }

  if (eq.filtroPersonaEquipo !== "todas") {
    const name =
      eq.equipoWorkersOpciones.find((w) => w.id === eq.filtroPersonaEquipo)?.name ??
      String(eq.filtroPersonaEquipo);
    chips.push({ id: "persona", text: `Persona · ${name}` });
  }

  const svcId = eq.equipoServiceId?.trim();
  if (svcId) {
    const name =
      eq.equipoServicesCatalog.find((s) => s.id === svcId)?.name ?? svcId;
    chips.push({ id: "servicio", text: `Servicio · ${name}` });
  }

  switch (eq.equipoTablaFiltroExtra) {
    case "soloSinImputar":
      chips.push({ id: "vista", text: "Vista · Sin fichar" });
      break;
    case "soloSinParteServidor":
      chips.push({ id: "vista", text: "Vista · Sin parte" });
      break;
    case "soloConParteServidor":
      chips.push({ id: "vista", text: "Vista · Con parte" });
      break;
    default:
      break;
  }

  return chips;
}
