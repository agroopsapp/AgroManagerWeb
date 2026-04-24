"use client";

import { memo, useCallback, useEffect, useId, useState } from "react";

import { MODAL_BACKDROP_CENTER, modalScrollablePanel } from "@/components/modalShell";

/** Paleta azul: correcto (sólido), manual (más claro), falta (profundo, legible). */
const C_OK = "#2563eb";
const C_MAN = "#38bdf8";
const C_GAP = "#1e3a8a";

type RadialArcProps = {
  cx: number;
  cy: number;
  r: number;
  strokeWidth: number;
  pct: number;
  color: string;
};

function RadialTrack({ cx, cy, r, strokeWidth }: { cx: number; cy: number; r: number; strokeWidth: number }) {
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      className="text-slate-200 dark:text-slate-600"
    />
  );
}

function RadialArc({ cx, cy, r, strokeWidth, pct, color }: RadialArcProps) {
  const C = 2 * Math.PI * r;
  const clamped = Math.min(99.98, Math.max(0, pct));
  const len = (clamped / 100) * C;
  const dash = len <= 0.01 ? `0 ${C}` : `${len} ${C}`;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeDasharray={dash}
      strokeDashoffset={0}
      className="transition-[stroke-dasharray] duration-500 ease-out"
    />
  );
}

function fmtPct(n: number): string {
  if (n <= 0 && n > -0.0001) return "0";
  return n.toLocaleString("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
}

const CHART_GEOM = {
  cx: 100,
  cy: 100,
  stroke: 8,
  gap: 6,
  rOuter: 66,
} as const;

function FichajeTipoRadialChartSvg({
  titleId,
  svgClassName,
  t,
  pOk,
  pMan,
  pGap,
  pctImputadoVsPotencial,
}: {
  titleId: string;
  svgClassName: string;
  t: number;
  pOk: number;
  pMan: number;
  pGap: number;
  pctImputadoVsPotencial: number;
}) {
  const { cx, cy, stroke, gap, rOuter } = CHART_GEOM;
  const rMid = rOuter - stroke - gap;
  const rInner = rMid - stroke - gap;

  return (
    <svg
      viewBox="0 0 200 200"
      className={svgClassName}
      role="img"
      aria-labelledby={titleId}
    >
      <title id={titleId}>
        {t > 0.01
          ? `Distribución de horas: ${fmtPct(pOk)} por ciento correcto, ${fmtPct(pMan)} por ciento manual, ${fmtPct(pGap)} por ciento falta o sin imputar. Imputado frente a potencial: ${pctImputadoVsPotencial} por ciento.`
          : "Sin datos de horas en el filtro actual."}
      </title>
      <g transform={`rotate(90 ${cx} ${cy})`}>
        {t > 0.01 ? (
          <>
            <RadialTrack cx={cx} cy={cy} r={rInner} strokeWidth={stroke} />
            <RadialTrack cx={cx} cy={cy} r={rMid} strokeWidth={stroke} />
            <RadialTrack cx={cx} cy={cy} r={rOuter} strokeWidth={stroke} />
            <RadialArc cx={cx} cy={cy} r={rInner} strokeWidth={stroke} pct={pGap} color={C_GAP} />
            <RadialArc cx={cx} cy={cy} r={rMid} strokeWidth={stroke} pct={pMan} color={C_MAN} />
            <RadialArc cx={cx} cy={cy} r={rOuter} strokeWidth={stroke} pct={pOk} color={C_OK} />
          </>
        ) : (
          <circle
            cx={cx}
            cy={cy}
            r={rMid}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-slate-200 dark:text-slate-600"
          />
        )}
      </g>
    </svg>
  );
}

/**
 * Tres categorías de horas como arcos concéntricos sobre pista gris + leyenda en columnas.
 * Clic en el recuadro del gráfico abre un modal con el mismo dato en formato ampliado.
 */
export const FichajeTipoRadialSummary = memo(function FichajeTipoRadialSummary({
  horasNormal,
  horasManual,
  horasSinImputar,
  registrosNormal,
  registrosManual,
  diasSinImputar,
  bare = false,
  bareStack = false,
}: {
  horasNormal: number;
  horasManual: number;
  horasSinImputar: number;
  registrosNormal: number;
  registrosManual: number;
  diasSinImputar: number;
  bare?: boolean;
  bareStack?: boolean;
}) {
  const titleId = useId();
  const modalTitleId = useId();
  const modalChartTitleId = useId();
  const [detailOpen, setDetailOpen] = useState(false);

  const closeDetail = useCallback(() => setDetailOpen(false), []);

  useEffect(() => {
    if (!detailOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailOpen, closeDetail]);

  const t = horasNormal + horasManual + horasSinImputar;
  const safe = t > 0.01 ? t : 1;
  const pOk = (horasNormal / safe) * 100;
  const pMan = (horasManual / safe) * 100;
  const pGap = (horasSinImputar / safe) * 100;
  const imputadas = horasNormal + horasManual;
  const pctImputadoVsPotencial =
    t > 0.01 ? Math.round((imputadas / t) * 1000) / 10 : 0;
  const totalReg = registrosNormal + registrosManual;

  const shell = bare
    ? "flex w-full min-w-0 max-w-full flex-col"
    : "equipo-dona-card flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border border-slate-200/65 bg-white px-3 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-4 sm:py-4 dark:border-slate-700/75 dark:bg-slate-900/45 dark:shadow-none";

  const legendCols = (
    <div className="mt-4 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-2">
      <div className="flex min-w-0 flex-col rounded-xl border border-blue-200/70 bg-blue-50/90 px-2.5 py-2.5 text-center dark:border-blue-900/50 dark:bg-blue-950/35">
        <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm dark:bg-blue-500">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-xl font-bold tabular-nums leading-none text-blue-900 dark:text-blue-100">
          {fmtPct(pOk)}%
        </p>
        <p className="mt-1.5 text-xs font-semibold leading-snug text-slate-700 dark:text-slate-200">
          Fichaje correcto
        </p>
        <p className="mt-1 text-[11px] tabular-nums leading-snug text-slate-600 dark:text-slate-400">
          {horasNormal.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h · {registrosNormal}{" "}
          reg.
        </p>
      </div>
      <div className="flex min-w-0 flex-col rounded-xl border border-sky-200/80 bg-sky-50/90 px-2.5 py-2.5 text-center dark:border-sky-900/45 dark:bg-sky-950/30">
        <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-sky-500 text-white shadow-sm dark:bg-sky-400 dark:text-sky-950">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path d="M4 14l4-4 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-xl font-bold tabular-nums leading-none text-sky-900 dark:text-sky-100">
          {fmtPct(pMan)}%
        </p>
        <p className="mt-1.5 text-xs font-semibold leading-snug text-slate-700 dark:text-slate-200">
          Manual / corrección
        </p>
        <p className="mt-1 text-[11px] tabular-nums leading-snug text-slate-600 dark:text-slate-400">
          {horasManual.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h · {registrosManual}{" "}
          reg.
        </p>
      </div>
      <div className="flex min-w-0 flex-col rounded-xl border border-slate-300/90 bg-slate-50 px-2.5 py-2.5 text-center dark:border-slate-600 dark:bg-slate-900/60">
        <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-white shadow-sm dark:bg-slate-500">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path d="M4 10l8 8 8-8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-xl font-bold tabular-nums leading-none text-slate-900 dark:text-slate-50">
          {fmtPct(pGap)}%
        </p>
        <p className="mt-1.5 text-xs font-semibold leading-snug text-slate-700 dark:text-slate-200">
          Falta / sin imputar
        </p>
        <p className="mt-1 text-[11px] tabular-nums leading-snug text-slate-600 dark:text-slate-400">
          {horasSinImputar.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
          {diasSinImputar > 0 ? (
            <>
              <br />
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {diasSinImputar} día{diasSinImputar !== 1 ? "s" : ""} sin registro
              </span>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );

  const footnote =
    totalReg > 0 || diasSinImputar > 0 ? (
      <p className="mt-3 rounded-lg bg-slate-100/90 px-2 py-2 text-center text-xs font-medium text-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
        {totalReg} registro{totalReg !== 1 ? "s" : ""} imputados
        {diasSinImputar > 0 ? (
          <>
            {" "}
            <span className="text-slate-400 dark:text-slate-500">·</span>{" "}
            <span className="font-bold text-red-600 dark:text-red-400">{diasSinImputar} sin imputar</span>
          </>
        ) : null}
      </p>
    ) : null;

  const chartHint = (
    <p className="mt-1.5 text-center text-[10px] font-medium text-slate-400 dark:text-slate-500">
      Pulsa para ampliar
    </p>
  );

  const chart = (
    <button
      type="button"
      onClick={() => setDetailOpen(true)}
      className="group flex w-full flex-col items-center rounded-xl border border-slate-200/90 bg-white px-2 py-3 text-left transition hover:border-blue-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-600/80 dark:bg-slate-900/50 dark:hover:border-sky-600/70 dark:focus-visible:ring-offset-slate-900"
      aria-haspopup="dialog"
      aria-expanded={detailOpen}
      aria-label="Ampliar detalle del gráfico de tipo de fichaje"
    >
      <FichajeTipoRadialChartSvg
        titleId={titleId}
        svgClassName="mx-auto h-[10rem] w-[10rem] shrink-0 sm:h-[10.5rem] sm:w-[10.5rem] pointer-events-none"
        t={t}
        pOk={pOk}
        pMan={pMan}
        pGap={pGap}
        pctImputadoVsPotencial={pctImputadoVsPotencial}
      />
      {t > 0.01 ? (
        <p className="mt-1 max-w-[16rem] px-2 text-center text-xs font-semibold text-slate-600 group-hover:text-slate-800 dark:text-slate-300 dark:group-hover:text-slate-100">
          Horas imputadas vs potencial del periodo
        </p>
      ) : (
        <p className="mt-1 max-w-[16rem] px-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
          Sin datos en el filtro
        </p>
      )}
      {chartHint}
    </button>
  );

  const modalRows = (
    <ul className="mt-4 space-y-3">
      <li className="rounded-xl border border-blue-200/80 bg-blue-50/80 px-3 py-3 dark:border-blue-900/50 dark:bg-blue-950/40">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-blue-900 dark:text-blue-100">Fichaje correcto</span>
          <span className="text-2xl font-bold tabular-nums text-blue-800 dark:text-sky-200">{fmtPct(pOk)}%</span>
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {horasNormal.toLocaleString("es-ES", { maximumFractionDigits: 1 })} horas ·{" "}
          <span className="tabular-nums">{registrosNormal}</span> registro{registrosNormal !== 1 ? "s" : ""}
        </p>
      </li>
      <li className="rounded-xl border border-sky-200/80 bg-sky-50/80 px-3 py-3 dark:border-sky-900/45 dark:bg-sky-950/35">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-sky-900 dark:text-sky-100">Manual / corrección</span>
          <span className="text-2xl font-bold tabular-nums text-sky-800 dark:text-sky-200">{fmtPct(pMan)}%</span>
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {horasManual.toLocaleString("es-ES", { maximumFractionDigits: 1 })} horas ·{" "}
          <span className="tabular-nums">{registrosManual}</span> registro{registrosManual !== 1 ? "s" : ""}
        </p>
      </li>
      <li className="rounded-xl border border-slate-300/90 bg-slate-50 px-3 py-3 dark:border-slate-600 dark:bg-slate-900/55">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Falta / sin imputar</span>
          <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{fmtPct(pGap)}%</span>
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {horasSinImputar.toLocaleString("es-ES", { maximumFractionDigits: 1 })} horas
          {diasSinImputar > 0 ? (
            <>
              {" "}
              ·{" "}
              <span className="font-semibold text-red-600 dark:text-red-400">
                {diasSinImputar} día{diasSinImputar !== 1 ? "s" : ""} sin registro en el grid
              </span>
            </>
          ) : null}
        </p>
      </li>
    </ul>
  );

  return (
    <div className={shell}>
      <p
        className={`mb-3 font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100 ${bare ? "text-left text-base sm:text-lg" : "text-center text-sm sm:text-base"}`}
      >
        Tipo de fichaje (incl. días sin imputar)
      </p>
      {bare ? (
        bareStack ? (
          <div className="flex min-h-0 w-full flex-col items-stretch gap-1">
            {chart}
            {legendCols}
            {footnote}
          </div>
        ) : (
          <div className="flex min-h-0 w-full flex-col items-stretch gap-5 lg:flex-row lg:items-start lg:gap-6">
            <div className="flex shrink-0 flex-col items-center justify-center lg:min-w-[12rem]">
              {chart}
            </div>
            <div className="min-w-0 flex-1">
              {legendCols}
              {footnote}
            </div>
          </div>
        )
      ) : (
        <div className="flex min-h-0 flex-col items-stretch gap-1">
          {chart}
          {legendCols}
          {footnote}
        </div>
      )}

      {detailOpen ? (
        <div
          className={`fixed inset-0 z-[130] ${MODAL_BACKDROP_CENTER}`}
          role="presentation"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) closeDetail();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
            className={modalScrollablePanel("lg")}
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-600">
              <div>
                <h2 id={modalTitleId} className="text-lg font-bold text-slate-900 dark:text-slate-50">
                  Tipo de fichaje
                </h2>
                <p className="mt-1 text-sm leading-snug text-slate-600 dark:text-slate-300">
                  Reparto de horas del periodo (correcto, manual y falta frente al potencial). Los tres arcos
                  muestran la proporción de cada categoría; abajo verás el resumen numérico.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDetail}
                className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 flex flex-col items-center rounded-xl border border-slate-200/90 bg-slate-50/50 px-3 py-4 dark:border-slate-600 dark:bg-slate-900/40">
              <FichajeTipoRadialChartSvg
                titleId={modalChartTitleId}
                svgClassName="h-[min(14rem,55vw)] w-[min(14rem,55vw)] max-w-full shrink-0 pointer-events-none sm:h-[15rem] sm:w-[15rem]"
                t={t}
                pOk={pOk}
                pMan={pMan}
                pGap={pGap}
                pctImputadoVsPotencial={pctImputadoVsPotencial}
              />
              {t > 0.01 ? (
                <p className="mt-2 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <span className="tabular-nums text-2xl font-bold text-blue-800 dark:text-sky-200">
                    {pctImputadoVsPotencial}%
                  </span>{" "}
                  horas imputadas vs potencial
                </p>
              ) : (
                <p className="mt-2 text-center text-sm text-slate-500">No hay horas en el filtro actual.</p>
              )}
            </div>

            {t > 0.01 ? modalRows : null}

            {t > 0.01 && footnote ? <div className="mt-4">{footnote}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
});
