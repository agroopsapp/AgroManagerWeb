"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { USER_ROLE } from "@/types";
import { useFeatures } from "@/contexts/FeaturesContext";
import { workerHomePath } from "@/lib/dashboardNavGating";
import { useEquipo } from "@/features/time-tracking/hooks/useEquipo";
import { useEquipoModal } from "@/features/time-tracking/hooks/useEquipoModal";
import { useEquipoPart } from "@/features/time-tracking/hooks/useEquipoPart";
import { TeamPanel } from "@/features/time-tracking/components/TeamPanel";
import { EquipoPartModal } from "@/features/time-tracking/components/EquipoPartModal";

export default function ManagerPage() {
  const { user, isReady } = useAuth();
  const { enableTimeTracking, enableOperativaYAnalisisMenu } = useFeatures();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;
    if (!user) { router.replace("/login"); return; }
    if (user.role === USER_ROLE.Worker) {
      router.replace(workerHomePath(enableTimeTracking, enableOperativaYAnalisisMenu));
      return;
    }
  }, [user, isReady, router, enableOperativaYAnalisisMenu, enableTimeTracking]);

  const equipo = useEquipo({
    enableEquipoCompanyFilter:
      user?.role === USER_ROLE.SuperAdmin ||
      user?.role === USER_ROLE.Manager ||
      user?.role === USER_ROLE.Admin,
  });

  const equipoModal = useEquipoModal({
    user,
    equipoTablaScrollRef: equipo.equipoTablaScrollRef,
    equipoRestaurarScroll: equipo.equipoRestaurarScroll,
    equipoMarcarRestaurarScroll: equipo.equipoMarcarRestaurarScroll,
    refetchEquipoRows: equipo.refetchEquipoRows,
    equipoWorkersCatalog: equipo.equipoWorkersOpciones,
    equipoSuperAdminCompanyId: equipo.equipoSuperAdminCompanyId,
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
        workersOpciones={equipo.equipoWorkersOpciones}
        resolvePersonaNombre={equipo.resolveEquipoPersonaNombre}
        equipoNombrePorClave={equipo.equipoNombrePorClave}
        rowsApi={{
          loading: equipo.equipoRowsLoading,
          error: equipo.equipoRowsError,
          totalCount: equipo.equipoRowsTotalCount,
        }}
        equipoCompanyFilter={
          user.role === USER_ROLE.SuperAdmin ||
          user.role === USER_ROLE.Manager ||
          user.role === USER_ROLE.Admin
            ? {
                companyId: equipo.equipoSuperAdminCompanyId,
                onCompanyIdChange: equipo.setEquipoSuperAdminCompanyId,
                companies: equipo.equipoCompaniesCatalog,
                loading: equipo.equipoCompaniesLoading,
                error: equipo.equipoCompaniesError,
              }
            : undefined
        }
        equipoServiceFilter={
          user.role === USER_ROLE.SuperAdmin ||
          user.role === USER_ROLE.Manager ||
          user.role === USER_ROLE.Admin
            ? {
                serviceId: equipo.equipoServiceId,
                onServiceIdChange: equipo.setEquipoServiceId,
                services: equipo.equipoServicesCatalog,
                loading: equipo.equipoServicesLoading,
                error: equipo.equipoServicesError,
              }
            : undefined
        }
        tablaFiltroExtra={equipo.equipoTablaFiltroExtra}
        opcionesMes={equipo.opcionesMesEquipo}
        opcionesTrimestre={equipo.opcionesTrimestre}
        opcionesAnio={equipo.opcionesAnio}
        gridMesDetalleEnAnio={
          equipo.equipoPeriodo === "anio"
            ? {
                mesPagina: equipo.equipoAnioMesPagina,
                opcionesMes: equipo.opcionesMesDentroAnioEquipo,
                onMesPaginaChange: equipo.setEquipoAnioMesPagina,
              }
            : undefined
        }
        totalMinutos={equipo.totalMinutosImputadosMes}
        totalHorasDecimal={equipo.totalHorasDecimalMes}
        rowsFiltradas={equipo.equipoRowsFiltradas}
        kpiRegistrosEnPeriodo={equipo.equipoRegistrosPeriodoKpi}
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
        filasOrdenadas={equipo.equipoFilasVista}
        equipoCapTrabajoDiarioMinutos={equipo.equipoCapTrabajoDiarioMinutos}
        sort={equipo.equipoSort}
        tablaScrollRef={equipo.equipoTablaScrollRef}
        editModalState={equipoModal.equipoModal}
        editModalVista={equipoModal.equipoModalVista}
        editFormError={equipoModal.equipoFormError}
        editAbsenceSaving={equipoModal.equipoAbsenceSaving}
        horarioWizard={{
          step: equipoModal.horarioWizardStep,
          setStep: equipoModal.setHorarioWizardStep,
          targetDate: equipoModal.horarioWizardTargetDate,
          setTargetDate: equipoModal.setHorarioWizardTargetDate,
          fullStart: equipoModal.horarioFullStart,
          setFullStart: equipoModal.setHorarioFullStart,
          fullEnd: equipoModal.horarioFullEnd,
          setFullEnd: equipoModal.setHorarioFullEnd,
          forgotMode: equipoModal.horarioWizardForgotMode,
          setForgotMode: equipoModal.setHorarioWizardForgotMode,
          fullBreakMins: equipoModal.horarioFullBreakMins,
          setFullBreakMins: equipoModal.setHorarioFullBreakMins,
          fullBreakCustom: equipoModal.horarioFullBreakCustom,
          setFullBreakCustom: equipoModal.setHorarioFullBreakCustom,
          breakOtro: equipoModal.horarioBreakOtro,
          setBreakOtro: equipoModal.setHorarioBreakOtro,
          wizardError: equipoModal.horarioWizardError,
          setWizardError: equipoModal.setHorarioWizardError,
          saving: equipoModal.horarioWizardSaving,
          onEnterWizard: equipoModal.enterEquipoHorarioWizard,
          onBackWizardToMenu: equipoModal.volverEquipoHorarioWizardAMenu,
          onSubmitJornada: (forced) =>
            void equipoModal.submitEquipoHorarioJornadaCompleta(forced),
        }}
        onSetPeriodo={equipo.setEquipoPeriodo}
        onSetDia={equipo.setEquipoDia}
        onSetMes={equipo.setMesEquipo}
        onSetTrimestre={equipo.setTrimestreEquipo}
        onSetAnio={equipo.setAnioEquipo}
        onSetPersona={equipo.setFiltroPersonaEquipo}
        onSetSoloSinImputar={equipo.setEquipoSoloSinImputar}
        onSetSoloSinParteServidor={equipo.setEquipoSoloSinParteServidor}
        onSetSoloConParteServidor={equipo.setEquipoSoloConParteServidor}
        onSetSortColumn={equipo.setEquipoSortColumn}
        onOpenEditModal={equipoModal.openEquipoEditModal}
        onCloseEditModal={equipoModal.cerrarEquipoModal}
        onGuardarVacaciones={equipoModal.guardarEquipoVacacionesOBaja}
        onSetFormError={equipoModal.setEquipoFormError}
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
