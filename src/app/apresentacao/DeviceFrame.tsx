"use client";

import { useEffect, useRef, useState } from "react";

/** Mostra uma rota do app dentro de um "aparelho" em escala real (iframe reduzido). */
export default function DeviceFrame({ src, label, width, height, kind }: { src: string; label: string; width: number; height: number; kind: "totem" | "phone" }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);

  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  return (
    <figure className="flex flex-col items-center gap-3">
      <div className={`w-full ${kind === "phone" ? "max-w-[20rem] rounded-[2.6rem] p-2.5" : "max-w-[24rem] rounded-[1.6rem] p-3"} bg-[#2a1622] shadow-2xl ring-1 ring-white/10`}>
        <div ref={box} className={`relative w-full overflow-hidden bg-black ${kind === "phone" ? "rounded-[2rem]" : "rounded-xl"}`} style={{ aspectRatio: `${width} / ${height}` }}>
          <iframe
            src={src}
            title={label}
            width={width}
            height={height}
            className="absolute top-0 left-0 origin-top-left border-0"
            style={{ transform: `scale(${scale})` }}
            allow="camera"
          />
        </div>
        {kind === "totem" && <div className="mx-auto mt-3 h-10 w-1/3 rounded-b-xl bg-[#1b0d17]" aria-hidden />}
      </div>
      <figcaption className="text-sm text-undb-cream/70">{label}</figcaption>
    </figure>
  );
}
