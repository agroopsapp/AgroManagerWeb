"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { USER_ROLE } from "@/types";
import { useEquipo } from "@/features/time-tracking/hooks/useEquipo";
import { useEquipoModal } from "@/features/time-tracking/hooks/useEquipoModal";
import { useEquipoPart } from "@/features/time-tracking/hooks/useEquipoPart";
import { TeamPanel } from "@/features/time-tracking/components/TeamPanel";
import { EquipoPartModal } from "@/features/time-tracking/components/EquipoPartModal";

export default function ManagerPage() {
  const { user, isReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;
    if (!user) { router.replace("/login"); return; }
    if (user.role === USER_ROLE.Worker) { router.replace("/dashboard/tasks"); return; }
  }, [user, isReady, router]);

  const equipo = useEquipo();

  const equipoModal = useEquipoModal({
    user,
    setTeamHistorialEntries: equipo.setTeamHistorialEntries,
    equipoTablaScrollRef: equipo.equipoTablaScrollRef,
    equipoRestaurarScroll: equipo.equipoRestaurarScroll,
    equipoMarcarRestaurarScroll: equipo.equipoMarcarRestaurarScroll,
  });

  const equipoPart = useEquipoPart({
    setEquipoPartsVersion: equipo.setEquipoPartsVersion,
  });

  if (!isReady || !user) return null;

  return (
    <div className="min-w-0 max-w-full space-y-5">
      <TeamPanel
        periodo={equipo.equipoPeriodo}
        dia={equipo.equipoDia}
        mes={equipo.mesEquipo}
        trimestre={equipo.trimestreEquipo}
        anio={equipo.anioEquipo}
        persona={equipo.filtroPersonaEquipo}
        opcionesMes={equipo.opcionesMesEquipo}
        opcionesTrimestre={equipo.opcionesTrimestre}
        opcionesAnio={equipo.opcionesAnio}
        totalMinutos={equipo.totalMinutosImputadosMes}
        totalHorasDecimal={equipo.totalHorasDecimalMes}
        rowsFiltradas={equipo.equipoRowsFiltradas}
        diasLaborables={equipo.diasLaborablesMesEquipo}
        personasEnObjetivo={equipo.personasEnObjetivo}
        horasObjetivo={equipo.horasObjetivoMesTeorico}
        hDonutImputado={equipo.hDonutImputado}
        hDonutFalta={equipo.hDonutFalta}
        hDonutExtra={equipo.hDonutExtra}
        horasImputadasDecimal={equipo.horasImputadasDecimal}
        horasFaltaParaObjetivo={equipo.horasFaltaParaObjetivo}
        fichajeTipoStats={equipo.fichajeTipoStats}
        horasSinImputarTipoFichaje={equipo.horasSinImputarTipoFichaje}
        diasSinImputarEquipo={equipo.diasSinImputarEquipo}
        partesEquipoStats={equipo.partesEquipoStats}
        diasCalendario={equipo.diasCalendarioMesEquipo}
        filasOrdenadas={equipo.equipoFilasOrdenadas}
        sort={equipo.equipoSort}
        tablaScrollRef={equipo.equipoTablaScrollRef}
        editModalState={equipoModal.equipoModal}
        editModalVista={equipoModal.equipoModalVista}
        editFormIn={equipoModal.equipoFormIn}
        editFormOut={equipoModal.equipoFormOut}
        editFormBreak={equipoModal.equipoFormBreak}
        editFormNota={equipoModal.equipoFormNota}
        editFormError={equipoModal.equipoFormError}
        onSetPeriodo={equipo.setEquipoPeriodo}
        onSetDia={equipo.setEquipoDia}
        onSetMes={equipo.setMesEquipo}
        onSetTrimestre={equipo.setTrimestreEquipo}
        onSetAnio={equipo.setAnioEquipo}
        onSetPersona={equipo.setFiltroPersonaEquipo}
        onSetSortColumn={equipo.setEquipoSortColumn}
        onOpenEditModal={equipoModal.openEquipoEditModal}
        onCloseEditModal={equipoModal.cerrarEquipoModal}
        onSetModalVista={equipoModal.setEquipoModalVista}
        onGuardarVacaciones={equipoModal.guardarEquipoVacacionesOBaja}
        onSetFormError={equipoModal.setEquipoFormError}
        onGuardarHorario={equipoModal.guardarEquipoHorarioManual}
        onSetFormIn={equipoModal.setEquipoFormIn}
        onSetFormOut={equipoModal.setEquipoFormOut}
        onSetFormBreak={equipoModal.setEquipoFormBreak}
        onSetFormNota={equipoModal.setEquipoFormNota}
        onOpenPartEditor={equipoPart.openEquipoPartEditor}
      />

      {equipoPart.equipoPartModal && (
        <EquipoPartModal
          modal={equipoPart.equipoPartModal}
          companies={equipoPart.equipoPartCompanies}
          services={equipoPart.equipoPartServices}
          lines={equipoPart.equipoPartLines}
          loading={equipoPart.equipoPartLoading}
          saving={equipoPart.equipoPartSaving}
          error={equipoPart.equipoPartError}
          signatureDialogOpen={equipoPart.equipoPartSignatureDialogOpen}
          signatureTemp={equipoPart.equipoPartSignatureTemp}
          pdfLoading={equipoPart.equipoPartPdfLoading}
          onClose={equipoPart.closeEquipoPartEditor}
          onAddLine={equipoPart.addEquipoPartLine}
          onPatchLine={equipoPart.patchEquipoPartLine}
          onRemoveLine={equipoPart.removeEquipoPartLine}
          onSave={equipoPart.saveEquipoPart}
          onSetSignatureDialogOpen={equipoPart.setEquipoPartSignatureDialogOpen}
          onSetSignatureTemp={equipoPart.setEquipoPartSignatureTemp}
          onSetError={equipoPart.setEquipoPartError}
          onGeneratePdf={equipoPart.handleGenerateEquipoPartPdf}
        />
      )}
    </div>
  );
}
