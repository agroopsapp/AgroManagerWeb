"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
} from "framer-motion";
import {
  KpiIconAlert,
  KpiIconClipboardCheck,
  KpiIconClock,
  KpiIconUsers,
} from "@/components/icons/KpiLineIcons";
import type { UseEquipoResult } from "@/features/time-tracking/hooks/useEquipo";
import { TeamHoursKpiDetailModal } from "@/features/time-tracking/components/team-hours/TeamHoursKpiDetailModal";
import {
  effectiveWorkMinutesEntry,
  equipoAbsenceEtiquetaKind,
  timeEntryConParteEnServidor,
} from "@/features/time-tracking/utils/formatters";
import {
  buildTeamHoursKpiDetailRows,
  type TeamHoursKpiDetailKind,
} from "@/features/time-tracking/utils/teamHoursKpiDetail";
import { formatDateEsWeekdayDdMmYyyy, formatMinutesShort } from "@/shared/utils/time";

function AnimatedNumber({
  value,
  format,
  duration = 0.55,
}: {
  value: number;
  format?: (v: number) => string;
  duration?: number;
}) {
  const fmt = format ?? ((v: number) => Math.round(v).toLocaleString("es-ES"));
  const [display, setDisplay] = useState<number>(Number.isFinite(value) ? value : 0);
  useEffect(() => {
    const target = Number.isFinite(value) ? value : 0;
    const controls = animate(display, target, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);
  return <>{fmt(display)}</>;
}

interface TeamHoursEquipoKpiSectionProps {
  eq: UseEquipoResult;
  periodoEtiqueta: string;
  animate: ComponentProps<typeof motion.section>["animate"];
}

const KPI_ROW_PILL =
  "flex w-full items-center gap-2 rounded-full bg-white/8 px-3 py-2 ring-1 ring-white/10";
const KPI_ROW_PILL_BTN =
  " cursor-pointer text-left transition hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 active:scale-[0.99]";

/** Rejilla inferior KPI (icono + cifra): mismo ancho de celda; clic en toda la tarjeta en día/semana/mes. */
const KPI_GRID_CARD =
  "flex min-w-0 w-full flex-col items-center text-center rounded-2xl px-2 py-2 outline-none";
const KPI_GRID_CARD_BTN =
  " cursor-pointer transition hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 active:scale-[0.98]";

export function TeamHoursEquipoKpiSection({
  eq,
  periodoEtiqueta,
  animate: animateControls,
}: TeamHoursEquipoKpiSectionProps) {
  const [kpiDetailModal, setKpiDetailModal] = useState<TeamHoursKpiDetailKind | null>(null);

  /** Detalle por persona/día: solo periodos que usan filas de tabla densas (no trimestre/año agregado). */
  const kpiRowsInteractive =
    eq.equipoPeriodo === "dia" ||
    eq.equipoPeriodo === "semana" ||
    eq.equipoPeriodo === "mes";

  const kpiDetailRows = useMemo(() => {
    if (!kpiDetailModal || !kpiRowsInteractive) return [];
    return buildTeamHoursKpiDetailRows(
      eq.equipoFilasVista,
      eq.resolveEquipoPersonaNombre,
      kpiDetailModal,
    ).map((r) => ({
      nombre: r.nombre,
      fechaLabel: formatDateEsWeekdayDdMmYyyy(r.fechaIso),
      detalle: r.detalle,
    }));
  }, [kpiDetailModal, kpiRowsInteractive, eq.equipoFilasVista, eq.resolveEquipoPersonaNombre]);

  const cumplimientoPct = useMemo(() => {
    const objetivo = Number(eq.horasObjetivoMesTeorico ?? 0);
    const imputadas = Number(eq.horasImputadasDecimal ?? 0);
    if (!objetivo || objetivo <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((imputadas / objetivo) * 100)));
  }, [eq.horasImputadasDecimal, eq.horasObjetivoMesTeorico]);

  const cumplimientoMv = useMotionValue(cumplimientoPct);
  useEffect(() => {
    const controls = animate(cumplimientoMv, cumplimientoPct, {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [cumplimientoPct, cumplimientoMv]);
  const cumplimientoRingBg = useTransform(
    cumplimientoMv,
    (v) => `conic-gradient(#4ade80 ${v * 3.6}deg, rgba(255,255,255,0.10) 0deg)`,
  );

  const kpiScope = useMemo(() => {
    if (eq.equipoPeriodo === "anio" && eq.equipoSummary?.kpiTeamGrid) {
      const g = eq.equipoSummary.kpiTeamGrid;
      const jornadasLaborables = Math.max(0, Math.round(g.laborablePersonDaySlots ?? 0));
      const jornadasFichadas = Math.max(
        0,
        Math.round(
          (g.slotsWithAnyTimeEntry > 0 ? g.slotsWithAnyTimeEntry : g.slotsWithClosedTimeEntry) ?? 0,
        ),
      );
      const sinFichar = Math.max(0, Math.round(g.slotsWithoutEntry ?? 0));
      const jornadasCerradas = Math.max(0, Math.round(g.slotsWithClosedTimeEntry ?? 0));
      const partesCompletados = Math.max(0, Math.round(g.closedEntriesWithServerPart ?? 0));
      const sinParte = Math.max(0, Math.round(g.closedEntriesWithoutServerPart ?? 0));
      const minutosImputados = Math.max(0, Math.round(eq.equipoSummary.workedMinutesTotal ?? 0));

      const jornadasFichadasPct =
        jornadasLaborables > 0 ? Math.round((jornadasFichadas / jornadasLaborables) * 100) : 0;
      const partesPct =
        jornadasCerradas > 0 ? Math.round((partesCompletados / jornadasCerradas) * 100) : 0;

      return {
        haFichado: jornadasFichadas,
        sinFichar,
        vacaciones: 0,
        sinParte,
        minutosImputados,
        jornadasLaborables,
        jornadasFichadas,
        jornadasCerradas,
        partesCompletados,
        jornadasFichadasPct,
        partesPct,
      };
    }

    let haFichado = 0;
    let sinFichar = 0;
    let vacaciones = 0;
    let sinParte = 0;
    let jornadasLaborables = 0;
    let jornadasFichadas = 0;
    let jornadasCerradas = 0;
    let partesCompletados = 0;
    let minutosImputados = 0;

    for (const fila of eq.equipoFilasVista) {
      if (fila.kind === "sinImputar") {
        sinFichar += 1;
        jornadasLaborables += 1;
        continue;
      }
      if (fila.kind !== "registro") continue;

      jornadasLaborables += 1;
      jornadasFichadas += 1;
      haFichado += 1;

      const e = fila.e;
      const ausencia = equipoAbsenceEtiquetaKind(e);
      if (ausencia === "vacaciones") vacaciones += 1;

      if (e.checkOutUtc) {
        jornadasCerradas += 1;
        if (timeEntryConParteEnServidor(e)) partesCompletados += 1;
        else sinParte += 1;
      }

      minutosImputados += effectiveWorkMinutesEntry(e);
    }

    const jornadasFichadasPct =
      jornadasLaborables > 0 ? Math.round((jornadasFichadas / jornadasLaborables) * 100) : 0;
    const partesPct =
      jornadasCerradas > 0 ? Math.round((partesCompletados / jornadasCerradas) * 100) : 0;

    return {
      haFichado,
      sinFichar,
      vacaciones,
      sinParte,
      minutosImputados,
      jornadasLaborables,
      jornadasFichadas,
      jornadasCerradas,
      partesCompletados,
      jornadasFichadasPct,
      partesPct,
    };
  }, [eq.equipoFilasVista, eq.equipoPeriodo, eq.equipoSummary]);

  return (
    <motion.section
      className="agro-surface rounded-3xl overflow-hidden"
      initial={{ opacity: 1, y: 0 }}
      animate={animateControls}
    >
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-950 via-emerald-950 to-emerald-900 px-5 py-5 text-emerald-50">
        <div
          className="absolute inset-0 scale-[1.08] bg-center bg-cover opacity-[0.38] blur-[6px] saturate-[1.08] contrast-[1.03]"
          style={{ backgroundImage: "url('/login-bg.png')" }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-emerald-950/35" aria-hidden />
        <div className="absolute inset-0 opacity-[0.14]" aria-hidden>
          <div className="h-full w-full bg-[radial-gradient(circle_at_20%_30%,rgba(74,222,128,0.35),transparent_50%),radial-gradient(circle_at_80%_40%,rgba(34,197,94,0.25),transparent_45%),linear-gradient(to_bottom,rgba(255,255,255,0.06),transparent)]" />
        </div>

        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200/85">
            {(() => {
              const nombrePersona =
                eq.filtroPersonaEquipo !== "todas"
                  ? eq.equipoWorkersOpciones.find((w) => w.id === eq.filtroPersonaEquipo)?.name ??
                    String(eq.filtroPersonaEquipo)
                  : null;
              const sujeto = nombrePersona ? `Estado de ${nombrePersona}` : "Estado del equipo";
              switch (eq.equipoPeriodo) {
                case "dia":
                  return `${sujeto} · Día`;
                case "semana":
                  return `${sujeto} · Semana`;
                case "mes":
                  return `${sujeto} · Mes`;
                case "trimestre":
                  return `${sujeto} · Trimestre`;
                case "anio":
                  return `${sujeto} · Año`;
                default:
                  return sujeto;
              }
            })()}
            {periodoEtiqueta ? (
              <span className="ml-2 normal-case tracking-normal text-emerald-100/70">
                · {periodoEtiqueta}
              </span>
            ) : null}
          </p>

          <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[26rem_1px_minmax(0,1fr)] lg:items-center">
            <div className="flex items-center gap-6">
              <motion.div
                className="relative h-[148px] w-[148px] shrink-0 rounded-full p-[12px]"
                style={{ background: cumplimientoRingBg }}
              >
                <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-emerald-950/70 ring-1 ring-white/10">
                  <span className="text-4xl font-semibold tracking-tight tabular-nums text-white">
                    <AnimatedNumber value={cumplimientoPct} format={(v) => `${Math.round(v)}%`} />
                  </span>
                  <span className="mt-1 text-[11px] font-semibold leading-tight text-emerald-50/80">
                    Cumplimiento
                    <br />
                    {(() => {
                      switch (eq.equipoPeriodo) {
                        case "dia":
                          return "del día";
                        case "semana":
                          return "de la semana";
                        case "mes":
                          return "del mes";
                        case "trimestre":
                          return "del trimestre";
                        case "anio":
                          return "del año";
                        default:
                          return "del periodo";
                      }
                    })()}
                  </span>
                </div>
              </motion.div>

              <div className="min-w-0 flex-1 space-y-2">
                {kpiRowsInteractive ? (
                  <button
                    type="button"
                    className={`${KPI_ROW_PILL}${KPI_ROW_PILL_BTN}`}
                    aria-haspopup="dialog"
                    onClick={() => setKpiDetailModal("haFichado")}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden />
                    <span className="tabular-nums font-semibold text-white">
                      <AnimatedNumber value={kpiScope.haFichado} />
                    </span>
                    <span className="text-sm text-emerald-50/80">Ha fichado</span>
                  </button>
                ) : (
                  <div className={KPI_ROW_PILL}>
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden />
                    <span className="tabular-nums font-semibold text-white">
                      <AnimatedNumber value={kpiScope.haFichado} />
                    </span>
                    <span className="text-sm text-emerald-50/80">Ha fichado</span>
                  </div>
                )}
                {kpiRowsInteractive ? (
                  <button
                    type="button"
                    className={`${KPI_ROW_PILL}${KPI_ROW_PILL_BTN}`}
                    aria-haspopup="dialog"
                    onClick={() => setKpiDetailModal("sinFichar")}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full bg-rose-400" aria-hidden />
                    <span className="tabular-nums font-semibold text-white">
                      <AnimatedNumber value={kpiScope.sinFichar} />
                    </span>
                    <span className="text-sm text-emerald-50/80">Sin fichar</span>
                  </button>
                ) : (
                  <div className={KPI_ROW_PILL}>
                    <span className="h-2 w-2 shrink-0 rounded-full bg-rose-400" aria-hidden />
                    <span className="tabular-nums font-semibold text-white">
                      <AnimatedNumber value={kpiScope.sinFichar} />
                    </span>
                    <span className="text-sm text-emerald-50/80">Sin fichar</span>
                  </div>
                )}
                {kpiRowsInteractive ? (
                  <button
                    type="button"
                    className={`${KPI_ROW_PILL}${KPI_ROW_PILL_BTN}`}
                    aria-haspopup="dialog"
                    onClick={() => setKpiDetailModal("vacaciones")}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400" aria-hidden />
                    <span className="tabular-nums font-semibold text-white">
                      <AnimatedNumber value={kpiScope.vacaciones} />
                    </span>
                    <span className="text-sm text-emerald-50/80">Vacaciones</span>
                  </button>
                ) : (
                  <div className={KPI_ROW_PILL}>
                    <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400" aria-hidden />
                    <span className="tabular-nums font-semibold text-white">
                      <AnimatedNumber value={kpiScope.vacaciones} />
                    </span>
                    <span className="text-sm text-emerald-50/80">Vacaciones</span>
                  </div>
                )}
                {kpiRowsInteractive ? (
                  <button
                    type="button"
                    className={`${KPI_ROW_PILL}${KPI_ROW_PILL_BTN}`}
                    aria-haspopup="dialog"
                    onClick={() => setKpiDetailModal("sinParte")}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden />
                    <span className="tabular-nums font-semibold text-white">
                      <AnimatedNumber value={kpiScope.sinParte} />
                    </span>
                    <span className="text-sm text-emerald-50/80">Sin parte</span>
                  </button>
                ) : (
                  <div className={KPI_ROW_PILL}>
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden />
                    <span className="tabular-nums font-semibold text-white">
                      <AnimatedNumber value={kpiScope.sinParte} />
                    </span>
                    <span className="text-sm text-emerald-50/80">Sin parte</span>
                  </div>
                )}
              </div>
            </div>

            <div className="hidden h-24 w-px bg-white/12 lg:block" aria-hidden />

            <div className="min-w-0">
              <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
                {kpiRowsInteractive ? (
                  <button
                    type="button"
                    className={`${KPI_GRID_CARD}${KPI_GRID_CARD_BTN}`}
                    aria-haspopup="dialog"
                    onClick={() => setKpiDetailModal("horasImputadas")}
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/5">
                      <KpiIconClock className="text-white/85" />
                    </div>
                    <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-white">
                      <AnimatedNumber
                        value={kpiScope.minutosImputados}
                        format={(v) => formatMinutesShort(Math.round(v))}
                      />
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-emerald-50/90">Horas imputadas</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-emerald-50/70">
                      de {Number(eq.horasObjetivoMesTeorico ?? 0).toLocaleString("es-ES")} h objetivo
                    </p>
                  </button>
                ) : (
                  <div className={`${KPI_GRID_CARD} pointer-events-none`}>
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/5">
                      <KpiIconClock className="text-white/85" />
                    </div>
                    <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-white">
                      <AnimatedNumber
                        value={kpiScope.minutosImputados}
                        format={(v) => formatMinutesShort(Math.round(v))}
                      />
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-emerald-50/90">Horas imputadas</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-emerald-50/70">
                      de {Number(eq.horasObjetivoMesTeorico ?? 0).toLocaleString("es-ES")} h objetivo
                    </p>
                  </div>
                )}

                {kpiRowsInteractive ? (
                  <button
                    type="button"
                    className={`${KPI_GRID_CARD}${KPI_GRID_CARD_BTN}`}
                    aria-haspopup="dialog"
                    onClick={() => setKpiDetailModal("jornadasFichadas")}
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/5">
                      <KpiIconUsers className="text-white/85" />
                    </div>
                    <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-white">
                      <AnimatedNumber value={kpiScope.jornadasFichadas} />{" "}
                      <span className="text-white/70">/</span>{" "}
                      <AnimatedNumber value={kpiScope.jornadasLaborables} />
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-emerald-50/90">Jornadas fichadas</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-emerald-50/70">
                      <AnimatedNumber
                        value={kpiScope.jornadasFichadasPct}
                        format={(v) => `${Math.round(v)}`}
                      />
                      % del equipo
                    </p>
                  </button>
                ) : (
                  <div className={`${KPI_GRID_CARD} pointer-events-none`}>
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/5">
                      <KpiIconUsers className="text-white/85" />
                    </div>
                    <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-white">
                      <AnimatedNumber value={kpiScope.jornadasFichadas} />{" "}
                      <span className="text-white/70">/</span>{" "}
                      <AnimatedNumber value={kpiScope.jornadasLaborables} />
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-emerald-50/90">Jornadas fichadas</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-emerald-50/70">
                      <AnimatedNumber
                        value={kpiScope.jornadasFichadasPct}
                        format={(v) => `${Math.round(v)}`}
                      />
                      % del equipo
                    </p>
                  </div>
                )}

                {kpiRowsInteractive ? (
                  <button
                    type="button"
                    className={`${KPI_GRID_CARD}${KPI_GRID_CARD_BTN}`}
                    aria-haspopup="dialog"
                    onClick={() => setKpiDetailModal("partesCompletados")}
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/5">
                      <KpiIconClipboardCheck className="text-white/85" />
                    </div>
                    <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-white">
                      <AnimatedNumber value={kpiScope.partesCompletados} />{" "}
                      <span className="text-white/70">/</span>{" "}
                      <AnimatedNumber value={kpiScope.jornadasCerradas} />
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-emerald-50/90">
                      Partes completados
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-emerald-50/70">
                      <AnimatedNumber value={kpiScope.partesPct} format={(v) => `${Math.round(v)}`} />
                      % del equipo
                    </p>
                  </button>
                ) : (
                  <div className={`${KPI_GRID_CARD} pointer-events-none`}>
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/5">
                      <KpiIconClipboardCheck className="text-white/85" />
                    </div>
                    <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-white">
                      <AnimatedNumber value={kpiScope.partesCompletados} />{" "}
                      <span className="text-white/70">/</span>{" "}
                      <AnimatedNumber value={kpiScope.jornadasCerradas} />
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-emerald-50/90">
                      Partes completados
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-emerald-50/70">
                      <AnimatedNumber value={kpiScope.partesPct} format={(v) => `${Math.round(v)}`} />
                      % del equipo
                    </p>
                  </div>
                )}

                {kpiRowsInteractive ? (
                  <button
                    type="button"
                    className={`${KPI_GRID_CARD}${KPI_GRID_CARD_BTN}`}
                    aria-haspopup="dialog"
                    onClick={() => setKpiDetailModal("sinImputarMetric")}
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/5">
                      <KpiIconAlert className="text-white/85" />
                    </div>
                    <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-white">
                      <AnimatedNumber value={kpiScope.sinFichar} />
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-emerald-50/90">Sin imputar</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-emerald-50/70">
                      requiere revisión
                    </p>
                  </button>
                ) : (
                  <div className={`${KPI_GRID_CARD} pointer-events-none`}>
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/5">
                      <KpiIconAlert className="text-white/85" />
                    </div>
                    <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-white">
                      <AnimatedNumber value={kpiScope.sinFichar} />
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-emerald-50/90">Sin imputar</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-emerald-50/70">
                      requiere revisión
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <TeamHoursKpiDetailModal
        open={kpiDetailModal !== null}
        onClose={() => setKpiDetailModal(null)}
        variant={kpiDetailModal}
        periodoEtiqueta={periodoEtiqueta}
        rows={kpiDetailRows}
      />
    </motion.section>
  );
}
