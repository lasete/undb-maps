"use client";

import { Component, type ReactNode } from "react";
import { Building2 } from "lucide-react";

/** WebGL disponível? (alguns celulares/navegadores bloqueiam ou não têm GPU compatível) */
export function hasWebGL() {
  if (typeof window === "undefined") return true;
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

/** Aviso exibido no lugar do mapa 3D quando a cena não pode rodar. */
export function SceneFallback({ onBuildings }: { onBuildings: () => void }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-background p-6 text-center">
      <div className="flex max-w-xs flex-col items-center gap-3">
        <Building2 className="size-10 text-primary" />
        <p className="font-display text-lg font-extrabold">O mapa 3D não abriu neste aparelho</p>
        <p className="text-sm text-muted-foreground">O navegador não liberou os gráficos 3D (WebGL). Você ainda pode ver os prédios, as salas e o passeio por fotos.</p>
        <button onClick={onBuildings} className="mt-1 min-h-11 rounded-xl bg-primary px-5 font-semibold text-primary-foreground">
          Ver prédios
        </button>
      </div>
    </div>
  );
}

/** Impede que um erro na cena 3D (WebGL, shader, textura) derrube o app inteiro. */
export class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[UNDB Maps] cena 3D falhou:", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
