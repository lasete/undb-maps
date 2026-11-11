"use client";

/* eslint-disable @next/next/no-img-element -- fotos locais em sequência; <img> simples carrega mais rápido aqui */
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowUp, ChevronLeft, MapPin, Pause, Play, X } from "lucide-react";
import { PLACES, SEGMENTS, STOPS, stopIndexOf, type SegmentId } from "@/lib/streetview";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

/**
 * Passeio pelo campus: fotos reais em ordem de caminhada, com seta no chão
 * como no Street View, trechos nomeados e atalhos para lugares.
 */

const SEG_IDS = Object.keys(SEGMENTS) as SegmentId[];
// tamanho de cada trecho, para a barra de progresso
const SEG_SPANS = SEG_IDS.map((s) => {
  const first = STOPS.findIndex((x) => x.segment === s);
  const count = STOPS.filter((x) => x.segment === s).length;
  return { id: s, first, count };
});

const glass = "border border-white/15 bg-[#120a10]/70 shadow-[0_10px_40px_-12px_rgba(0,0,0,.6)] backdrop-blur-xl";

export default function StreetView({ totem, start = 0 }: { totem: boolean; start?: number }) {
  const [i, setI] = useState(start);
  const [playing, setPlaying] = useState(false);
  const [places, setPlaces] = useState(false);
  const touch = useRef<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const stop = STOPS[i];
  const seg = SEGMENTS[stop.segment];
  const newSegment = STOPS[i - 1]?.segment !== stop.segment;

  const go = useCallback((d: number) => setI((x) => Math.min(STOPS.length - 1, Math.max(0, x + d))), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (places) {
        if (e.key === "Escape") setPlaces(false);
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowRight") go(1);
      if (e.key === "ArrowDown" || e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, places]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setI((x) => (x + 1) % STOPS.length), 2800);
    return () => window.clearInterval(id);
  }, [playing]);

  // pré-carrega a próxima foto
  useEffect(() => {
    const n = STOPS[i + 1];
    if (n) new window.Image().src = n.file;
  }, [i]);

  // transição entre fotos: a nova entra com leve aproximação (como dar um passo)
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo("[data-photo]", { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1, duration: 0.7, ease: "power2.out" });
        gsap.fromTo("[data-caption]", { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "power2.out", delay: 0.08 });
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [i] },
  );

  return (
    <div
      ref={root}
      className="relative h-full w-full overflow-hidden bg-[#0c0609] text-white select-none"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        touch.current = null;
      }}
    >
      {/* foto + fundo desfocado (para telas largas) */}
      <img src={stop.file} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-3xl" />
      <img key={stop.file} data-photo src={stop.file} alt={stop.caption} className="absolute inset-0 m-auto h-full w-full object-contain" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent via-40% to-black/80" />

      {/* ─── topo ─────────────────────────────────────────────── */}
      <div className="absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3">
        <div className={cn("mx-auto flex w-full max-w-3xl items-center gap-2 rounded-2xl p-1.5 pr-2", glass)}>
          <Image src="/undb-mark.png" alt="UNDB" width={40} height={40} className="size-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 leading-none">
            <p className="font-display text-[0.95rem] font-extrabold tracking-tight">
              Passeio <span className="text-[#ff3f80]">pelo campus</span>
            </p>
            <p className="mt-0.5 text-[0.68rem] text-white/65 tabular">
              Foto {i + 1} de {STOPS.length}
            </p>
          </div>
          <button
            onClick={() => setPlaying(!playing)}
            aria-label={playing ? "Pausar passeio automático" : "Passeio automático"}
            aria-pressed={playing}
            className={cn("grid size-10 place-items-center rounded-xl transition-colors", playing ? "bg-white text-[#1b0d17]" : "hover:bg-white/10")}
          >
            {playing ? <Pause className="size-[1.05rem]" /> : <Play className="size-[1.05rem]" />}
          </button>
          <button onClick={() => setPlaces(true)} className="flex h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-semibold text-[#1b0d17]">
            <MapPin className="size-4" /> Lugares
          </button>
        </div>

        {/* trechos */}
        <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 desk:mx-auto desk:max-w-3xl">
          {SEG_SPANS.map(({ id, first }) => {
            const active = stop.segment === id;
            return (
              <button
                key={id}
                onClick={() => setI(first)}
                aria-pressed={active}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold backdrop-blur-md transition-colors duration-200",
                  active ? "border-white bg-white text-[#1b0d17]" : "border-white/20 bg-black/35 text-white/90 hover:bg-black/55",
                )}
              >
                <span className="size-2 rounded-full" style={{ background: SEGMENTS[id].color }} aria-hidden />
                {SEGMENTS[id].name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── legenda + navegação (acima do dock) ──────────────── */}
      <div className="absolute inset-x-0 bottom-[5.75rem] z-10 flex flex-col items-center gap-3 px-3">
        {/* seta no chão, estilo street view */}
        <div className="flex items-end gap-5 [perspective:22rem]">
          <button
            onClick={() => go(-1)}
            disabled={i === 0}
            aria-label="Voltar uma foto"
            className="grid size-12 place-items-center rounded-full border border-white/40 bg-black/40 backdrop-blur-md transition-transform active:scale-95 disabled:opacity-30"
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            onClick={() => go(1)}
            disabled={i === STOPS.length - 1}
            aria-label="Avançar no caminho"
            className="grid size-20 place-items-center rounded-full border-2 border-white bg-[#CF004E]/90 shadow-[0_18px_40px_-10px_#cf004e] backdrop-blur transition-transform [transform:rotateX(48deg)] hover:[transform:rotateX(40deg)] active:scale-95 disabled:opacity-30"
          >
            <ArrowUp className="size-10" strokeWidth={2.5} />
          </button>
          <span className="size-12" aria-hidden />
        </div>

        <div data-caption className={cn("w-full max-w-xl rounded-3xl p-4", glass)}>
          <p className="flex items-center gap-2 text-[0.7rem] font-bold tracking-[0.14em] text-white/70 uppercase">
            <span className="size-2 rounded-full" style={{ background: seg.color }} aria-hidden />
            {seg.name}
          </p>
          <h2 className="mt-1 font-display text-xl leading-tight font-extrabold tracking-tight">{stop.caption}</h2>
          {newSegment && <p className="mt-1.5 text-sm leading-snug text-white/75">{seg.cue}</p>}

          {/* progresso por trecho */}
          <div className="mt-3 flex h-2 gap-0.5" role="group" aria-label="Progresso do passeio">
            {SEG_SPANS.map(({ id, first, count }) => {
              const pct = Math.min(1, Math.max(0, (i - first + 1) / count));
              return (
                <button
                  key={id}
                  onClick={() => setI(first)}
                  aria-label={`Ir para ${SEGMENTS[id].name}`}
                  className="relative h-full overflow-hidden rounded-full bg-white/15"
                  style={{ flexGrow: count }}
                >
                  <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300" style={{ width: `${pct * 100}%`, background: SEGMENTS[id].color }} />
                </button>
              );
            })}
          </div>
          {stop.pessoas && !totem && <p className="mt-2 text-[0.65rem] text-white/45">Foto com pessoas: borrar rostos antes de publicar.</p>}
        </div>
      </div>

      {/* ─── lugares ──────────────────────────────────────────── */}
      {places && (
        <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/55 backdrop-blur-sm" onClick={() => setPlaces(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="places-title"
            onClick={(e) => e.stopPropagation()}
            className="sheet-in flex max-h-[82%] w-full max-w-3xl flex-col overflow-hidden rounded-t-[2rem] border border-white/10 bg-[#1c1018] text-white"
          >
            <div className="flex items-start justify-between gap-3 p-5 pb-3">
              <div>
                <p className="font-display text-[0.7rem] font-bold tracking-[0.2em] text-[#ff3f80] uppercase">Atalhos</p>
                <h2 id="places-title" className="font-display text-2xl font-extrabold tracking-tight">
                  Lugares no passeio
                </h2>
                <p className="text-sm text-white/60">Identificados pelas placas nas fotos</p>
              </div>
              <button onClick={() => setPlaces(false)} aria-label="Fechar" className="grid size-10 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20">
                <X className="size-[1.1rem]" />
              </button>
            </div>
            <ul className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] content-start gap-2.5 overflow-y-auto p-5 pt-2 pb-28">
              {PLACES.map((p) => {
                const idx = stopIndexOf(p.file);
                const color = SEGMENTS[STOPS[idx].segment].color;
                return (
                  <li key={p.name}>
                    <button
                      onClick={() => {
                        setI(idx);
                        setPlaces(false);
                        setPlaying(false);
                      }}
                      className="group relative flex aspect-[3/4] w-full flex-col justify-end overflow-hidden rounded-2xl p-3 text-left ring-1 ring-white/10"
                    >
                      <img
                        src={STOPS[idx].file}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                      <span className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent" />
                      <span className="absolute top-2.5 left-2.5 h-1 w-6 rounded-full" style={{ background: color }} aria-hidden />
                      <span className="relative font-display leading-tight font-extrabold">{p.name}</span>
                      <span className="relative mt-0.5 text-xs leading-snug text-white/70">{p.detail}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
