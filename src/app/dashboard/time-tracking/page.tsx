"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateES, workDateIsWeekend } from "@/shared/utils/time";
import { ClockPanel } from "@/features/time-tracking/components/ClockPanel";
import { HistorialPersonal } from "@/features/time-tracking/components/HistorialPersonal";
import { PersonalEditarDiaModal } from "@/features/time-tracking/components/PersonalEditarDiaModal";
import { useFichadorPanel } from "@/features/time-tracking/hooks/useFichadorPanel";
import { useFichaje } from "@/features/time-tracking/hooks/useFichaje";
import { useBreakModal } from "@/features/time-tracking/hooks/useBreakModal";
import { useForgotModal } from "@/features/time-tracking/hooks/useForgotModal";
import { useAyerCompleta } from "@/features/time-tracking/hooks/useAyerCompleta";
import type { TimeEntryMock } from "@/features/time-tracking/types";
import { workReportsApi } from "@/services/work-reports.service";

const AyerCompletaModal = dynamic(
  () => import("@/features/time-tracking/components/AyerCompletaModal").then((m) => m.AyerCompletaModal),
  { ssr: false },
);
const ForgotModal = dynamic(
  () => import("@/features/time-tracking/components/ForgotModal").then((m) => m.ForgotModal),
  { ssr: false },
);
const BreakModal = dynamic(
  () => import("@/features/time-tracking/components/BreakModal").then((m) => m.BreakModal),
  { ssr: false },
);

export default function TimeTrackingPage() {
  const { user, isReady } = useAuth();
  const [personalEditarDiaWorkDate, setPersonalEditarDiaWorkDate] = useState<string | null>(null);

  // --- Hooks ---
  const panel = useFichadorPanel({ user, isReady });
  const fichaje = useFichaje({ user, isReady, miWorkerId: panel.miWorkerId });
  const breakModal = useBreakModal({
    openEntry: fichaje.openEntry,
    entries: fichaje.entries,
    setEntries: fichaje.setEntries,
    miWorkerId: panel.miWorkerId,
  });
  const forgotModal = useForgotModal({
    miWorkerId: panel.miWorkerId,
    user,
    entries: fichaje.entries,
    setEntries: fichaje.setEntries,
    setWorkPartOverrideEntry: breakModal.setWorkPartOverrideEntry,
    setWorkPartLines: breakModal.setWorkPartLines,
    setRestModalStep: breakModal.setRestModalStep,
  });
  const ayerCompleta = useAyerCompleta({
    miWorkerId: panel.miWorkerId,
    user,
    entries: fichaje.entries,
    setEntries: fichaje.setEntries,
  });

  // --- Thin orchestration handlers ---
  const handleCheckOut = async () => {
    if (!fichaje.openEntry) return;
    breakModal.openAskRest();
  };

  const handleOpenPartEditorFromHistory = async (entry: TimeEntryMock) => {
    if (!entry.checkOutUtc) {
      fichaje.setError("Para crear o editar parte, la jornada debe tener salida.");
      return;
    }
    if (!entry.timeEntryId) {
      fichaje.setError("Falta timeEntryId en el fichaje. No se puede crear/cargar el parte.");
      return;
    }
    if (!entry.userId) {
      fichaje.setError("Falta userId en el fichaje. No se puede crear/cargar el parte.");
      return;
    }
    if (!entry.companyId) {
      fichaje.setError("Falta companyId en el fichaje. No se puede crear/cargar el parte.");
      return;
    }

    breakModal.setWorkPartModalMode(entry.workReportId ? "edit" : "create");
    breakModal.setWorkPartError(null);
    breakModal.setWorkPartSignatureTemp(null);
    breakModal.setWorkPartSignatureDialogOpen(false);
    if (entry.workReportId) {
      try {
        const report = await workReportsApi.getByIdWithLines(entry.workReportId);
        const reportLines = report.lines.map((line, idx) => {
          const lineId =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `ln-${Date.now()}-${idx}`;
          return {
            lineId,
            companyId: line.clientCompanyId,
            serviceId: line.serviceId,
            areaId: line.workAreaId,
          };
        });
        breakModal.setWorkPartLines(
          reportLines.length > 0
            ? reportLines
            : [
                {
                  lineId:
                    typeof crypto !== "undefined" && "randomUUID" in crypto
                      ? crypto.randomUUID()
                      : `ln-${Date.now()}`,
                  companyId: report.companyId,
                  serviceId: "",
                  areaId: "",
                },
              ],
        );
        breakModal.setWorkPartSignatureTemp(report.signatureUrl ?? null);
        breakModal.setWorkPartOverrideEntry({
          workDate: report.workDate || entry.workDate,
          workerId: entry.workerId,
          companyId: (report.companyId || entry.companyId) ?? null,
          timeEntryId: (report.timeEntryId || entry.timeEntryId) ?? null,
          userId: (report.userId || entry.userId) ?? null,
          workReportId: entry.workReportId,
          checkInUtc: entry.checkInUtc,
          checkOutUtc: entry.checkOutUtc,
          breakMinutes: entry.breakMinutes ?? 0,
        });
      } catch {
        breakModal.setWorkPartError(
          "No se pudieron cargar las líneas del parte. Puedes revisarlo y guardarlo manualmente."
        );
        breakModal.setWorkPartLines([
          {
            lineId:
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `ln-${Date.now()}`,
            companyId: entry.companyId ?? "",
            serviceId: "",
            areaId: "",
          },
        ]);
        breakModal.setWorkPartOverrideEntry({
          workDate: entry.workDate,
          workerId: entry.workerId,
          companyId: entry.companyId ?? null,
          timeEntryId: entry.timeEntryId ?? null,
          userId: entry.userId ?? null,
          workReportId: entry.workReportId ?? null,
          checkInUtc: entry.checkInUtc,
          checkOutUtc: entry.checkOutUtc,
          breakMinutes: entry.breakMinutes ?? 0,
        });
      }
    } else {
      breakModal.setWorkPartLines([
        {
          lineId:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `ln-${Date.now()}`,
          companyId: entry.companyId ?? "",
          serviceId: "",
          areaId: "",
        },
      ]);
      breakModal.setWorkPartOverrideEntry({
        workDate: entry.workDate,
        workerId: entry.workerId,
        companyId: entry.companyId ?? null,
        timeEntryId: entry.timeEntryId ?? null,
        userId: entry.userId ?? null,
        workReportId: entry.workReportId ?? null,
        checkInUtc: entry.checkInUtc,
        checkOutUtc: entry.checkOutUtc,
        breakMinutes: entry.breakMinutes ?? 0,
      });
    }
    breakModal.setRestModalStep("workPart");
  };

  const olvideFicharBotonActivo =
    !fichaje.hasEntryForDate(fichaje.today) &&
    forgotModal.forgotStep === "closed" &&
    fichaje.actionLoading === null;

  const handleOpenEditarDiaMenuFromHistory = (workDate: string) => {
    setPersonalEditarDiaWorkDate(workDate);
  };

  const personaLabelHistorial =
    user?.email?.split("@")[0]?.trim() || user?.email?.trim() || "Usuario";

  // --- Render ---
  return (
    <div className="min-w-0 max-w-full space-y-6">
      {breakModal.workPartSuccessMessage && (
        <div className="fixed left-1/2 top-1/2 z-[9999] w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-emerald-200/90 bg-emerald-50 px-5 py-4 text-center text-sm font-semibold text-emerald-900 shadow-[0_24px_48px_-12px_rgba(5,150,105,0.35)] dark:border-emerald-700/80 dark:bg-emerald-950/95 dark:text-emerald-100">
          {breakModal.workPartSuccessMessage}
        </div>
      )}

      {/* Cabecera: legible en cualquier tema, acento de marca sin barra verde plana */}
      <header className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white px-5 py-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:px-8 sm:py-7 dark:border-slate-700/80 dark:bg-slate-900/90 dark:shadow-none">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-agro-500 via-emerald-500 to-teal-500"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-16 -top-24 h-48 w-48 rounded-full bg-agro-500/[0.07] blur-3xl dark:bg-agro-400/10"
          aria-hidden
        />
        <div className="relative flex flex-col gap-5 pl-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-agro-600 dark:text-agro-400">
              Registro de jornada
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Fichador
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Marca tu entrada y salida de forma sencilla y cumpliendo el registro horario.
            </p>
            <Link
              href="/dashboard/time-tracking/vacaciones-y-festivos"
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-agro-700 underline-offset-2 hover:text-agro-800 hover:underline dark:text-agro-400 dark:hover:text-agro-300"
            >
              <span aria-hidden>📅</span>
              Ver calendario de vacaciones y festivos
            </Link>
          </div>
          {user && (
            <div className="flex min-w-0 shrink-0 flex-col gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-3 dark:border-slate-600/80 dark:bg-slate-800/60">
              <span className="max-w-[min(100%,18rem)] truncate text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Sesión
              </span>
              <span className="max-w-full truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                {user.email}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Hoy: <span className="font-medium text-slate-700 dark:text-slate-300">{formatDateES(fichaje.today)}</span>
              </span>
            </div>
          )}
        </div>
      </header>

      {ayerCompleta.hayDiasSinCuadrarEnHistorico && (
        <div
          className="sticky top-2 z-30 flex min-w-0 max-w-full gap-3 rounded-2xl border border-rose-200/80 bg-rose-50/90 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-rose-800/60 dark:bg-rose-950/50 sm:px-5 sm:py-3.5"
          role="status"
        >
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-lg dark:bg-rose-900/50"
            aria-hidden
          >
            ⚠
          </span>
          <p className="min-w-0 text-sm leading-relaxed text-rose-950 dark:text-rose-100">
            <span className="font-semibold">Histórico:</span> hay días laborables sin fichaje correcto
            (aparecen en rojo en la tabla).{" "}
            <strong>Habla con el administrador</strong> para cuadrar las horas laborales.
          </p>
        </div>
      )}

      {/* Un solo “módulo” visual: columna de acción + tabla comparten marco, acento y fondos */}
      <div className="min-w-0 max-w-full overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_2px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/60 dark:border-slate-700/80 dark:bg-slate-900/95 dark:shadow-none dark:ring-slate-700/80">
        <div
          className="h-1 w-full bg-gradient-to-r from-agro-500 via-emerald-500 to-teal-500"
          aria-hidden
        />
        <div className="grid min-w-0 lg:grid-cols-[minmax(280px,19rem)_minmax(0,1fr)] xl:grid-cols-[minmax(300px,21rem)_minmax(0,1fr)]">
          <aside
            aria-label="Fichaje y resumen del día"
            className="min-w-0 border-b border-slate-100 bg-gradient-to-b from-slate-50/90 to-slate-50/40 p-4 sm:p-5 lg:border-b-0 lg:border-r dark:border-slate-800 dark:from-slate-950/50 dark:to-slate-950/25"
          >
            <ClockPanel
              hasOpenEntry={fichaje.hasOpenEntry}
              openEntry={fichaje.openEntry}
              jornadaCompletadaHoy={fichaje.jornadaCompletadaHoy}
              closedTodayEntry={fichaje.closedTodayEntry}
              actionLoading={fichaje.actionLoading}
              forgotStep={forgotModal.forgotStep}
              olvideFicharBotonActivo={olvideFicharBotonActivo}
              onCheckIn={fichaje.handleCheckIn}
              onCheckOut={handleCheckOut}
              onOpenForgotModal={forgotModal.openForgotModal}
              hayDiasSinCuadrarEnHistorico={ayerCompleta.hayDiasSinCuadrarEnHistorico}
              ultimoLaboralSinCerrar={ayerCompleta.ultimoLaboralSinCerrar}
              ayerCompStep={ayerCompleta.ayerCompStep}
              onAbrirCompletarAyer={ayerCompleta.abrirCompletarAyer}
              error={fichaje.error}
              loading={fichaje.loading}
              todayEntriesPersonal={fichaje.todayEntriesPersonal}
              sessionEmail={user?.email}
            />
          </aside>

          <div className="min-w-0 bg-white dark:bg-slate-900/95">
            <HistorialPersonal
              loading={fichaje.loading}
              historicoPersonalFilas={fichaje.historicoPersonalFilas}
              hasAnyEntries={fichaje.entries.length > 0}
              onOpenPartEditor={handleOpenPartEditorFromHistory}
              onOpenEditarDiaMenu={handleOpenEditarDiaMenuFromHistory}
            />
          </div>
        </div>
      </div>

      {/* Modal: completar registro de ayer */}
      {ayerCompleta.ayerCompStep !== "closed" &&
        ayerCompleta.ultimoLaboralSinCerrar &&
        ayerCompleta.registroAyerParcial && (
          <AyerCompletaModal
            step={ayerCompleta.ayerCompStep}
            fechaAyerEtiqueta={ayerCompleta.fechaAyerEtiqueta}
            ayerManStart={ayerCompleta.ayerManStart}
            ayerManEnd={ayerCompleta.ayerManEnd}
            ayerCompOtroH={ayerCompleta.ayerCompOtroH}
            ayerCompOtroM={ayerCompleta.ayerCompOtroM}
            ayerMinutosBrutos={ayerCompleta.ayerMinutosBrutos}
            error={ayerCompleta.ayerCompError}
            onClose={ayerCompleta.resetAyerCompletaModal}
            onSetStep={ayerCompleta.setAyerCompStep}
            onSetManStart={ayerCompleta.setAyerManStart}
            onSetManEnd={ayerCompleta.setAyerManEnd}
            onSetError={ayerCompleta.setAyerCompError}
            onSetOtroH={ayerCompleta.setAyerCompOtroH}
            onSetOtroM={ayerCompleta.setAyerCompOtroM}
            onInitDescansoStep={() => {
              ayerCompleta.setAyerCompHadBreak(true);
              ayerCompleta.setAyerCompOtroH(0);
              ayerCompleta.setAyerCompOtroM(30);
              ayerCompleta.setAyerCompStep("descanso_cant");
            }}
            onSubmit={ayerCompleta.submitCompletarAyer}
          />
        )}

      {personalEditarDiaWorkDate ? (
        <PersonalEditarDiaModal
          workDate={personalEditarDiaWorkDate}
          personaLabel={personaLabelHistorial}
          isWeekend={workDateIsWeekend(personalEditarDiaWorkDate)}
          onClose={() => setPersonalEditarDiaWorkDate(null)}
          onModificarHorario={() => {
            const d = personalEditarDiaWorkDate;
            setPersonalEditarDiaWorkDate(null);
            if (d) forgotModal.openForgotForDate(d);
          }}
        />
      ) : null}

      {/* Modal: Olvidé fichar */}
      {forgotModal.forgotStep !== "closed" && (
        <ForgotModal
          step={forgotModal.forgotStep}
          targetDate={forgotModal.forgotTargetDate}
          today={fichaje.today}
          soloTime={forgotModal.forgotSoloTime}
          fullStart={forgotModal.forgotFullStart}
          fullEnd={forgotModal.forgotFullEnd}
          forgotMode={forgotModal.forgotMode}
          fullBreakMins={forgotModal.forgotFullBreakMins}
          fullBreakCustom={forgotModal.forgotFullBreakCustom}
          breakOtro={forgotModal.forgotBreakOtro}
          error={forgotModal.forgotError}
          onClose={forgotModal.resetForgotModal}
          onSetStep={forgotModal.setForgotStep}
          onSetError={forgotModal.setForgotError}
          onSetTargetDate={forgotModal.setForgotTargetDate}
          onSetSoloTime={forgotModal.setForgotSoloTime}
          onSetFullStart={forgotModal.setForgotFullStart}
          onSetFullEnd={forgotModal.setForgotFullEnd}
          onSetForgotMode={forgotModal.setForgotMode}
          onSetFullBreakMins={forgotModal.setForgotFullBreakMins}
          onSetFullBreakCustom={forgotModal.setForgotFullBreakCustom}
          onSetBreakOtro={forgotModal.setForgotBreakOtro}
          onSubmitSoloEntrada={forgotModal.submitForgotSoloEntrada}
          onSubmitJornadaCompleta={forgotModal.submitForgotJornadaCompleta}
        />
      )}

      {/* Modal: flujo de descanso/comida al fichar salida */}
      {breakModal.restModalStep !== "closed" && (
        <BreakModal
          step={breakModal.restModalStep}
          openEntry={fichaje.openEntry}
          workPartOverrideEntry={breakModal.workPartOverrideEntry}
          restAnswerHadBreak={breakModal.restAnswerHadBreak}
          restMinutes={breakModal.restMinutes}
          restClockHour={breakModal.restClockHour}
          restClockMinute={breakModal.restClockMinute}
          restClockPhase={breakModal.restClockPhase}
          askAmountError={breakModal.askAmountError}
          workPartDataLoading={breakModal.workPartDataLoading}
          workPartCompanies={breakModal.workPartCompanies}
          workPartServices={breakModal.workPartServices}
          workPartLines={breakModal.workPartLines}
          workPartError={breakModal.workPartError}
          workPartModalMode={breakModal.workPartModalMode}
          workPartJustSaved={breakModal.workPartJustSaved}
          workPartSignatureDialogOpen={breakModal.workPartSignatureDialogOpen}
          workPartSignatureTemp={breakModal.workPartSignatureTemp}
          workPartPdfLoading={breakModal.workPartPdfLoading}
          checkoutSubmitting={breakModal.checkoutSubmitting}
          onSetStep={breakModal.setRestModalStep}
          onSetRestAnswerHadBreak={breakModal.setRestAnswerHadBreak}
          onSetRestMinutes={breakModal.setRestMinutes}
          onSetRestClockHour={breakModal.setRestClockHour}
          onSetRestClockMinute={breakModal.setRestClockMinute}
          onSetRestClockPhase={breakModal.setRestClockPhase}
          onSetAskAmountError={breakModal.setAskAmountError}
          onConfirmRestAmount={breakModal.confirmRestAmountAndShowSummary}
          onConfirmWorkPart={breakModal.confirmWorkPartAndCheckout}
          onAddWorkPartLine={breakModal.addWorkPartLine}
          onPatchWorkPartLine={breakModal.patchWorkPartLine}
          onRemoveWorkPartLine={breakModal.removeWorkPartLine}
          onSetWorkPartLines={breakModal.setWorkPartLines}
          onSetWorkPartOverrideEntry={breakModal.setWorkPartOverrideEntry}
          onSetWorkPartModalMode={breakModal.setWorkPartModalMode}
          onSetWorkPartSignatureDialogOpen={breakModal.setWorkPartSignatureDialogOpen}
          onSetWorkPartSignatureTemp={breakModal.setWorkPartSignatureTemp}
          onGenerateWorkPartPdf={breakModal.generateWorkPartPdf}
        />
      )}
    </div>
  );
}
