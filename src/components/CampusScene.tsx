"use client";

/**
 * Cena WebGL do campus (Three.js + React Three Fiber + GSAP).
 * Uma cena só para "Satélite", "Mapa" e "3D": muda o chão e a câmera voa
 * entre a vista de cima e a inclinada. Os prédios são extrudados a partir do
 * CONTORNO REAL (mapa da equipe sobre o satélite), com o telhado recortado da
 * própria imagem. Coordenadas = pixels da imagem (1 unidade = 100 px ≈ 14,9 m).
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls, useTexture } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { AREAS, BUILDINGS, MAP, bbox, centroid, type Building as BuildingData, type BuildingId, type Layout, type Pt } from "@/lib/campus";
import type { RoutePlan } from "@/lib/route";

export type SceneView = "satelite" | "mapa" | "3d";

// Em máquinas fracas (ou com quadros atrasados), o GSAP por padrão "estica" as
// animações. Aqui preferimos que a câmera chegue no tempo certo, mesmo pulando quadros.
gsap.ticker.lagSmoothing(0);

export interface SceneStats {
  free: number;
  total: number;
}

const X = (x: number) => (x - MAP.width / 2) / 100;
const Z = (y: number) => (y - MAP.height / 2) / 100;
const M = 1 / (100 * MAP.metersPerPx); // metros → unidades
// Altura ILUSTRATIVA: pavimentos de ~3,8 m (a UNDB não publica), com exagero
// vertical de 1,6× para os volumes ficarem legíveis de longe (comum em mapas 3D)
const EXAG = 1.6;
const FLOOR_H = 3.8 * M * EXAG;

const THEME = {
  dark: { bg: "#120a10", ground: "#8a7883", wall: "#2b1c26", wallLine: "#3d2a36", street: "#0c0609", window: "#130a10", lit: "#ffcf8a", ghost: "#9a8a94" },
  light: { bg: "#fbf6f2", ground: "#ffffff", wall: "#f7efe9", wallLine: "#e3d3c8", street: "#e6dad2", window: "#9fb3c4", lit: "#fff1cf", ghost: "#8a7a84" },
};

/* ------------------------------------------------------------------ texturas */

function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

/** Fachada procedural: faixas de laje + janelas em trios, algumas acesas. */
function facade(lenUnits: number, floors: number, dark: boolean, seed: number) {
  const t = dark ? THEME.dark : THEME.light;
  const ppu = 300;
  const w = Math.max(64, Math.round(lenUnits * ppu));
  const fh = 96;
  const h = fh * floors;
  const base = document.createElement("canvas");
  base.width = w;
  base.height = h;
  const glow = document.createElement("canvas");
  glow.width = w;
  glow.height = h;
  const b = base.getContext("2d")!;
  const g = glow.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, w, h);
  b.fillStyle = t.wall;
  b.fillRect(0, 0, w, h);
  const rnd = seeded(seed);
  for (let f = 0; f < floors; f++) {
    const y0 = f * fh;
    b.fillStyle = t.wallLine;
    b.fillRect(0, y0, w, 6);
    const winW = 14;
    const gap = 5;
    const bay = 3 * (winW + gap) + 14;
    for (let x = 10; x + bay < w; x += bay) {
      const lit = rnd() < (dark ? 0.38 : 0.1);
      const warm = rnd() < 0.5 ? t.lit : dark ? "#ffe2b8" : t.lit;
      for (let k = 0; k < 3; k++) {
        const wx = x + k * (winW + gap);
        b.fillStyle = lit ? warm : t.window;
        b.fillRect(wx, y0 + 30, winW, 38);
        if (lit) {
          g.fillStyle = warm;
          g.fillRect(wx, y0 + 30, winW, 38);
        }
      }
    }
  }
  const map = new THREE.CanvasTexture(base);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const emissive = new THREE.CanvasTexture(glow);
  emissive.colorSpace = THREE.SRGBColorSpace;
  return { map, emissive };
}

function radialTexture(inner = 0.62) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const grd = ctx.createRadialGradient(128, 128, 30, 128, 128, 128);
  grd.addColorStop(0, "#fff");
  grd.addColorStop(inner, "#fff");
  grd.addColorStop(1, "#000");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/** Forma (THREE.Shape) a partir de um contorno em pixels; y invertido para girar no chão. */
function shapeOf(poly: Pt[]) {
  const s = new THREE.Shape();
  poly.forEach(([x, y], i) => (i ? s.lineTo(X(x), -Z(y)) : s.moveTo(X(x), -Z(y))));
  s.closePath();
  return s;
}

/** Textura de satélite mapeada para coordenadas de mundo (para telhados e áreas). */
function worldSat(tex: THREE.Texture) {
  const t = tex.clone();
  t.needsUpdate = true;
  t.repeat.set(100 / MAP.width, 100 / MAP.height);
  t.offset.set(0.5, 0.5);
  return t;
}

/* -------------------------------------------------------------------- chão */

function Ground({ view, dark, sat }: { view: SceneView; dark: boolean; sat: THREE.Texture }) {
  const fade = useMemo(() => radialTexture(0.7), []);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const t = dark ? THEME.dark : THEME.light;

  useEffect(() => {
    if (!mat.current) return;
    gsap.to(mat.current, { opacity: view === "mapa" ? 0 : 1, duration: 0.8, ease: "power2.out" });
  }, [view]);

  const avenue = useMemo(() => {
    const { origin: o, dir: d, normal: n } = MAP.avenue;
    const p = (s: number, k: number) => new THREE.Vector2(X(o.x + s * d.x + k * n.x), -Z(o.y + s * d.y + k * n.y));
    return new THREE.Shape([p(-900, 18), p(700, 18), p(700, 300), p(-900, 300)]);
  }, []);

  return (
    <group>
      {/* avenida: só no modo "Mapa" (no satélite ela já aparece na foto) */}
      {view === "mapa" && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.001}>
          <shapeGeometry args={[avenue]} />
          <meshBasicMaterial color={t.street} toneMapped={false} />
        </mesh>
      )}
      <mesh rotation-x={-Math.PI / 2} position-y={0.004}>
        <planeGeometry args={[MAP.width / 100, MAP.height / 100]} />
        <meshBasicMaterial ref={mat} map={sat} alphaMap={fade} color={t.ground} transparent toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.006} receiveShadow>
        <planeGeometry args={[MAP.width / 100, MAP.height / 100]} />
        <shadowMaterial opacity={dark ? 0.55 : 0.22} />
      </mesh>
    </group>
  );
}

/* ---------------------------------------------- garagem e Colégio Dom Bosco */

function Areas({ dark }: { dark: boolean }) {
  const t = dark ? THEME.dark : THEME.light;
  return (
    <group>
      {AREAS.map((a, i) => {
        const shape = shapeOf(a.poly);
        const outline = [...a.poly, a.poly[0]].map(([x, y]) => [X(x), a.kind === "fora" ? 0.02 : 0.015, Z(y)] as [number, number, number]);
        const [cx, cy] = centroid(a.poly);
        const firstOfName = AREAS.findIndex((b) => b.name === a.name) === i;
        if (a.kind === "servico") {
          return (
            <group key={a.id}>
              <mesh rotation-x={-Math.PI / 2} position-y={0.012}>
                <shapeGeometry args={[shape]} />
                <meshBasicMaterial color="#ff9a1f" transparent opacity={dark ? 0.22 : 0.28} depthWrite={false} toneMapped={false} />
              </mesh>
              <Line points={outline} color="#ff9a1f" lineWidth={2} dashed dashSize={0.1} gapSize={0.07} />
              <Html position={[X(cx), 0.05, Z(cy)]} center zIndexRange={[15, 0]} style={{ pointerEvents: "none" }}>
                <span className="rounded-full bg-[#ff9a1f] px-2 py-0.5 font-display text-[10px] font-bold whitespace-nowrap text-[#1b0d17] shadow">{a.name}</span>
              </Html>
            </group>
          );
        }
        // Colégio Dom Bosco: volume fantasma, fora do mapeamento
        return (
          <group key={a.id}>
            <mesh rotation-x={-Math.PI / 2}>
              <extrudeGeometry args={[shape, { depth: 3 * FLOOR_H, bevelEnabled: false }]} />
              <meshStandardMaterial color={t.ghost} transparent opacity={dark ? 0.16 : 0.22} depthWrite={false} />
            </mesh>
            <Line points={outline} color={dark ? "#a08d98" : "#8a7a84"} lineWidth={1.2} dashed dashSize={0.08} gapSize={0.08} transparent opacity={0.8} />
            {firstOfName && (
              <Html position={[X(cx), 3 * FLOOR_H + 0.15, Z(cy)]} center zIndexRange={[15, 0]} style={{ pointerEvents: "none" }}>
                <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-white/80 ring-1 ring-white/15 backdrop-blur">
                  Colégio Dom Bosco · fora do mapa
                </span>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

/* ------------------------------------------------------------------ prédios */

interface BuildingProps {
  b: BuildingData;
  selected: boolean;
  dimmed: boolean;
  dark: boolean;
  stats?: SceneStats;
  index: number;
  sat: THREE.Texture;
  onSelect: (id: BuildingId) => void;
}

function Building({ b, selected, dimmed, dark, stats, index, sat, onSelect }: BuildingProps) {
  const h = b.floors * FLOOR_H;
  const group = useRef<THREE.Group>(null);
  const halo = useRef<THREE.MeshBasicMaterial>(null);
  const [hover, setHover] = useState(false);
  const box = bbox(b.poly);
  const [cx, cy] = centroid(b.poly);

  const { walls, roofMat, roofShape, mats } = useMemo(() => {
    const mats: THREE.Material[] = [];
    const walls = b.poly.map(([ax, ay], i) => {
      const [bx, by] = b.poly[(i + 1) % b.poly.length];
      const A = new THREE.Vector2(X(ax), Z(ay));
      const B = new THREE.Vector2(X(bx), Z(by));
      const len = A.distanceTo(B);
      const f = facade(len, b.floors, dark, 7 + index * 31 + i * 13);
      const m = new THREE.MeshStandardMaterial({
        map: f.map,
        emissiveMap: f.emissive,
        emissive: new THREE.Color("#ffffff"),
        emissiveIntensity: dark ? 1.25 : 0.15,
        roughness: 0.85,
        side: THREE.DoubleSide,
      });
      mats.push(m);
      return {
        len,
        mid: [(A.x + B.x) / 2, h / 2, (A.y + B.y) / 2] as [number, number, number],
        rotY: Math.atan2(-(B.y - A.y), B.x - A.x),
        mat: m,
      };
    });
    // telhado = recorte REAL da imagem de satélite
    const roofMat = new THREE.MeshBasicMaterial({ map: worldSat(sat), color: dark ? "#c2b0ba" : "#ffffff", toneMapped: false });
    mats.push(roofMat);
    return { walls, roofMat, roofShape: shapeOf(b.poly), mats };
  }, [b, dark, index, sat, h]);

  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);

  // entrada: os prédios "crescem" do chão
  useEffect(() => {
    if (!group.current) return;
    gsap.fromTo(group.current.scale, { y: 0.001 }, { y: 1, duration: 1.1, delay: 0.35 + index * 0.1, ease: "expo.out" });
  }, [index]);

  useEffect(() => {
    if (!halo.current) return;
    gsap.to(halo.current, { opacity: selected ? 0.85 : hover ? 0.4 : 0, duration: 0.35 });
  }, [selected, hover]);

  // não selecionados escurecem (sem transparência, para não "vazar" o halo)
  useEffect(() => {
    const k = dimmed ? 0.45 : 1;
    mats.forEach((m) => gsap.to((m as THREE.MeshStandardMaterial).color, { r: k, g: k, b: k, duration: 0.45 }));
  }, [dimmed, mats, roofMat]);

  const haloTex = useMemo(() => radialTexture(0), []);
  const edge = [...b.poly, b.poly[0]].map(([x, y]) => [X(x), h + 0.025, Z(y)] as [number, number, number]);
  const pointer = {
    onClick: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onSelect(b.id);
    },
    onPointerOver: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      setHover(true);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      setHover(false);
      document.body.style.cursor = "";
    },
  };

  return (
    <group>
      {/* halo no chão */}
      <mesh rotation-x={-Math.PI / 2} position={[X(box.x + box.w / 2), 0.01, Z(box.y + box.h / 2)]}>
        <planeGeometry args={[box.w / 100 + 1.8, box.h / 100 + 1.8]} />
        <meshBasicMaterial ref={halo} map={haloTex} color={b.color} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>

      <group ref={group}>
        {walls.map((w, i) => (
          <mesh key={i} position={w.mid} rotation-y={w.rotY} material={w.mat} castShadow {...pointer}>
            <planeGeometry args={[w.len, h]} />
          </mesh>
        ))}
        <mesh rotation-x={-Math.PI / 2} position-y={h} material={roofMat} castShadow {...pointer}>
          <shapeGeometry args={[roofShape]} />
        </mesh>
        {/* platibanda na cor do prédio */}
        <Line points={edge} color={b.color} lineWidth={selected ? 5 : 3} toneMapped={false} />
      </group>

      {/* pino */}
      <Html position={[X(cx), h + 0.3, Z(cy)]} center zIndexRange={[20, 0]}>
        <button
          data-pin
          onClick={() => onSelect(b.id)}
          className={`group flex items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1 font-display text-[11px] font-bold whitespace-nowrap shadow-[0_6px_20px_rgba(0,0,0,.35)] ring-1 backdrop-blur-md transition-[background-color,transform] duration-200 hover:scale-105 ${
            selected ? "bg-[#CF004E] text-white ring-white/40" : "bg-[#120a10]/85 text-white ring-white/15"
          }`}
          aria-label={`${b.name}${stats && stats.total ? `, ${stats.free} de ${stats.total} salas livres agora` : ""}`}
        >
          <span className="grid size-5 place-items-center rounded-[5px] text-[10px]" style={{ background: selected ? "#fff" : b.color, color: selected ? b.color : "#fff" }}>
            {b.tile}
          </span>
          {selected ? b.name : b.short}
          {stats && stats.total > 0 && (
            <span className="flex items-center gap-1 font-sans text-[10px] font-medium text-white/80">
              <span className={`size-1.5 rounded-full ${stats.free > 0 ? "bg-[#5fd0e0]" : "bg-[#ff8197]"}`} />
              {stats.free}
            </span>
          )}
        </button>
      </Html>
    </group>
  );
}

/* ---------------------------------------------------- "você está aqui" e rota */

function Here({ x, y, label }: { x: number; y: number; label: string }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const k = (clock.elapsedTime % 1.8) / 1.8;
    ring.current.scale.setScalar(0.6 + k * 1.8);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k);
  });
  return (
    <group position={[X(x), 0.02, Z(y)]}>
      <mesh ref={ring} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.1, 0.14, 48]} />
        <meshBasicMaterial color="#ffba00" transparent toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.085, 40]} />
        <meshBasicMaterial color="#ffba00" toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.001}>
        <ringGeometry args={[0.085, 0.105, 40]} />
        <meshBasicMaterial color="#1b0d17" toneMapped={false} />
      </mesh>
      <Html position={[0, 0.05, 0]} center zIndexRange={[19, 0]} style={{ pointerEvents: "none" }}>
        <div className="-translate-y-6 rounded-full bg-[#ffba00] px-2.5 py-1 font-display text-[11px] font-extrabold whitespace-nowrap text-[#1b0d17] shadow-lg">{label}</div>
      </Html>
    </group>
  );
}

function Route({ route }: { route: RoutePlan }) {
  // arco por cima dos prédios: é a distância em linha reta, não um caminho pelas paredes
  const curve = useMemo(() => {
    const a = new THREE.Vector3(X(route.from.x), 0.03, Z(route.from.y));
    const b = new THREE.Vector3(X(route.to.x), 0.03, Z(route.to.y));
    const mid = a.clone().lerp(b, 0.5);
    mid.y = Math.max(0.7, a.distanceTo(b) * 0.3);
    return new THREE.QuadraticBezierCurve3(a, mid, b);
  }, [route.from.x, route.from.y, route.to.x, route.to.y]);
  const all = useMemo(() => curve.getPoints(64), [curve]);
  const [count, setCount] = useState(2);
  const progress = useRef({ v: 0 });
  const dot = useRef<THREE.Mesh>(null);

  useEffect(() => {
    progress.current.v = 0;
    const tw = gsap.to(progress.current, {
      v: 1,
      duration: 1.2,
      ease: "power2.inOut",
      onUpdate: () => setCount(Math.max(2, Math.round(progress.current.v * all.length))),
    });
    return () => {
      tw.kill();
    };
  }, [all]);

  useFrame(({ clock }) => {
    if (!dot.current || progress.current.v < 1) return;
    dot.current.position.copy(curve.getPoint((clock.elapsedTime * 0.4) % 1));
  });

  const pts = all.slice(0, count);
  const end = all[all.length - 1];
  return (
    <group>
      <Line points={pts} color="#ffffff" lineWidth={8} transparent opacity={0.18} />
      <Line points={pts} color="#ff3f80" lineWidth={3.5} toneMapped={false} />
      <mesh ref={dot} position={all[0]}>
        <sphereGeometry args={[0.05, 16, 12]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh position={[end.x, 0.02, end.z]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.08, 0.12, 32]} />
        <meshBasicMaterial color="#ff3f80" toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ câmera */

/* A câmera e os controles do three.js são objetos externos ao React e
   animados de forma imperativa pelo GSAP (padrão do R3F). */
/* eslint-disable react-hooks/immutability */
const tilt0 = (v: SceneView) => v === "3d";
function Rig({ view, focus, route, intro }: { view: SceneView; focus: BuildingId | null; route: RoutePlan | null; intro: boolean }) {
  const { camera, size } = useThree();
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const first = useRef(true);

  useEffect(() => {
    if (!controls) return;
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const vfov = (cam.fov * Math.PI) / 180;
    // a barra do topo e o dock de baixo ficam por cima do mapa: desce um pouco o quadro
    let box = { ...MAP.focus, y1: MAP.focus.y1 + 90 };
    if (focus) {
      const r = bbox(BUILDINGS.find((b) => b.id === focus)!.poly);
      const m = 160;
      const shift = aspect > 1.2 ? r.w * 0.35 + 120 : 0; // painel à direita no computador
      box = { x0: r.x - m, x1: r.x + r.w + m + shift, y0: r.y - m * 1.6, y1: r.y + r.h + m * 1.6 };
    }
    if (route) {
      const g = route.from;
      box = { x0: Math.min(box.x0, g.x - 120), x1: Math.max(box.x1, g.x + 120), y0: Math.min(box.y0, g.y - 120), y1: Math.max(box.y1, g.y + 140) };
    }
    const bw = (box.x1 - box.x0) / 100;
    const bh = (box.y1 - box.y0) / 100;
    // folga para a barra superior e o dock, que ficam por cima do mapa
    const fit = Math.max(bh / (2 * Math.tan(vfov / 2)), bw / (2 * Math.tan(vfov / 2) * aspect)) * (focus ? 1.15 : tilt0(view) ? 1.08 : 1.2);
    const target = new THREE.Vector3(X((box.x0 + box.x1) / 2), 0, Z((box.y0 + box.y1) / 2));
    const tilt = view === "3d";
    const polar = tilt ? 0.92 : 0.0001;
    const azim = tilt ? 0.28 : 0;
    const dist = tilt ? fit * (route ? 0.9 : focus ? 1.2 : 0.86) : fit;
    const dest = new THREE.Vector3(
      target.x + dist * Math.sin(polar) * Math.sin(azim),
      dist * Math.cos(polar),
      target.z + dist * Math.sin(polar) * Math.cos(azim),
    );

    controls.minPolarAngle = 0;
    controls.maxPolarAngle = 1.25;
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.enableRotate = tilt;

    if (first.current && intro) cam.position.set(dest.x + 4, dest.y + 14, dest.z + 10);
    const dur = first.current ? 2.2 : 1.1;
    first.current = false;
    const tl = gsap.timeline({ defaults: { duration: dur, ease: "expo.inOut" }, onUpdate: () => controls.update() });
    tl.to(cam.position, { x: dest.x, y: dest.y, z: dest.z }, 0).to(controls.target, { x: target.x, y: target.y, z: target.z }, 0);
    tl.eventCallback("onComplete", () => {
      cam.position.copy(dest);
      controls.target.copy(target);
      if (!tilt) {
        // vista de cima: norte sempre para cima
        controls.maxPolarAngle = 0.0001;
        controls.minAzimuthAngle = 0;
        controls.maxAzimuthAngle = 0;
      }
      controls.update();
    });
    return () => {
      tl.kill();
    };
  }, [view, focus, route, size.width, size.height, camera, controls, intro]);

  return null;
}
/* eslint-enable react-hooks/immutability */

/* -------------------------------------------------------------------- cena */

function World({
  view,
  layout,
  selected,
  route,
  stats,
  hereLabel,
  dark,
  onSelect,
}: Omit<Props, "onBackground">) {
  const [night, day] = useTexture(["/campus/satelite-noite.jpg", "/campus/satelite-dia.jpg"], (texs) => {
    for (const tx of texs) {
      tx.colorSpace = THREE.SRGBColorSpace;
      tx.anisotropy = 8;
    }
  });
  const sat = dark ? night : day;
  return (
    <>
      <Ground view={view} dark={dark} sat={sat} />
      <Areas dark={dark} />
      {BUILDINGS.map((b, i) => (
        <Building
          key={b.id}
          b={b}
          index={i}
          selected={selected === b.id}
          dimmed={!!selected && selected !== b.id}
          dark={dark}
          stats={stats[b.id]}
          sat={sat}
          onSelect={onSelect}
        />
      ))}
      {route && <Route route={route} />}
      <Here x={layout.gate.x} y={layout.gate.y} label={hereLabel} />
    </>
  );
}

interface Props {
  view: SceneView;
  layout: Layout;
  selected: BuildingId | null;
  route: RoutePlan | null;
  stats: Record<BuildingId, SceneStats>;
  hereLabel: string;
  dark: boolean;
  onSelect: (id: BuildingId) => void;
  onBackground?: () => void;
}

export default function CampusScene(props: Props) {
  const { view, selected, route, dark, onBackground } = props;
  const t = dark ? THEME.dark : THEME.light;
  return (
    <div className="absolute inset-0" style={{ background: t.bg }}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ fov: 38, near: 0.1, far: 140, position: [0, 30, 20] }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onPointerMissed={(e) => {
          // cliques nos pinos (HTML por cima do canvas) não contam como "clicar no vazio"
          if ((e.target as HTMLElement | null)?.closest?.("[data-pin]")) return;
          onBackground?.();
        }}
        aria-label="Mapa 3D do campus da UNDB"
      >
        <color attach="background" args={[t.bg]} />
        <fog attach="fog" args={[t.bg, 32, 80]} />
        <hemisphereLight args={[dark ? "#5a4a8a" : "#fff8f0", dark ? "#120a10" : "#d9c9bf", dark ? 0.6 : 1.1]} />
        <directionalLight
          position={[-7, 12, 6]}
          intensity={dark ? 0.9 : 2.2}
          color={dark ? "#b9a8ff" : "#fff3e2"}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={9}
          shadow-camera-bottom={-9}
          shadow-bias={-0.0004}
        />

        <Suspense fallback={null}>
          <World {...props} />
        </Suspense>

        <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={2.5} maxDistance={32} screenSpacePanning />
        <Rig view={view} focus={selected} route={route} intro />

        {dark && (
          <EffectComposer multisampling={0}>
            <Bloom mipmapBlur intensity={0.7} luminanceThreshold={0.62} luminanceSmoothing={0.2} />
            <Vignette offset={0.25} darkness={0.55} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
