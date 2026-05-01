"use client";

import { KioskDisabled } from "@/features/kiosk/components/KioskDisabled";
import { KioskPad } from "@/features/kiosk/components/KioskPad";
import { useKioskPunch } from "@/features/kiosk/hooks/useKioskPunch";

export default function KioskPage() {
  const enableKiosk = process.env.NEXT_PUBLIC_ENABLE_KIOSK === "true";
  if (!enableKiosk) return <KioskDisabled />;

  const { status, error, lastResult, punch, reset } = useKioskPunch();

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-900">
      <KioskPad
        title="Fichador (kiosco)"
        status={status}
        error={error}
        lastResult={lastResult}
        onSubmitCode={async (code) => {
          await punch(code);
        }}
        onReset={reset}
      />
    </div>
  );
}

