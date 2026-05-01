"use client";

import { useCallback, useMemo, useState } from "react";
import { kioskTimeTrackingApi } from "@/services";
import type { KioskPunchResult } from "../types";
import { userVisibleMessageFromUnknown } from "@/shared/utils/apiErrorDisplay";

type Status = "idle" | "loading" | "success" | "error";

export function useKioskPunch() {
  const [status, setStatus] = useState<Status>("idle");
  const [lastResult, setLastResult] = useState<KioskPunchResult | null>(null);
  const [error, setError] = useState<string>("");

  const punch = useCallback(async (code: string) => {
    setStatus("loading");
    setError("");
    try {
      const dto = await kioskTimeTrackingApi.punch(code);
      const result: KioskPunchResult = {
        displayName: dto.displayName,
        action: dto.action,
        atUtc: dto.atUtc,
        message: dto.message ?? null,
      };
      setLastResult(result);
      setStatus("success");
      return result;
    } catch (err) {
      setStatus("error");
      const msg = userVisibleMessageFromUnknown(err, "No se ha podido fichar.");
      setError(msg);
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setLastResult(null);
    setError("");
  }, []);

  return useMemo(
    () => ({ status, lastResult, error, punch, reset }),
    [status, lastResult, error, punch, reset],
  );
}

