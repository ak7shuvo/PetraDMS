"use client";

import { useEffect } from "react";
import { useMotionValue } from "framer-motion";

/** Normalised pointer position (-0.5..0.5) over the window, as motion values. */
export function useMouse() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      x.set(e.clientX / window.innerWidth - 0.5);
      y.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [x, y]);
  return { x, y };
}
