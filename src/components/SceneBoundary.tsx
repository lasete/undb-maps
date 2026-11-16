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
export function SceneFallback({ onBuildings, reason = "webgl" }: { onBuildings: () => void; reason?: "webgl" | "download" }) {
  const download = reason === "download";
  return (
    <div className="absolute inset-0 grid place-items-center bg-background p-6 text-center">
      <div className="flex max-w-xs flex-col items-center gap-3">
        <Building2 className="size-10 text-primary" />
        <p className="font-display text-lg font-extrabold">{download ? "Não foi possível baixar o mapa 3D" : "O mapa 3D não abriu neste aparelho"}</p>
        <p className="text-sm text-muted-foreground">
          {download
            ? "A conexão falhou ou o site foi atualizado. Tente de novo; enquanto isso, os prédios, as salas e o passeio por fotos continuam disponíveis."
            : "O navegador não liberou os gráficos 3D (WebGL). Você ainda pode ver os prédios, as salas e o passeio por fotos."}
        </p>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          {download && (
            <button onClick={() => window.location.reload()} className="min-h-11 rounded-xl bg-primary px-5 font-semibold text-primary-foreground">
              Tentar de novo
            </button>
          )}
          <button
            onClick={onBuildings}
            className={download ? "min-h-11 rounded-xl border border-border px-5 font-semibold" : "min-h-11 rounded-xl bg-primary px-5 font-semibold text-primary-foreground"}
          >
            Ver prédios
          </button>
        </div>
      </div>
    </div>
  );
}

/** Erro de download de chunk (deploy novo com HTML antigo em cache, ou rede instável)? */
export function isChunkError(error: unknown) {
  const e = error as { name?: string; message?: string } | null;
  return /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed|Failed to fetch/i.test(`${e?.name} ${e?.message}`);
}

/** Impede que um erro na cena 3D (WebGL, shader, textura, download) derrube o app inteiro. */
export class SceneBoundary extends Component<{ fallback: (reason: "webgl" | "download") => ReactNode; children: ReactNode }, { failed: "webgl" | "download" | null }> {
  state: { failed: "webgl" | "download" | null } = { failed: null };

  static getDerivedStateFromError(error: unknown) {
    return { failed: isChunkError(error) ? "download" : "webgl" };
  }

  componentDidCatch(error: unknown) {
    console.error("[UNDB Maps] cena 3D falhou:", error);
  }

  render() {
    return this.state.failed ? this.props.fallback(this.state.failed) : this.props.children;
  }
}
