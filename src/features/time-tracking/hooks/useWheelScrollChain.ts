"use client";

import { type RefObject, useLayoutEffect } from "react";

const THRESHOLD = 2;

/** El navegador ya acumula deltas; al forzar scroll en el padre, el mismo delta se nota más rápido. */
const CHAIN_SCROLL_FACTOR = 0.32;

function normalizeDeltaY(e: WheelEvent, viewportHeight: number): number {
  let dy = e.deltaY;
  if (e.deltaMode === 1) dy *= 16;
  else if (e.deltaMode === 2) dy *= viewportHeight;
  return dy;
}

function isVerticallyScrollable(el: HTMLElement): boolean {
  const st = getComputedStyle(el);
  const oy = st.overflowY;
  if (oy !== "auto" && oy !== "scroll" && oy !== "overlay") return false;
  return el.scrollHeight > el.clientHeight + THRESHOLD;
}

/**
 * Encadena la rueda del ratón al scroll del documento cuando el elemento interno ya no puede
 * desplazarse en esa dirección. Útil en Windows/Chrome, donde el wheel no “sube” al `<main>`
 * aunque `overscroll-behavior-y: auto`.
 */
export function useWheelScrollChain(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean = true,
): void {
  useLayoutEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const el = ref.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      const dy = normalizeDeltaY(e, el.clientHeight);
      if (Math.abs(dy) < 0.5) return;

      const atTop = el.scrollTop <= THRESHOLD;
      const atBottom =
        el.scrollTop + el.clientHeight >= el.scrollHeight - THRESHOLD;
      const down = dy > 0;
      const up = dy < 0;

      if (!((down && atBottom) || (up && atTop))) return;

      const chainDy = dy * CHAIN_SCROLL_FACTOR;

      let target: HTMLElement | null = el.parentElement;
      while (target) {
        if (isVerticallyScrollable(target)) {
          const tTop = target.scrollTop <= THRESHOLD;
          const tBottom =
            target.scrollTop + target.clientHeight >=
            target.scrollHeight - THRESHOLD;
          if ((down && !tBottom) || (up && !tTop)) {
            target.scrollTop += chainDy;
            e.preventDefault();
            return;
          }
        }
        target = target.parentElement;
      }

      window.scrollBy({ top: chainDy, left: 0, behavior: "auto" });
      e.preventDefault();
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [enabled, ref]);
}
