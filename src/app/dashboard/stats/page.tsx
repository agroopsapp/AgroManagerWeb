"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { MOCK_TASKS, MOCK_ANIMALS, MOCK_USERS, MOCK_FARMS, MOCK_ROLES, MOCK_ANIMAL_CASES } from "@/data/mock";
import DatePicker from "@/components/DatePicker";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function parseISO(iso: string) {
  return new Date(iso + "T12:00:00");
}
/** Formato día/mes/año (DD/MM/YYYY) para mostrar fechas */
function formatDDMMYYYY(iso: string): string {
  const d = parseISO(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}
function isDateInRange(dateStr: string, start: string, end: string) {
  return dateStr >= start && dateStr <= end;
}
/** Devuelve [lunes, domingo] de la semana que contiene la fecha */
function getWeekRange(iso: string): [string, string] {
  const d = parseISO(iso);
  const day = d.getDay();
  const monOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + monOffset);
  const mon = d.toISOString().slice(0, 10);
  d.setDate(d.getDate() + 6);
  const sun = d.toISOString().slice(0, 10);
  return [mon, sun];
}

const STATUS_LABELS: Record<string, string> = {
  ready: "Pendientes",
  in_progress: "En desarrollo",
  completed: "Finalizada",
};

const INCIDENT_STATUS_LABELS: Record<string, string> = {
  reported: "Reportado",
  in_treatment: "En tratamiento",
  resolved: "Resuelto",
};

const SEVERITY_LABELS: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};

const COLORS = ["#22c55e", "#eab308", "#3b82f6", "#8b5cf6", "#ec4899"];

type StatsPeriod = "day" | "week";

function StatsDateButton({
  value,
  onChange,
  formatDDMMYYYY,
}: {
  value: string;
  onChange: (v: string) => void;
  formatDDMMYYYY: (iso: string) => string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
      >
        {formatDDMMYYYY(value)}
        <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute left-0 top-full z-50 mt-1">
            <DatePicker
              value={value}
              onChange={(v) => {
                onChange(v);
                setOpen(false);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default function StatsPage() {
  const today = todayISO();
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>("day");
  const [statsDate, setStatsDate] = useState<string>(() => today);

  const [weekStart, weekEnd] = useMemo(() => getWeekRange(statsDate), [statsDate]);

  const filteredTasks = useMemo(() => {
    if (statsPeriod === "day") {
      return MOCK_TASKS.filter((t) => (t.date ?? today) === statsDate);
    }
    return MOCK_TASKS.filter((t) => isDateInRange(t.date ?? today, weekStart, weekEnd));
  }, [statsPeriod, statsDate, weekStart, weekEnd, today]);

  const filteredIncidents = useMemo(() => {
    if (statsPeriod === "day") {
      return MOCK_ANIMAL_CASES.filter((c) => c.date === statsDate);
    }
    return MOCK_ANIMAL_CASES.filter((c) => isDateInRange(c.date, weekStart, weekEnd));
  }, [statsPeriod, statsDate, weekStart, weekEnd]);

  const tasksByStatus = useMemo(() => {
    const count: Record<string, number> = { ready: 0, in_progress: 0, completed: 0 };
    filteredTasks.forEach((t) => {
      count[t.status] = (count[t.status] ?? 0) + 1;
    });
    return Object.entries(count).map(([status, total]) => ({
      name: STATUS_LABELS[status] ?? status,
      total,
      fill: status === "ready" ? COLORS[0] : status === "in_progress" ? COLORS[1] : COLORS[2],
    }));
  }, [filteredTasks]);

  const animalsByFarm = useMemo(() => {
    const byFarm: Record<string, number> = {};
    MOCK_ANIMALS.forEach((a) => {
      const name = MOCK_FARMS.find((f) => f.id === a.farmId)?.name ?? a.farmId;
      byFarm[name] = (byFarm[name] ?? 0) + 1;
    });
    return Object.entries(byFarm).map(([name, total], i) => ({
      name,
      total,
      fill: COLORS[i % COLORS.length],
    }));
  }, []);

  const usersByRole = useMemo(() => {
    const byRole: Record<string, number> = {};
    MOCK_USERS.forEach((u) => {
      const name = MOCK_ROLES.find((r) => r.id === u.roleId)?.name ?? u.roleId;
      byRole[name] = (byRole[name] ?? 0) + 1;
    });
    return Object.entries(byRole).map(([name, value], i) => ({
      name,
      value,
      fill: COLORS[i % COLORS.length],
    }));
  }, []);

  const incidentsByStatus = useMemo(() => {
    const count: Record<string, number> = { reported: 0, in_treatment: 0, resolved: 0 };
    filteredIncidents.forEach((c) => {
      count[c.status] = (count[c.status] ?? 0) + 1;
    });
    return Object.entries(count).map(([status, total]) => ({
      name: INCIDENT_STATUS_LABELS[status] ?? status,
      total,
      fill: status === "reported" ? "#ef4444" : status === "in_treatment" ? "#eab308" : "#22c55e",
    }));
  }, [filteredIncidents]);

  const incidentsBySeverity = useMemo(() => {
    const count: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    filteredIncidents.forEach((c) => {
      count[c.severity] = (count[c.severity] ?? 0) + 1;
    });
    return Object.entries(count)
      .filter(([, total]) => total > 0)
      .map(([severity, value], i) => ({
        name: SEVERITY_LABELS[severity] ?? severity,
        value,
        fill: severity === "critical" ? "#dc2626" : severity === "high" ? "#ea580c" : severity === "medium" ? "#ca8a04" : COLORS[0],
      }));
  }, [filteredIncidents]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Estadísticas</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Resumen visual de tareas, animales, incidentes y trabajadores. Tareas e incidentes se pueden ver por día o por semana.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Ver por:</span>
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 p-0.5">
          <button
            type="button"
            onClick={() => setStatsPeriod("day")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              statsPeriod === "day"
                ? "bg-agro-600 text-white dark:bg-agro-500"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-600"
            }`}
          >
            Día
          </button>
          <button
            type="button"
            onClick={() => setStatsPeriod("week")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              statsPeriod === "week"
                ? "bg-agro-600 text-white dark:bg-agro-500"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-600"
            }`}
          >
            Semana
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {statsPeriod === "day" ? "Fecha:" : "Semana del:"}
          </span>
          <StatsDateButton
            value={statsDate}
            onChange={setStatsDate}
            formatDDMMYYYY={formatDDMMYYYY}
          />
          {statsPeriod === "week" && (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              ({formatDDMMYYYY(weekStart)} → {formatDDMMYYYY(weekEnd)})
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800">
          <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
            Tareas por estado
            <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
              {statsPeriod === "day" ? formatDDMMYYYY(statsDate) : `${formatDDMMYYYY(weekStart)} a ${formatDDMMYYYY(weekEnd)}`}
            </span>
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tasksByStatus} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-600" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "currentColor", fontSize: 12 }}
                  className="text-slate-600 dark:text-slate-400"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "currentColor", fontSize: 12 }}
                  className="text-slate-600 dark:text-slate-400"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--tw-bg-opacity, 1)",
                    border: "1px solid rgb(203 213 225)",
                    borderRadius: "0.5rem",
                  }}
                  labelStyle={{ color: "inherit" }}
                  formatter={(value: unknown) => [typeof value === "number" ? value : 0, "Tareas"]}
                  labelFormatter={(label) => label}
                />
                <Bar dataKey="total" name="Tareas" radius={[4, 4, 0, 0]}>
                  {tasksByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800">
          <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
            Animales por granja
          </h2>
          <div className="h-64 min-h-[200px]">
            {animalsByFarm.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                No hay animales asignados a granjas.
              </p>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={animalsByFarm}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-600" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  domain={[0, "auto"]}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  className="dark:[&_.recharts-cartesian-axis-tick]:fill-slate-400"
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fill: "#475569", fontSize: 12 }}
                  className="dark:[&_.recharts-cartesian-axis-tick]:fill-slate-300"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--tw-bg-opacity, 1)",
                    border: "1px solid rgb(203 213 225)",
                    borderRadius: "0.5rem",
                  }}
                  formatter={(value: unknown) => [typeof value === "number" ? value : 0, "Animales"]}
                />
                <Bar dataKey="total" name="Animales" radius={[0, 4, 4, 0]} minPointSize={8}>
                  {animalsByFarm.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800">
          <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
            Incidentes de animales por estado
            <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
              {statsPeriod === "day" ? formatDDMMYYYY(statsDate) : `${formatDDMMYYYY(weekStart)} a ${formatDDMMYYYY(weekEnd)}`}
            </span>
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incidentsByStatus} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-600" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "currentColor", fontSize: 12 }}
                  className="text-slate-600 dark:text-slate-400"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "currentColor", fontSize: 12 }}
                  className="text-slate-600 dark:text-slate-400"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--tw-bg-opacity, 1)",
                    border: "1px solid rgb(203 213 225)",
                    borderRadius: "0.5rem",
                  }}
                  formatter={(value: unknown) => [typeof value === "number" ? value : 0, "Incidentes"]}
                  labelFormatter={(label) => label}
                />
                <Bar dataKey="total" name="Incidentes" radius={[4, 4, 0, 0]}>
                  {incidentsByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800">
          <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
            Incidentes por gravedad
            <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
              {statsPeriod === "day" ? formatDDMMYYYY(statsDate) : `${formatDDMMYYYY(weekStart)} a ${formatDDMMYYYY(weekEnd)}`}
            </span>
          </h2>
          <div className="h-64">
            {incidentsBySeverity.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={incidentsBySeverity}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {incidentsBySeverity.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--tw-bg-opacity, 1)",
                      border: "1px solid rgb(203 213 225)",
                      borderRadius: "0.5rem",
                    }}
                    formatter={(value: unknown, name: unknown): [number, string] => [typeof value === "number" ? value : 0, String(name ?? "")]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400">
                No hay incidentes registrados
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800 lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
            Trabajadores por rol
          </h2>
          <div className="mx-auto h-72 max-w-md">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={usersByRole}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={{ stroke: "currentColor" }}
                >
                  {usersByRole.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--tw-bg-opacity, 1)",
                    border: "1px solid rgb(203 213 225)",
                    borderRadius: "0.5rem",
                  }}
                  formatter={(value: unknown, name: unknown): [number, string] => [typeof value === "number" ? value : 0, String(name ?? "")]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
