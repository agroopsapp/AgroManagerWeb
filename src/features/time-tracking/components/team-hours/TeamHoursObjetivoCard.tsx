"use client";

import type { ComponentProps } from "react";
import { motion } from "framer-motion";
import { EquipoBarraLaboralesExtra } from "@/features/time-tracking/components/EquipoBarraLaboralesExtra";
import { EquipoObjetivoMesEncabezado } from "@/features/time-tracking/components/EquipoObjetivoMesEncabezado";
import type { UseEquipoResult } from "@/features/time-tracking/hooks/useEquipo";

interface TeamHoursObjetivoCardProps {
  eq: UseEquipoResult;
  animate: ComponentProps<typeof motion.section>["animate"];
}

export function TeamHoursObjetivoCard({ eq, animate }: TeamHoursObjetivoCardProps) {
  return (
    <motion.section
      className="agro-surface rounded-3xl p-3 sm:p-4"
      initial={{ opacity: 1, y: 0 }}
      animate={animate}
      aria-label="Objetivo del periodo e imputacion"
    >
      <EquipoObjetivoMesEncabezado
        diasLaborables={eq.diasLaborablesMesEquipo}
        personasEnObjetivo={eq.personasEnObjetivo}
        horasObjetivo={eq.horasObjetivoMesTeorico}
        filtroTodasPersonas={eq.filtroPersonaEquipo === "todas"}
        periodo={eq.equipoPeriodo}
        compact
      />
      <EquipoBarraLaboralesExtra
        horasObjetivo={eq.horasObjetivoMesTeorico}
        horasImputadasLabor={eq.hDonutImputado}
        horasFalta={eq.horasFaltaParaObjetivo}
        horasExtra={eq.hDonutExtra}
        horasImputadasTotal={eq.horasImputadasDecimal}
        compact
        hideTotalImputado
      />
    </motion.section>
  );
}
