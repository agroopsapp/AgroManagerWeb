"use client";

/** Dona: imputado (verde), falta (gris), extra (coral). Estilo tipo gráfico circular con leyenda. */
export function HorasMensualesDonut({
  horasImputadoHastaTope,
  horasFalta,
  horasExtra,
  horasObjetivo,
  horasImputadasTotal,
  registrosEnPeriodo,
}: {
  horasImputadoHastaTope: number;
  horasFalta: number;
  horasExtra: number;
  horasObjetivo: number;
  horasImputadasTotal: number;
  registrosEnPeriodo: number;
}) {
  const t = horasImputadoHastaTope + horasFalta + horasExtra;
  const safe = t > 0 ? t : 1;
  const p1 = (horasImputadoHastaTope / safe) * 100;
  const p2 = (horasFalta / safe) * 100;
  const p3 = (horasExtra / safe) * 100;
  const a1 = p1;
  const a2 = a1 + p2;
  let gradient: string;
  /* Paleta app; verdes un poco más saturados para leer bien sobre fondo blanco */
  const cImp = "#16a34a";
  const cFalta = "#94a3b8";
  const cExtra = "#d97706";
  if (horasExtra > 0.01 && horasFalta > 0.01) {
    gradient = `conic-gradient(from -90deg, ${cImp} 0% ${a1}%, ${cFalta} ${a1}% ${a2}%, ${cExtra} ${a2}% 100%)`;
  } else if (horasExtra > 0.01) {
    gradient = `conic-gradient(from -90deg, ${cImp} 0% ${a1}%, ${cExtra} ${a1}% 100%)`;
  } else if (horasFalta > 0.01) {
    gradient = `conic-gradient(from -90deg, ${cImp} 0% ${a1}%, ${cFalta} ${a1}% 100%)`;
  } else {
    gradient = `conic-gradient(from -90deg, ${cImp} 0% 100%)`;
  }
  const pctVsObjetivo =
    horasObjetivo > 0
      ? Math.round((horasImputadasTotal / horasObjetivo) * 1000) / 10
      : 0;

  const leyenda: { color: string; label: string; h: number }[] = [
    { color: cImp, label: "Horas imputadas (hasta tope)", h: horasImputadoHastaTope },
    { color: cFalta, label: "Falta para objetivo", h: horasFalta },
  ];
  if (horasExtra > 0.01) {
    leyenda.push({ color: cExtra, label: "Horas extra", h: horasExtra });
  }

  // Suppress unused variable warning for p3
  void p3;

  return (
    <div className="equipo-dona-card flex min-h-[26rem] w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white px-3 py-4 shadow-sm sm:min-h-[27rem] sm:px-4 sm:py-5 lg:h-full lg:min-h-0 dark:border-slate-600 dark:bg-white">
      <p className="mb-3 min-h-[4rem] text-center text-sm font-semibold leading-snug text-slate-800 sm:mb-4 sm:min-h-[2.75rem] dark:text-slate-900">
        Distribución del mes (objetivo vs imputado)
      </p>
      <div className="flex min-h-0 flex-1 flex-col items-center gap-4 sm:gap-5">
        <div className="relative mx-auto h-40 w-40 shrink-0 sm:h-44 sm:w-44">
          <div
            className="h-full w-full rounded-full shadow-md ring-1 ring-slate-200/80"
            style={{
              background: gradient,
              mask: "radial-gradient(transparent 56%, black 57%)",
              WebkitMask: "radial-gradient(transparent 56%, black 57%)",
            }}
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
            <span className="text-2xl font-bold leading-none tabular-nums text-agro-800 sm:text-3xl dark:text-agro-900">
              {pctVsObjetivo}%
            </span>
            <span className="mt-1 max-w-[6rem] text-[10px] font-medium leading-tight text-slate-500 dark:text-slate-600">
              {pctVsObjetivo > 100 ? "sobre el objetivo" : "del objetivo cubierto"}
            </span>
          </div>
        </div>
        <ul className="mt-auto w-full min-w-0 max-w-full space-y-0 px-0.5 text-sm sm:px-0">
          <li className="flex items-start justify-between gap-3 border-b border-slate-200 py-2.5 dark:border-slate-200">
            <span className="flex min-w-0 flex-1 items-start gap-2.5 pt-0.5">
              <span
                className="mt-0.5 h-3 w-3 shrink-0 rounded-sm border-2 border-slate-500 bg-slate-100 shadow-sm dark:border-slate-400 dark:bg-slate-200"
                aria-hidden
              />
              <span className="text-[13px] font-medium leading-snug text-slate-700 dark:text-slate-800">
                Objetivo teórico
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-base font-bold tabular-nums leading-tight text-slate-900">
                {horasObjetivo.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
              </span>
              <span className="mt-0.5 block min-h-[14px] text-[10px] text-slate-500 dark:text-slate-600">
                tope del mes
              </span>
            </span>
          </li>
          {leyenda.map((item, idx) => (
            <li
              key={item.label}
              className={`flex items-start justify-between gap-3 py-2.5 ${
                idx < leyenda.length - 1 ? "border-b border-slate-200 dark:border-slate-200" : ""
              }`}
            >
              <span className="flex min-w-0 flex-1 items-start gap-2.5 pt-0.5">
                <span
                  className="mt-0.5 h-3 w-3 shrink-0 rounded-sm shadow-sm ring-1 ring-slate-200/80"
                  style={{ backgroundColor: item.color }}
                  aria-hidden
                />
                <span className="text-[13px] leading-snug text-slate-600 dark:text-slate-700">
                  {item.label}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-base font-bold tabular-nums leading-tight text-slate-900">
                  {item.h.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
                </span>
                <span className="mt-0.5 block min-h-[14px] text-[10px] text-slate-500">&nbsp;</span>
              </span>
            </li>
          ))}
          {registrosEnPeriodo > 0 && (
            <li className="border-t border-slate-200 pt-2.5 text-center text-[10px] font-medium text-slate-500 dark:border-slate-200">
              {registrosEnPeriodo} registro{registrosEnPeriodo !== 1 ? "s" : ""} en el periodo
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
