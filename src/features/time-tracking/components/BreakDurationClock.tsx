"use client";

const BREAK_CLOCK_HOURS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const BREAK_CLOCK_MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

/** Reloj circular para elegir duración de descanso (horas + minutos). */
export function BreakDurationClock({
  phase,
  hoursSel,
  minutesSel,
  onPhaseChange,
  onHourChange,
  onMinuteChange,
}: {
  phase: "hour" | "minute";
  hoursSel: number;
  minutesSel: number;
  onPhaseChange: (p: "hour" | "minute") => void;
  onHourChange: (h: number) => void;
  onMinuteChange: (m: number) => void;
}) {
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const rLabels = 92;
  const rHand = 72;

  const opts = phase === "hour" ? BREAK_CLOCK_HOURS : BREAK_CLOCK_MINUTES;
  const selected = phase === "hour" ? hoursSel : minutesSel;
  const idx = opts.indexOf(selected);
  const handAngleDeg = idx >= 0 ? -90 + (360 / opts.length) * idx : -90;

  return (
    <div className="flex flex-col items-center">
      <div className="mb-3 flex rounded-full border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-600 dark:bg-slate-900/50">
        <button
          type="button"
          onClick={() => onPhaseChange("hour")}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
            phase === "hour"
              ? "bg-agro-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300"
          }`}
        >
          Horas
        </button>
        <button
          type="button"
          onClick={() => onPhaseChange("minute")}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
            phase === "minute"
              ? "bg-agro-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300"
          }`}
        >
          Minutos
        </button>
      </div>

      <div className="relative rounded-full bg-gradient-to-b from-slate-50 to-slate-100 p-2 shadow-inner dark:from-slate-800 dark:to-slate-900">
        <svg width={size} height={size} className="block" aria-hidden>
          <circle
            cx={cx}
            cy={cy}
            r={rLabels + 8}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            className="text-slate-200 dark:text-slate-600"
          />
          <circle cx={cx} cy={cy} r={3} className="fill-agro-600" />
          <line
            x1={cx}
            y1={cy}
            x2={cx + rHand * Math.cos((handAngleDeg * Math.PI) / 180)}
            y2={cy + rHand * Math.sin((handAngleDeg * Math.PI) / 180)}
            strokeWidth={3}
            strokeLinecap="round"
            className="stroke-agro-600"
          />
          {opts.map((val, i) => {
            const deg = -90 + (360 / opts.length) * i;
            const rad = (deg * Math.PI) / 180;
            const lx = cx + rLabels * Math.cos(rad);
            const ly = cy + rLabels * Math.sin(rad);
            const isOn = val === selected;
            const onPick = () => {
              if (phase === "hour") onHourChange(val);
              else onMinuteChange(val);
            };
            return (
              <g key={`${phase}-${val}`}>
                <circle
                  cx={lx}
                  cy={ly}
                  r={isOn ? 22 : 18}
                  className={`cursor-pointer transition ${
                    isOn
                      ? "fill-agro-600"
                      : "fill-white stroke-slate-200 dark:fill-slate-700 dark:stroke-slate-500"
                  }`}
                  strokeWidth={isOn ? 0 : 1}
                  onClick={onPick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPick();
                    }
                  }}
                />
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={`pointer-events-none text-[13px] font-semibold select-none ${
                    isOn ? "fill-white" : "fill-slate-700 dark:fill-slate-200"
                  }`}
                >
                  {phase === "minute" && val < 10 ? `0${val}` : val}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
        {phase === "hour"
          ? "Toca un número para las horas de descanso."
          : "Toca un número para los minutos (cada 5 min)."}
      </p>
    </div>
  );
}
