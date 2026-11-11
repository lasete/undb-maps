"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Sparkles } from "lucide-react";
import { BUILDINGS, getBuilding, type BuildingId, type Layout } from "@/lib/campus";
import { planRoute } from "@/lib/route";
import { Chip } from "./ui";

/**
 * Realidade aumentada · CONCEITO para a apresentação.
 * Mostra a câmera traseira com a seta e a distância real até o prédio.
 * A versão final pode usar WebXR + marcadores (QR nas paredes) para ancorar
 * a seta dentro dos corredores.
 */
export default function ARView({ layout, initial }: { layout: Layout; initial: BuildingId | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [target, setTarget] = useState<BuildingId>(initial ?? "norte");
  const [cam, setCam] = useState<"off" | "on" | "erro">("off");

  const route = planRoute(layout, target);
  const b = getBuilding(target);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCam("on");
    } catch {
      setCam("erro");
    }
  };

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCam("off");
  };

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#120810] text-white">
      <video ref={videoRef} playsInline muted className={`absolute inset-0 h-full w-full object-cover ${cam === "on" ? "" : "hidden"}`} />
      {cam !== "on" && (
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "linear-gradient(180deg,#120810 0%,#2a1222 55%,#3d1a2f 100%), repeating-linear-gradient(90deg,transparent 0 59px,#ffffff10 59px 60px)",
            backgroundBlendMode: "normal",
          }}
        />
      )}
      {/* chão em perspectiva */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 [perspective:40rem]">
        <div className="absolute inset-x-[-50%] bottom-[-20%] h-[140%] origin-bottom [transform:rotateX(70deg)] bg-[repeating-linear-gradient(0deg,#ffffff18_0_2px,transparent_2px_60px),repeating-linear-gradient(90deg,#ffffff18_0_2px,transparent_2px_60px)]" />
      </div>

      {/* seta */}
      <div className="pointer-events-none absolute inset-x-0 top-[46%] flex justify-center [perspective:30rem]">
        <svg viewBox="0 0 120 160" className="w-[38%] max-w-56 drop-shadow-[0_12px_24px_rgba(0,0,0,.5)] motion-safe:animate-[ar-bob_1.6s_ease-in-out_infinite]" style={{ transform: "rotateX(55deg)" }} aria-hidden>
          <defs>
            <linearGradient id="arg" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#CF004E" />
              <stop offset="1" stopColor="#FB2A41" />
            </linearGradient>
          </defs>
          <path d="M60 0 L120 70 L84 70 L84 160 L36 160 L36 70 L0 70 Z" fill="url(#arg)" stroke="#fff" strokeWidth={4} />
        </svg>
      </div>

      {/* etiqueta ancorada */}
      <div className="absolute top-[22%] left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-2 rounded-2xl bg-[#1B0D17E6] px-3 py-2 shadow-xl backdrop-blur">
          <span className="grid size-9 place-items-center rounded-lg font-display text-lg font-extrabold" style={{ background: b.color }}>
            {b.tile}
          </span>
          <span>
            <span className="block font-display font-extrabold">{b.name}</span>
            <span className="block text-sm text-white/80 tabular">
              ~{route.meters} m · {route.minutes} min a pé
            </span>
          </span>
        </div>
      </div>

      {/* topo */}
      <div className="absolute inset-x-0 top-0 flex flex-col gap-3 bg-gradient-to-b from-black/70 to-transparent p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-signal" />
          <span className="font-display text-xs font-bold tracking-[0.16em] uppercase">Realidade aumentada</span>
          <span className="ml-auto rounded-full bg-signal px-2.5 py-1 font-display text-[0.65rem] font-extrabold tracking-[0.12em] text-undb-ink uppercase">
            Em desenvolvimento
          </span>
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto [&_button]:border-white/30 [&_button]:bg-black/40 [&_button]:text-white [&_button[aria-pressed=true]]:bg-white [&_button[aria-pressed=true]]:text-[#1B0D17]">
          {BUILDINGS.map((x) => (
            <Chip key={x.id} active={target === x.id} onClick={() => setTarget(x.id)}>
              {x.name}
            </Chip>
          ))}
        </div>
      </div>

      {/* base */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12 pb-[6.25rem]">
        {cam === "erro" && <p className="text-sm text-[#ff9aa8]">Não foi possível abrir a câmera. Verifique a permissão do navegador (precisa de HTTPS).</p>}
        <button
          onClick={cam === "on" ? stop : start}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white font-semibold text-[#1B0D17]"
        >
          {cam === "on" ? <CameraOff className="size-5" /> : <Camera className="size-5" />}
          {cam === "on" ? "Desligar câmera" : "Ativar câmera"}
        </button>
        <p className="text-center text-xs text-white/70">
          Prévia do conceito (WIP). Próxima fase: WebXR com marcadores nos corredores para guiar até a porta da sala.
        </p>
      </div>
    </div>
  );
}
