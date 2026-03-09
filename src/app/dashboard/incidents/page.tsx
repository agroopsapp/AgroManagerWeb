"use client";

import { useState, useMemo } from "react";
import { MOCK_ANIMAL_CASES, MOCK_ANIMALS, INCIDENT_TEMPLATES } from "@/data/mock";
import type { AnimalCase as AnimalCaseType, IncidentStatus } from "@/types";
import IncidentCard from "@/components/IncidentCard";

type IncidentFormMode = "template" | "custom";

const STATUS_COLUMNS: { status: IncidentStatus; label: string }[] = [
  { status: "reported", label: "Reportado" },
  { status: "in_treatment", label: "En tratamiento" },
  { status: "resolved", label: "Resuelto" },
];

const SEVERITY_OPTIONS: { value: AnimalCaseType["severity"]; label: string }[] = [
  { value: "critical", label: "Crítico" },
  { value: "high", label: "Alto" },
  { value: "medium", label: "Medio" },
  { value: "low", label: "Bajo" },
];

export default function IncidentsPage() {
  const [cases, setCases] = useState<AnimalCaseType[]>(MOCK_ANIMAL_CASES);
  const [modalOpen, setModalOpen] = useState(false);
  const [incidentMode, setIncidentMode] = useState<IncidentFormMode>("template");
  const [formTemplateId, setFormTemplateId] = useState(INCIDENT_TEMPLATES[0]?.id ?? "");
  const [formAnimalId, setFormAnimalId] = useState(MOCK_ANIMALS[0]?.id ?? "");
  const [formCaseType, setFormCaseType] = useState("");
  const [formSummary, setFormSummary] = useState("");
  const [formSeverity, setFormSeverity] = useState<AnimalCaseType["severity"]>("medium");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));

  const selectedTemplate = INCIDENT_TEMPLATES.find((t) => t.id === formTemplateId);

  const casesByStatus = useMemo(() => {
    const map = new Map<IncidentStatus, AnimalCaseType[]>();
    for (const { status } of STATUS_COLUMNS) {
      map.set(status, cases.filter((c) => c.status === status));
    }
    return map;
  }, [cases]);

  const getAnimalName = (animalId: string) =>
    MOCK_ANIMALS.find((a) => a.id === animalId)?.name ?? animalId;

  const handleStatusChange = (caseId: string, newStatus: IncidentStatus) => {
    setCases((prev) =>
      prev.map((c) => (c.id === caseId ? { ...c, status: newStatus } : c))
    );
  };

  const handleDelete = (caseId: string) => {
    setCases((prev) => prev.filter((c) => c.id !== caseId));
  };

  const openCreate = () => {
    setIncidentMode("template");
    setFormTemplateId(INCIDENT_TEMPLATES[0]?.id ?? "");
    const first = INCIDENT_TEMPLATES[0];
    setFormCaseType(first?.caseType ?? "");
    setFormSummary(first?.defaultSummary ?? "");
    setFormAnimalId(MOCK_ANIMALS[0]?.id ?? "");
    setFormSeverity("medium");
    setFormDate(new Date().toISOString().slice(0, 10));
    setModalOpen(true);
  };

  const applyTemplate = (templateId: string) => {
    const t = INCIDENT_TEMPLATES.find((x) => x.id === templateId);
    if (t) {
      setFormCaseType(t.caseType);
      setFormSummary(t.defaultSummary);
    }
  };

  const closeModal = () => setModalOpen(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const caseType = formCaseType.trim();
    const summary = formSummary.trim();
    if (!formAnimalId || !caseType || !summary) return;

    const newCase: AnimalCaseType = {
      id: `c${Date.now()}`,
      animalId: formAnimalId,
      caseType,
      status: "reported",
      summary,
      severity: formSeverity,
      date: formDate,
    };
    setCases((prev) => [...prev, newCase]);
    closeModal();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Incidentes</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Casos por animal. Añade incidentes vinculados a un animal; no todos tienen que tener uno. El estado avanza según evolucione (reportado → en tratamiento → resuelto).
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-agro-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-agro-700"
        >
          Añadir incidente
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {STATUS_COLUMNS.map(({ status, label }) => (
          <div
            key={status}
            className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/50 shadow-sm dark:border-slate-700 dark:bg-slate-800/50"
          >
            <div className="rounded-t-xl border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">{label}</h2>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {(casesByStatus.get(status) ?? []).length} caso(s)
              </p>
            </div>
            <div
              className="min-h-[120px] max-h-[70vh] flex-1 space-y-3 overflow-y-auto p-3"
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
              onDrop={(e) => {
                e.preventDefault();
                const caseId = e.dataTransfer.getData("caseId");
                if (caseId) handleStatusChange(caseId, status);
              }}
            >
              {(casesByStatus.get(status) ?? []).length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">Ninguno</p>
              ) : (
                (casesByStatus.get(status) ?? []).map((c) => (
                  <IncidentCard
                    key={c.id}
                    case={c}
                    animalName={getAnimalName(c.animalId)}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal añadir incidente */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="incident-form-title"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800 dark:border dark:border-slate-600"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="incident-form-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Añadir incidente
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Siempre vinculado a un animal. Elige un tipo preconfigurado o personalizado.
            </p>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label htmlFor="incident-animal" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Animal
                </label>
                <select
                  id="incident-animal"
                  value={formAnimalId}
                  onChange={(e) => setFormAnimalId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                >
                  {MOCK_ANIMALS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.identification || a.id})
                    </option>
                  ))}
                </select>
                {MOCK_ANIMALS.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">No hay animales. Añade primero animales en la sección Animales.</p>
                )}
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de incidente</p>
                <div className="flex gap-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="incidentMode"
                      checked={incidentMode === "template"}
                      onChange={() => {
                        setIncidentMode("template");
                        applyTemplate(formTemplateId);
                      }}
                      className="text-agro-600 focus:ring-agro-500"
                    />
                    <span className="text-sm dark:text-slate-200">Preconfigurado</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="incidentMode"
                      checked={incidentMode === "custom"}
                      onChange={() => setIncidentMode("custom")}
                      className="text-agro-600 focus:ring-agro-500"
                    />
                    <span className="text-sm dark:text-slate-200">Personalizado</span>
                  </label>
                </div>
              </div>

              {incidentMode === "template" ? (
                <div>
                  <label htmlFor="incident-template" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Plantilla
                  </label>
                  <select
                    id="incident-template"
                    value={formTemplateId}
                    onChange={(e) => {
                      setFormTemplateId(e.target.value);
                      applyTemplate(e.target.value);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                  >
                    {INCIDENT_TEMPLATES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.caseType}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {selectedTemplate?.defaultSummary}
                  </p>
                  <div className="mt-2">
                    <label htmlFor="incident-summary-t" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Resumen (puedes editarlo)
                    </label>
                    <textarea
                      id="incident-summary-t"
                      value={formSummary}
                      onChange={(e) => setFormSummary(e.target.value)}
                      required
                      rows={2}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="incident-type" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Tipo de caso
                    </label>
                    <input
                      id="incident-type"
                      type="text"
                      value={formCaseType}
                      onChange={(e) => setFormCaseType(e.target.value)}
                      required
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
                      placeholder="Ej. Cojera, Infección, Control rutinario"
                    />
                  </div>
                  <div>
                    <label htmlFor="incident-summary" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Resumen
                    </label>
                    <textarea
                      id="incident-summary"
                      value={formSummary}
                      onChange={(e) => setFormSummary(e.target.value)}
                      required
                      rows={3}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
                      placeholder="Descripción del problema o seguimiento..."
                    />
                  </div>
                </>
              )}
              <div>
                <label htmlFor="incident-severity" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Gravedad
                </label>
                <select
                  id="incident-severity"
                  value={formSeverity}
                  onChange={(e) => setFormSeverity(e.target.value as AnimalCaseType["severity"])}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                >
                  {SEVERITY_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="incident-date" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Fecha
                </label>
                <input
                  id="incident-date"
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={MOCK_ANIMALS.length === 0}
                  className="rounded-lg bg-agro-600 px-4 py-2 text-sm font-medium text-white hover:bg-agro-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Añadir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
