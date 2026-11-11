"use client";

/* eslint-disable @next/next/no-img-element -- fotos do passeio em rotação, carregadas sob demanda */
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Hand } from "lucide-react";
import { SEMESTER } from "@/lib/alocacao";
import { STOPS } from "@/lib/streetview";

gsap.registerPlugin(useGSAP);

/**
 * Cena do Spline (opcional). Crie a cena no editor do Spline, publique e
 * coloque a URL em NEXT_PUBLIC_SPLINE_SCENE (.env.local). Sem a variável,
 * a tela usa as fotos reais do passeio ao fundo.
 */
const SPLINE_SCENE = process.env.NEXT_PUBLIC_SPLINE_SCENE;
const Spline = dynamic(() => import("@splinetool/react-spline"), { ssr: false });

// fotos originalmente em pé (as deitadas têm faixas desfocadas após a padronização)
const BG = [24, 66, 21, 71, 49, 62, 68, 74, 80, 9].map((n) => STOPS.find((s) => s.n === n)!.file);

const TILES = ["U", "N", "D", "B"];

export default function IdleScreen({ onStart }: { onStart: () => void }) {
  const root = useRef<HTMLButtonElement>(null);
  const [bg, setBg] = useState(0);

  useEffect(() => {
    if (SPLINE_SCENE) return;
    const id = window.setInterval(() => setBg((i) => (i + 1) % BG.length), 5200);
    return () => window.clearInterval(id);
  }, []);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
        tl.from("[data-tile]", { scale: 0.4, rotate: (i: number) => [-14, 10, -8, 12][i], opacity: 0, duration: 1.1, stagger: 0.09 })
          .from("[data-line]", { yPercent: 110, duration: 1, stagger: 0.08 }, "-=0.7")
          .from("[data-fade]", { opacity: 0, y: 16, duration: 0.8, stagger: 0.08 }, "-=0.6");
        gsap.to("[data-tile]", { y: -6, duration: 2.4, ease: "sine.inOut", yoyo: true, repeat: -1, stagger: { each: 0.3, from: "random" }, delay: 1.6 });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  // Ken Burns na foto que entra
  useGSAP(
    () => {
      gsap.fromTo(`[data-bg="${bg}"]`, { scale: 1.12 }, { scale: 1, duration: 6, ease: "power1.out" });
    },
    { scope: root, dependencies: [bg] },
  );

  return (
    <button
      ref={root}
      onClick={onStart}
      aria-label="Toque para começar"
      className="absolute inset-0 z-[var(--z-idle)] flex flex-col overflow-hidden text-left text-white"
      style={{ background: "linear-gradient(160deg, #a8327f 0%, #d9206e 45%, #ee0a3c 100%)" }}
    >
      {/* fundo: Spline (se houver) ou fotos reais do campus */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {SPLINE_SCENE ? (
          <Spline scene={SPLINE_SCENE} className="h-full w-full" />
        ) : (
          BG.map((src, i) => (
            <img
              key={src}
              data-bg={i}
              src={src}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms]"
              style={{ opacity: i === bg ? 1 : 0 }}
              loading={i < 2 ? "eager" : "lazy"}
            />
          ))
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[#8e1a6a]/85 via-[#c3105a]/55 to-[#120a10]/95 mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#120a10] via-[#120a10]/30 to-transparent" />
      </div>

      <div className="relative flex flex-1 flex-col justify-between p-[7%]">
        {/* marca em blocos, como na logo */}
        <div className="grid w-[44%] grid-cols-2 gap-[3%]" aria-hidden>
          {TILES.map((l) => (
            <span
              key={l}
              data-tile
              className="grid aspect-square place-items-center bg-white font-display text-[3.4rem] leading-none font-bold shadow-[0_18px_40px_-14px_rgba(0,0,0,.45)]"
              style={{ color: "#d1237a" }}
            >
              {l}
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-5">
          <p data-fade className="font-display text-sm font-bold tracking-[0.28em] text-[#ffba00] uppercase">
            UNDB Maps
          </p>
          <h1 className="font-display text-[3.6rem] leading-[0.95] font-extrabold tracking-tight">
            <span className="block overflow-hidden">
              <span data-line className="block">
                Ache sua sala
              </span>
            </span>
            <span className="block overflow-hidden">
              <span data-line className="block">
                em segundos.
              </span>
            </span>
          </h1>
          <p data-fade className="max-w-[24rem] text-lg text-white/80">
            Mapa 3D do campus, a sala de cada turma no {SEMESTER}, passeio por fotos e reserva de espaços.
          </p>

          <span data-fade className="mt-4 flex items-center gap-4 rounded-3xl bg-white/12 p-4 ring-1 ring-white/20 backdrop-blur-md">
            <span className="relative grid size-14 place-items-center rounded-full bg-[#ffba00] text-[#1b0d17]">
              <span className="absolute inset-0 animate-ping rounded-full bg-[#ffba00]/60 motion-reduce:hidden" />
              <Hand className="relative size-7" />
            </span>
            <span>
              <span className="block font-display text-xl font-extrabold">Toque para começar</span>
              <span className="block text-sm text-white/70">Totem do campus Renascença</span>
            </span>
          </span>
        </div>
      </div>
    </button>
  );
}
