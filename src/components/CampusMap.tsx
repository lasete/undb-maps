"use client";

/**
 * Editor do mapa (SVG sobre o satélite). Os contornos dos prédios vêm do mapa
 * da equipe e ficam fixos; aqui só se ajusta o portão / posição do totem.
 */
import { useRef, useState } from "react";
import { Minus, Plus, LocateFixed } from "lucide-react";
import { AREAS, BUILDINGS, MAP, type BuildingId, type Layout } from "@/lib/campus";

const { width: W, height: H } = MAP;

export interface BuildingStats {
  free: number;
  total: number;
}

interface Props {
  layout: Layout;
  onLayout: (l: Layout) => void;
  selected?: BuildingId | null;
}

export default function CampusMap({ layout, onLayout, selected }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const drag = useRef<null | { kind: "pan" | "gate"; px: number; py: number; ox: number; oy: number }>(null);

  const frame = () => {
    const r = svgRef.current!.getBoundingClientRect();
    const s = Math.min(r.width / W, r.height / H);
    return { s, r, ox: (r.width - W * s) / 2, oy: (r.height - H * s) / 2 };
  };
  const toView = (cx: number, cy: number) => {
    const { s, r, ox, oy } = frame();
    return { x: (cx - r.left - ox) / s, y: (cy - r.top - oy) / s };
  };
  const clamp = (v: { k: number; x: number; y: number }) => ({
    k: v.k,
    x: Math.min(0, Math.max(W - W * v.k, v.x)),
    y: Math.min(0, Math.max(H - H * v.k, v.y)),
  });
  const zoomAt = (f: number, p = { x: W / 2, y: H / 2 }) =>
    setView((v) => {
      const k = Math.min(5, Math.max(1, v.k * f));
      const q = k / v.k;
      return clamp({ k, x: p.x - (p.x - v.x) * q, y: p.y - (p.y - v.y) * q });
    });

  const onDown = (e: React.PointerEvent, kind: "pan" | "gate") => {
    e.stopPropagation();
    svgRef.current!.setPointerCapture(e.pointerId);
    drag.current = { kind, px: e.clientX, py: e.clientY, ox: layout.gate.x, oy: layout.gate.y };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const { s } = frame();
    if (d.kind === "gate") {
      const dx = (e.clientX - d.px) / s / view.k;
      const dy = (e.clientY - d.py) / s / view.k;
      onLayout({ ...layout, gate: { x: Math.round(d.ox + dx), y: Math.round(d.oy + dy) } });
    } else {
      const dx = (e.clientX - d.px) / s;
      const dy = (e.clientY - d.py) / s;
      d.px = e.clientX;
      d.py = e.clientY;
      setView((v) => clamp({ k: v.k, x: v.x + dx, y: v.y + dy }));
    }
  };

  const pts = (p: [number, number][]) => p.map((q) => q.join(",")).join(" ");
  const g = layout.gate;

  return (
    <div className="relative h-full w-full touch-none overflow-hidden bg-[#2b2a26] select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        role="img"
        aria-label="Editor do mapa do campus"
        onPointerDown={(e) => onDown(e, "pan")}
        onPointerMove={onMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onWheel={(e) => zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, toView(e.clientX, e.clientY))}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          <image href={MAP.image} width={W} height={H} preserveAspectRatio="none" />
          {AREAS.map((a) => (
            <polygon
              key={a.id}
              points={pts(a.poly)}
              fill={a.kind === "fora" ? "#ff202022" : "#ff9a1f33"}
              stroke={a.kind === "fora" ? "#ff2020" : "#ff9a1f"}
              strokeWidth={4}
              strokeDasharray="12 8"
            />
          ))}
          {BUILDINGS.map((b) => (
            <polygon key={b.id} points={pts(b.poly)} fill={`${b.color}${selected === b.id ? "66" : "33"}`} stroke={b.color} strokeWidth={6} />
          ))}
          <g onPointerDown={(e) => onDown(e, "gate")} className="cursor-move">
            <circle cx={g.x} cy={g.y} r={30} fill="#FFBA0055" />
            <circle cx={g.x} cy={g.y} r={16} fill="#FFBA00" stroke="#1B0D17" strokeWidth={5} />
          </g>
        </g>
      </svg>
      <div className="absolute right-3 bottom-40 flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <button aria-label="Aproximar" onClick={() => zoomAt(1.4)} className="grid size-11 place-items-center hover:bg-muted">
          <Plus className="size-5" />
        </button>
        <button aria-label="Afastar" onClick={() => zoomAt(1 / 1.4)} className="grid size-11 place-items-center border-t border-border hover:bg-muted">
          <Minus className="size-5" />
        </button>
        <button aria-label="Centralizar mapa" onClick={() => setView({ k: 1, x: 0, y: 0 })} className="grid size-11 place-items-center border-t border-border hover:bg-muted">
          <LocateFixed className="size-5" />
        </button>
      </div>
    </div>
  );
}
