const fs = require("fs");

const filePath = "src/app/dashboard/time-tracking/page.tsx";
const raw = fs.readFileSync(filePath, "utf8");
// Normalise to LF internally; we'll write back the same way
const content = raw.replace(/\r\n/g, "\n");
let lines = content.split("\n");

// Helper: replace lines [startLine, endLine] (1-indexed, inclusive) with new content
function replaceLines(startLine, endLine, newContent) {
  const start0 = startLine - 1;
  const end0 = endLine - 1;
  const before = lines.slice(0, start0);
  const after = lines.slice(end0 + 1);
  const newLines = newContent.split("\n");
  lines = [...before, ...newLines, ...after];
}

// ---------------------------------------------------------------------------
// 1. BreakModal JSX: lines 3655-4097
// ---------------------------------------------------------------------------
const breakModalJsx = `      {/* Modal flujo de descanso/comida al fichar salida */}
      {restModalStep !== "closed" && (openEntry || workPartOverrideEntry) && (
        <BreakModal
          step={restModalStep}
          openEntry={openEntry}
          workPartOverrideEntry={workPartOverrideEntry}
          restAnswerHadBreak={restAnswerHadBreak}
          restMinutes={restMinutes}
          restClockHour={restClockHour}
          restClockMinute={restClockMinute}
          restClockPhase={restClockPhase}
          askAmountError={askAmountError}
          workPartDataLoading={workPartDataLoading}
          workPartCompanies={workPartCompanies}
          workPartServices={workPartServices}
          workPartLines={workPartLines}
          workPartError={workPartError}
          onSetStep={setRestModalStep}
          onSetRestAnswerHadBreak={setRestAnswerHadBreak}
          onSetRestMinutes={setRestMinutes}
          onSetRestClockHour={setRestClockHour}
          onSetRestClockMinute={setRestClockMinute}
          onSetRestClockPhase={setRestClockPhase}
          onSetAskAmountError={setAskAmountError}
          onConfirmRestAmount={confirmRestAmountAndShowSummary}
          onConfirmWorkPart={confirmWorkPartAndCheckout}
          onAddWorkPartLine={addWorkPartLine}
          onPatchWorkPartLine={patchWorkPartLine}
          onRemoveWorkPartLine={removeWorkPartLine}
          onSetWorkPartLines={setWorkPartLines}
          onSetWorkPartOverrideEntry={setWorkPartOverrideEntry}
        />
      )}`;
replaceLines(3655, 4097, breakModalJsx);

// ---------------------------------------------------------------------------
// 2. EquipoPartModal + SignaturePadDialog: lines 3359-3653
// ---------------------------------------------------------------------------
const equipoPartModalJsx = `      {/* Modal: Parte desde Horas del equipo (editar tareas + firma) */}
      {equipoPartModal && (
        <EquipoPartModal
          modal={equipoPartModal}
          companies={equipoPartCompanies}
          services={equipoPartServices}
          lines={equipoPartLines}
          loading={equipoPartLoading}
          saving={equipoPartSaving}
          error={equipoPartError}
          signatureDialogOpen={equipoPartSignatureDialogOpen}
          signatureTemp={equipoPartSignatureTemp}
          pdfLoading={equipoPartPdfLoading}
          onClose={closeEquipoPartEditor}
          onAddLine={addEquipoPartLine}
          onPatchLine={patchEquipoPartLine}
          onRemoveLine={removeEquipoPartLine}
          onSave={saveEquipoPart}
          onSetSignatureDialogOpen={setEquipoPartSignatureDialogOpen}
          onSetSignatureTemp={setEquipoPartSignatureTemp}
          onSetError={setEquipoPartError}
          onGeneratePdf={handleGenerateEquipoPartPdf}
        />
      )}`;
replaceLines(3359, 3653, equipoPartModalJsx);

// ---------------------------------------------------------------------------
// 3. ForgotModal: lines 3031-3357
// ---------------------------------------------------------------------------
const forgotModalJsx = `      {/* Modal: Olvidé fichar (solo hoy / ayer) */}
      {forgotStep !== "closed" && (
        <ForgotModal
          step={forgotStep}
          targetDate={forgotTargetDate}
          today={today}
          soloTime={forgotSoloTime}
          fullStart={forgotFullStart}
          fullEnd={forgotFullEnd}
          forgotMode={forgotMode}
          fullBreakMins={forgotFullBreakMins}
          fullBreakCustom={forgotFullBreakCustom}
          breakOtro={forgotBreakOtro}
          error={forgotError}
          onClose={resetForgotModal}
          onSetStep={setForgotStep}
          onSetError={setForgotError}
          onSetTargetDate={setForgotTargetDate}
          onSetSoloTime={setForgotSoloTime}
          onSetFullStart={setForgotFullStart}
          onSetFullEnd={setForgotFullEnd}
          onSetForgotMode={setForgotMode}
          onSetFullBreakMins={setForgotFullBreakMins}
          onSetFullBreakCustom={setForgotFullBreakCustom}
          onSetBreakOtro={setForgotBreakOtro}
          onSubmitSoloEntrada={submitForgotSoloEntrada}
          onSubmitJornadaCompleta={submitForgotJornadaCompleta}
        />
      )}`;
replaceLines(3031, 3357, forgotModalJsx);

// ---------------------------------------------------------------------------
// 4. AyerCompletaModal: lines 2808-3029
// ---------------------------------------------------------------------------
const ayerCompletaModalJsx = `      {/* Modal: completar registro de ayer (entrada + salida + descanso) */}
      {ayerCompStep !== "closed" && ultimoLaboralSinCerrar && registroAyerParcial && (
        <AyerCompletaModal
          step={ayerCompStep}
          fechaAyerEtiqueta={fechaAyerEtiqueta}
          ayerManStart={ayerManStart}
          ayerManEnd={ayerManEnd}
          ayerCompOtroH={ayerCompOtroH}
          ayerCompOtroM={ayerCompOtroM}
          ayerMinutosBrutos={ayerMinutosBrutos}
          error={ayerCompError}
          onClose={resetAyerCompletaModal}
          onSetStep={setAyerCompStep}
          onSetManStart={setAyerManStart}
          onSetManEnd={setAyerManEnd}
          onSetError={setAyerCompError}
          onSetOtroH={setAyerCompOtroH}
          onSetOtroM={setAyerCompOtroM}
          onInitDescansoStep={() => {
            setAyerCompHadBreak(true);
            setAyerCompOtroH(0);
            setAyerCompOtroM(30);
            setAyerCompStep("descanso_cant");
          }}
          onSubmit={submitCompletarAyer}
        />
      )}`;
replaceLines(2808, 3029, ayerCompletaModalJsx);

// ---------------------------------------------------------------------------
// 5. TeamPanel: lines 1885-2752
// ---------------------------------------------------------------------------
const teamPanelJsx = `      {fichadorPanel === "equipo" && canVerEquipo && (
        <TeamPanel
          periodo={equipoPeriodo}
          dia={equipoDia}
          mes={mesEquipo}
          trimestre={trimestreEquipo}
          anio={anioEquipo}
          persona={filtroPersonaEquipo}
          opcionesMes={opcionesMesEquipo}
          opcionesTrimestre={opcionesTrimestre}
          opcionesAnio={opcionesAnio}
          totalMinutos={totalMinutosImputadosMes}
          totalHorasDecimal={totalHorasDecimalMes}
          rowsFiltradas={equipoRowsFiltradas}
          diasLaborables={diasLaborablesMesEquipo}
          personasEnObjetivo={personasEnObjetivo}
          horasObjetivo={horasObjetivoMesTeorico}
          hDonutImputado={hDonutImputado}
          hDonutFalta={hDonutFalta}
          hDonutExtra={hDonutExtra}
          horasImputadasDecimal={horasImputadasDecimal}
          horasFaltaParaObjetivo={horasFaltaParaObjetivo}
          fichajeTipoStats={fichajeTipoStats}
          horasSinImputarTipoFichaje={horasSinImputarTipoFichaje}
          diasSinImputarEquipo={diasSinImputarEquipo}
          partesEquipoStats={partesEquipoStats}
          diasCalendario={diasCalendarioMesEquipo}
          filasOrdenadas={equipoFilasOrdenadas}
          sort={equipoSort}
          tablaScrollRef={equipoTablaScrollRef}
          editModalState={equipoModal}
          editModalVista={equipoModalVista}
          editFormIn={equipoFormIn}
          editFormOut={equipoFormOut}
          editFormBreak={equipoFormBreak}
          editFormNota={equipoFormNota}
          editFormError={equipoFormError}
          onSetPeriodo={setEquipoPeriodo}
          onSetDia={setEquipoDia}
          onSetMes={setMesEquipo}
          onSetTrimestre={setTrimestreEquipo}
          onSetAnio={setAnioEquipo}
          onSetPersona={setFiltroPersonaEquipo}
          onSetSortColumn={setEquipoSortColumn}
          onOpenEditModal={openEquipoEditModal}
          onCloseEditModal={cerrarEquipoModal}
          onSetModalVista={setEquipoModalVista}
          onGuardarVacaciones={guardarEquipoVacacionesOBaja}
          onSetFormError={setEquipoFormError}
          onGuardarHorario={guardarEquipoHorarioManual}
          onSetFormIn={setEquipoFormIn}
          onSetFormOut={setEquipoFormOut}
          onSetFormBreak={setEquipoFormBreak}
          onSetFormNota={setEquipoFormNota}
          onOpenPartEditor={openEquipoPartEditor}
        />
      )}`;
replaceLines(1885, 2752, teamPanelJsx);

// ---------------------------------------------------------------------------
// 6. Add new component imports after line 99
// ---------------------------------------------------------------------------
const newImports = [
  `import { TeamPanel } from "@/features/time-tracking/components/TeamPanel";`,
  `import { AyerCompletaModal } from "@/features/time-tracking/components/AyerCompletaModal";`,
  `import { ForgotModal } from "@/features/time-tracking/components/ForgotModal";`,
  `import { EquipoPartModal } from "@/features/time-tracking/components/EquipoPartModal";`,
  `import { BreakModal } from "@/features/time-tracking/components/BreakModal";`,
].join("\n");

// After the replacements above, line 99 is still 99 (we only replaced lines 1885+)
lines.splice(99, 0, newImports);

// ---------------------------------------------------------------------------
// 7. Add handleGenerateEquipoPartPdf function
//    Insert it after saveEquipoPart which was around line 1760 originally.
//    After the import insertion (+1), it's now ~1761.
//    After team panel replacement (1885-2752 → ~61 lines), same area.
//    Find it by searching for "const saveEquipoPart"
// ---------------------------------------------------------------------------
const saveEquipoPartIdx = lines.findIndex(l => l.includes("const saveEquipoPart = "));
if (saveEquipoPartIdx === -1) {
  console.error("ERROR: could not find 'const saveEquipoPart'");
  process.exit(1);
}

// Find the end of saveEquipoPart function (next "const " at same indent level)
let insertAfterIdx = saveEquipoPartIdx + 1;
while (insertAfterIdx < lines.length) {
  const l = lines[insertAfterIdx];
  // Look for next top-level const/function at ~2 space indent
  if (l.match(/^  const [a-z]/) || l.match(/^  \/\/ /)) {
    break;
  }
  insertAfterIdx++;
}

const handlePdfFn = `
  const handleGenerateEquipoPartPdf = async (): Promise<void> => {
    if (!equipoPartModal) return;
    setEquipoPartPdfLoading(true);
    try {
      const tasks =
        buildEquipoPartTasks() ??
        (equipoPartModal.existing
          ? getTasksFromRecord(equipoPartModal.existing)
          : null);
      if (!tasks || tasks.length === 0) {
        setEquipoPartError("No hay tareas válidas para incluir en el PDF.");
        return;
      }
      const nEmp = Array.from(new Set(tasks.map((t) => t.companyId))).length;
      const recordForPdf: WorkPartRecord = {
        id: equipoPartModal.existing?.id ?? \`tmp-\${Date.now()}\`,
        workDate: equipoPartModal.workDate,
        workerId: equipoPartModal.workerId,
        entradaDisplay: formatTimeLocal(equipoPartModal.entry.checkInUtc),
        salidaDisplay: formatTimeLocal(equipoPartModal.entry.checkOutUtc),
        breakMinutes: equipoPartModal.entry.breakMinutes ?? 0,
        workedMinutes: Math.max(0, effectiveWorkMinutesEntry(equipoPartModal.entry) ?? 0),
        companyId: tasks[0].companyId,
        companyName: nEmp === 1 ? tasks[0].companyName : \`Varias empresas (\${nEmp})\`,
        tasks,
        savedAtUtc: equipoPartModal.existing?.savedAtUtc ?? new Date().toISOString(),
        ...(equipoPartSignatureTemp ? { signaturePngDataUrl: equipoPartSignatureTemp } : {}),
      };
      await downloadWorkPartPdf(recordForPdf, tasks, {
        workerDisplayName: workerNameById(equipoPartModal.workerId),
        companies: equipoPartCompanies,
      });
      setEquipoPartError(null);
    } catch {
      setEquipoPartError("No se pudo generar el PDF. Inténtalo de nuevo.");
    } finally {
      setEquipoPartPdfLoading(false);
    }
  };`;

lines.splice(insertAfterIdx, 0, handlePdfFn);

// ---------------------------------------------------------------------------
// Write the result
// ---------------------------------------------------------------------------
const result = lines.join("\n");
fs.writeFileSync(filePath, result, "utf8");
console.log("Done! Total lines: " + lines.length);
