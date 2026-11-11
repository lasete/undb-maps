import { getBuilding, type BuildingId } from "@/lib/campus";

/**
 * Bloco com letra — o mesmo recurso visual da logo UNDB (letras dentro de
 * quadrados coloridos). Norte, Central e Sul seguem o gradiente
 * vermelho → magenta → roxo da marca.
 */
export function Tile({ building, size = "md", className = "" }: { building: BuildingId; size?: "sm" | "md" | "lg"; className?: string }) {
  const b = getBuilding(building);
  const dim = size === "sm" ? "size-8 text-sm rounded-md" : size === "lg" ? "size-14 text-2xl rounded-xl" : "size-10 text-base rounded-lg";
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center font-display font-extrabold tracking-tight ${dim} ${className}`}
      style={{ background: b.color, color: b.ink }}
    >
      {b.tile}
    </span>
  );
}

/** Wordmark "UNDB" em blocos, para telas sem a imagem da logo. */
export function TileWord({ word = "UNDB", className = "" }: { word?: string; className?: string }) {
  const colors = ["#FB2A41", "#E0124F", "#B4087A", "#4600A6"];
  return (
    <span className={`inline-flex gap-[0.12em] ${className}`} aria-label={word}>
      {word.split("").map((c, i) => (
        <span
          key={i}
          aria-hidden
          className="grid size-[1.15em] place-items-center rounded-[0.18em] font-display font-extrabold leading-none text-white"
          style={{ background: colors[i % colors.length] }}
        >
          <span className="text-[0.78em]">{c}</span>
        </span>
      ))}
    </span>
  );
}
