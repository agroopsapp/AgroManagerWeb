"use client";

import dynamic from "next/dynamic";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateES } from "@/shared/utils/time";
import { ClockPanel } from "@/features/time-tracking/components/ClockPanel";
import { HistorialPersonal } from "@/features/time-tracking/components/HistorialPersonal";
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

  const handleOpenForgotForDateFromHistory = (workDate: string) => {
    forgotModal.openForgotForDate(workDate);
  };

  // --- Render ---
  return (
    <div className="min-w-0 max-w-full space-y-4">
      {breakModal.workPartSuccessMessage && (
        <div className="fixed left-1/2 top-1/2 z-[9999] w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-900 shadow-2xl ring-2 ring-emerald-200/60 dark:border-emerald-600 dark:bg-emerald-950/90 dark:text-emerald-100 dark:ring-emerald-700/50">
          {breakModal.workPartSuccessMessage}
        </div>
      )}

      {/* Header */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-agro-600 via-emerald-500 to-sky-500 px-4 py-3 shadow-sm sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-agro-100/80">
              Registro de jornada
            </p>
            <h1 className="mt-1 text-2xl font-bold text-white">Fichador</h1>
            <p className="mt-1 text-sm text-agro-50/90">
              Marca tu entrada y salida de forma sencilla y cumpliendo el registro horario.
            </p>
          </div>
          {user && (
            <div className="flex min-w-0 max-w-full flex-col items-end gap-1 text-right">
              <span className="max-w-full truncate rounded-full border border-white/30 bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-agro-50 backdrop-blur sm:px-3 sm:text-xs">
                {user.email}
              </span>
              <span className="text-[11px] text-agro-50/80">
                Hoy: {formatDateES(fichaje.today)}
              </span>
            </div>
          )}
        </div>
      </div>

      {ayerCompleta.hayDiasSinCuadrarEnHistorico && (
        <div
          className="sticky top-2 z-30 min-w-0 max-w-full rounded-xl border border-rose-300 bg-rose-50 px-3 py-2.5 shadow-sm dark:border-rose-600 dark:bg-rose-950/40 sm:px-4 sm:py-3"
          role="status"
        >
          <p className="text-sm leading-snug text-rose-900 dark:text-rose-100">
            <span className="font-semibold">Histórico:</span> hay días laborables sin fichaje correcto
            (aparecen en rojo en la tabla).{" "}
            <strong>Habla con el administrador</strong> para cuadrar las horas laborales.
          </p>
        </div>
      )}

      <div className="grid min-w-0 max-w-full gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
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

        <HistorialPersonal
          loading={fichaje.loading}
          historicoPersonalFilas={fichaje.historicoPersonalFilas}
          hasAnyEntries={fichaje.entries.length > 0}
          onOpenPartEditor={handleOpenPartEditorFromHistory}
          onOpenForgotForDate={handleOpenForgotForDateFromHistory}
        />
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
