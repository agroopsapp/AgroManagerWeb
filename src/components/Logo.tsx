"use client";

/**
 * Logo AgroOps: wordmark sobrio con acento geométrico.
 * Estilo corporativo, sin iconos infantiles.
 */
interface LogoProps {
  /** "sm" para header, "md" para tarjetas, "lg" para login */
  size?: "sm" | "md" | "lg";
  /** Si true, solo muestra el símbolo (barra) */
  iconOnly?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: { barHeight: 20, gap: 8, fontSize: "1rem" },
  md: { barHeight: 28, gap: 10, fontSize: "1.375rem" },
  lg: { barHeight: 36, gap: 12, fontSize: "1.75rem" },
};

export default function Logo({ size = "md", iconOnly = false, className = "" }: LogoProps) {
  const { barHeight, gap, fontSize } = sizeConfig[size];

  return (
    <span
      className={`inline-flex items-center gap-[var(--logo-gap)] font-bold tracking-tight text-slate-800 dark:text-slate-100 ${className}`}
      style={
        {
          "--logo-gap": `${gap}px`,
          fontSize: iconOnly ? undefined : fontSize,
        } as React.CSSProperties
      }
    >
      {/* Acento: barra vertical en color de marca */}
      <span
        className="shrink-0 rounded-full bg-agro-600 dark:bg-agro-500"
        style={{ width: 4, height: barHeight }}
        aria-hidden
      />
      {!iconOnly && <span className="whitespace-nowrap">AgroOps</span>}
    </span>
  );
}
