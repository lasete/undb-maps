"use client";

import { useEffect } from "react";

/** Marca o app como pronto (hidratado) e remove a faixa, se ela já apareceu. */
export function LoadGuardReady() {
  useEffect(() => {
    document.documentElement.setAttribute("data-ready", "1");
    document.getElementById("load-guard")?.remove();
  }, []);
  return null;
}
