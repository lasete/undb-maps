"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  Box,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Download,
  Footprints,
  Layers,
  Map as MapIcon,
  RotateCcw,
  Satellite,
  ScanLine,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { BUILDINGS, DEFAULT_LAYOUT, getBuilding, getRoom, scheduledRoomsOf, type BuildingId, type Room } from "@/lib/campus";
import { SHIFT_LABEL, shiftAt } from "@/lib/alocacao";
import { roomStatusNow } from "@/lib/status";
import { planRoute, type RoutePlan } from "@/lib/route";
import { stopIndexOf } from "@/lib/streetview";
import { useLayout, useNow, useReservations, useSettings, type Settings } from "@/lib/store";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import CampusMap, { type BuildingStats } from "./CampusMap";
import DetailPanel, { type PanelTarget } from "./DetailPanel";
import RoomList from "./RoomList";
import Reservations from "./Reservations";
import ARView from "./ARView";
import StreetView from "./StreetView";
import SettingsPanel from "./SettingsPanel";
import IdleScreen from "./IdleScreen";

gsap.registerPlugin(useGSAP);

const CampusScene = dynamic(() => import("./CampusScene"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 grid place-items-center bg-background text-sm text-muted-foreground">Carregando o campus…</div>,
});

type Tab = "mapa" | "salas" | "passeio" | "reservas" | "ra";
type View = Settings["view"];

const IDLE_MS = 60_000;

const VIEWS: [View, string, typeof Satellite][] = [
  ["satelite", "Satélite", Satellite],
  ["mapa", "Mapa", MapIcon],
  ["3d", "3D", Box],
  ["predios", "Prédios", Building2],
];

const TABS: [Tab, string, typeof Layers][] = [
  ["mapa", "Mapa", Layers],
  ["salas", "Salas", Search],
  ["passeio", "Passeio", Footprints],
  ["reservas", "Reservas", CalendarCheck],
  ["ra", "RA", ScanLine],
];

function useSystemDark() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(prefers-color-scheme: dark)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false,
  );
}

/** vidro: fundo translúcido + desfoque (só em elementos fixos/flutuantes) */
const glass = "border border-border/70 bg-card/80 shadow-[0_10px_40px_-12px_rgba(18,10,16,.45)] backdrop-blur-xl";

export default function MapsApp({ variant }: { variant: "mobile" | "totem" }) {
  const totem = variant === "totem";
  const [settings, setSettings] = useSettings();
  const [layout, setLayout] = useLayout();
  const { reservations, add, cancel } = useReservations();
  const now = useNow(settings.demoClock);
  const systemDark = useSystemDark();
  const dark = settings.contrast || settings.theme === "dark" || (settings.theme === "system" && systemDark);

  const [tab, setTab] = useState<Tab>("mapa");
  const [panel, setPanel] = useState<PanelTarget | null>(null);
  const [panelMode, setPanelMode] = useState<"info" | "reserve">("info");
  const [route, setRoute] = useState<RoutePlan | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [idle, setIdle] = useState(totem);
  const [focusSearch, setFocusSearch] = useState(false);
  const [tourStart, setTourStart] = useState(0);
  const view = settings.view;
  const root = useRef<HTMLDivElement>(null);

  /* ----- tema, contraste, escala e classe do totem no <html> */
  useEffect(() => {
    const html = document.documentElement;
    if (settings.theme === "system") html.removeAttribute("data-theme");
    else html.setAttribute("data-theme", settings.theme);
    if (settings.contrast) html.setAttribute("data-contrast", "high");
    else html.removeAttribute("data-contrast");
    html.style.setProperty("--fs-mult", settings.largeText ? "1.2" : "1");
    html.classList.toggle("totem", totem);
  }, [settings.theme, settings.contrast, settings.largeText, totem]);

  /* ----- entrada da interface (GSAP) */
  useGSAP(
    () => {
      if (idle) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-anim=top]", { y: -24, opacity: 0, duration: 0.8, ease: "expo.out", delay: 0.2 });
        gsap.from("[data-anim=dock]", { y: 28, opacity: 0, duration: 0.8, ease: "expo.out", delay: 0.35 });
        gsap.from("[data-anim=views]", { y: 16, opacity: 0, duration: 0.7, ease: "expo.out", delay: 0.55 });
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [idle] },
  );

  const selectedBuilding: BuildingId | null = panel ? (panel.kind === "building" ? panel.id : getRoom(panel.id)!.building) : null;

  const openBuilding = useCallback((id: BuildingId) => {
    setPanel({ kind: "building", id });
    setPanelMode("info");
  }, []);

  const openRoom = useCallback((r: Room, mode: "info" | "reserve" = "info") => {
    setPanel({ kind: "room", id: r.id });
    setPanelMode(mode);
  }, []);

  const goRoute = useCallback(
    (b: BuildingId, room?: Room) => {
      setRoute(planRoute(layout, b, room));
      setTab("mapa");
      if (settings.view === "predios") setSettings({ view: "3d" });
    },
    [layout, settings.view, setSettings],
  );

  /* ----- deep link (QR do totem → celular): ?sala=302  ?predio=norte */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const sala = q.get("sala");
    const predio = q.get("predio") as BuildingId | null;
    const r = sala ? getRoom(sala) : undefined;
    const id = window.setTimeout(() => {
      if (r) {
        openRoom(r, q.get("reservar") ? "reserve" : "info");
        if (!q.get("reservar")) setRoute(planRoute(layout, r.building, r));
      } else if (predio && BUILDINGS.some((b) => b.id === predio)) {
        openBuilding(predio);
        setRoute(planRoute(layout, predio));
      }
    }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----- totem: volta para a tela de descanso após inatividade */
  const reset = useCallback(() => {
    setIdle(true);
    setTab("mapa");
    setPanel(null);
    setRoute(null);
    setSettingsOpen(false);
    setEditing(false);
  }, []);

  useEffect(() => {
    if (!totem || idle) return;
    let t = window.setTimeout(reset, IDLE_MS);
    const bump = () => {
      window.clearTimeout(t);
      t = window.setTimeout(reset, IDLE_MS);
    };
    window.addEventListener("pointerdown", bump);
    window.addEventListener("keydown", bump);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
    };
  }, [totem, idle, reset]);

  const stats = useMemo(() => {
    const out = {} as Record<BuildingId, BuildingStats>;
    for (const b of BUILDINGS) {
      const rooms = scheduledRoomsOf(b.id);
      out[b.id] = {
        total: rooms.length,
        free: now ? rooms.filter((r) => roomStatusNow(r.id, now, reservations).tone === "free").length : 0,
      };
    }
    return out;
  }, [now, reservations]);

  const shift = now ? shiftAt(now) : null;
  const hereLabel = totem ? "Você está aqui" : "Portão";
  const onMap = tab === "mapa";
  const fullBleed = onMap || tab === "passeio" || tab === "ra";

  const exportLayout = () => {
    const blob = new Blob([JSON.stringify(layout, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "undb-maps-layout.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div
      ref={root}
      data-variant={variant}
      className={cn(
        "relative mx-auto flex h-dvh flex-col overflow-hidden bg-background text-foreground",
        totem ? "aspect-[9/16] w-[min(100vw,56.25dvh)]" : "w-full",
      )}
    >
      {totem && settings.reach && (
        <div className="flex h-[38%] shrink-0 flex-col items-center justify-end gap-2 bg-undb-ink p-6 text-center text-undb-cream">
          <p className="font-display text-lg font-bold">Modo alcance ativo</p>
          <p className="text-sm opacity-75">A interface foi trazida para baixo. Desative em Visualização.</p>
        </div>
      )}

      <main className="relative min-h-0 flex-1">
        {/* ─── conteúdo ─────────────────────────────────────────────── */}
        <section className={cn("absolute inset-0", !fullBleed && "overflow-y-auto pt-20 pb-28")}>
          {onMap && (
            <>
              {editing ? (
                <div className="absolute inset-0 pt-20">
                  <CampusMap layout={layout} selected={selectedBuilding} onLayout={setLayout} />
                </div>
              ) : view === "predios" ? (
                <BuildingsOverview
                  stats={stats}
                  onOpen={openBuilding}
                  onTour={(photo) => {
                    setTourStart(Math.max(0, stopIndexOf(photo)));
                    setTab("passeio");
                  }}
                />
              ) : (
                <CampusScene
                  view={view}
                  layout={layout}
                  selected={selectedBuilding}
                  route={route}
                  stats={stats}
                  hereLabel={hereLabel}
                  dark={dark}
                  onSelect={openBuilding}
                  onBackground={() => panel?.kind === "building" && setPanel(null)}
                />
              )}
            </>
          )}
          {tab === "salas" && <RoomList now={now} reservations={reservations} autoFocus={focusSearch} onRoom={(r) => openRoom(r)} />}
          {tab === "reservas" && <Reservations now={now} reservations={reservations} onCancel={cancel} onFind={() => setTab("salas")} />}
          {tab === "passeio" && (
            <div className="absolute inset-0">
              <StreetView key={tourStart} totem={totem} start={tourStart} />
            </div>
          )}
          {tab === "ra" && (
            <div className="absolute inset-0">
              <ARView layout={layout} initial={selectedBuilding} />
            </div>
          )}
        </section>

        {/* ─── barra superior ───────────────────────────────────────── */}
        {tab !== "passeio" && tab !== "ra" && (
          <header data-anim="top" className="pointer-events-none absolute inset-x-0 top-0 z-[var(--z-nav)] p-3">
            <div className={cn("pointer-events-auto mx-auto flex max-w-3xl items-center gap-2 rounded-2xl p-1.5 pr-2", glass)}>
              <Image src="/undb-mark.png" alt="UNDB" width={40} height={40} className="size-10 shrink-0 rounded-xl" priority />
              <div className="hidden leading-none min-[24rem]:block">
                <p className="font-display text-[0.95rem] font-extrabold tracking-tight">
                  UNDB <span className="text-primary">Maps</span>
                </p>
                <p className="mt-0.5 text-[0.68rem] text-muted-foreground">
                  {now ? (shift ? `Turno da ${SHIFT_LABEL[shift].toLowerCase()}` : "Fora do turno") : "Campus Renascença"}
                  {settings.demoClock && " · demo"}
                </p>
              </div>

              <button
                onClick={() => {
                  setTab("salas");
                  setFocusSearch(true);
                }}
                className="ml-auto flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl bg-muted/70 px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted min-[24rem]:ml-2 sm:max-w-xs"
              >
                <Search className="size-4 shrink-0" />
                <span className="truncate">Sala, curso ou turma…</span>
              </button>

              {now && (
                <span className="hidden rounded-lg px-2 font-display text-base font-extrabold tabular sm:block">
                  {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <button
                onClick={() => setSettingsOpen(true)}
                aria-label="Visualização e acessibilidade"
                className="grid size-10 shrink-0 place-items-center rounded-xl transition-colors hover:bg-muted"
              >
                <SlidersHorizontal className="size-[1.1rem]" />
              </button>
            </div>

            {onMap && route && !panel && (
              <div className="pointer-events-auto mx-auto mt-2 flex w-fit items-center gap-3 rounded-full bg-primary py-1.5 pr-1.5 pl-4 text-primary-foreground shadow-lg">
                <Footprints className="size-4" />
                <span className="text-sm font-semibold">
                  {getBuilding(route.building).name} · ~{route.meters} m · {route.minutes} min
                </span>
                <button onClick={() => setRoute(null)} aria-label="Limpar rota" className="grid size-8 place-items-center rounded-full bg-black/15">
                  <X className="size-4" />
                </button>
              </div>
            )}
          </header>
        )}

        {/* ─── modos de visualização ────────────────────────────────── */}
        {onMap && !editing && (
          <div data-anim="views" className={cn("pointer-events-none absolute inset-x-0 z-[var(--z-map-ui)] flex justify-center px-3", panel ? "hidden desk:flex" : "", "bottom-[5.75rem]")}>
            <ToggleGroup
              value={[view]}
              onValueChange={(v) => v[0] && setSettings({ view: v[0] as View })}
              aria-label="Modo de visualização"
              className={cn("pointer-events-auto gap-0.5 rounded-2xl p-1", glass)}
            >
              {VIEWS.map(([v, label, Icon]) => (
                <ToggleGroupItem
                  key={v}
                  value={v}
                  aria-label={label}
                  className="h-11 gap-1.5 rounded-xl px-3 text-[0.8rem] font-semibold text-muted-foreground data-[pressed]:bg-foreground data-[pressed]:text-background"
                >
                  <Icon className="size-4" />
                  <span className="max-[22rem]:hidden">{label}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}

        {/* ─── barra do editor ──────────────────────────────────────── */}
        {onMap && editing && (
          <div className="absolute inset-x-3 bottom-24 z-[var(--z-overlay)] mx-auto flex max-w-md flex-col gap-2 rounded-2xl bg-undb-ink p-3 text-undb-cream shadow-2xl">
            <p className="text-sm">
              <strong className="text-signal">Editor do mapa.</strong> Arraste o portão amarelo até onde o totem vai ficar. Os prédios seguem o mapa da equipe.
            </p>
            <div className="grid grid-cols-4 gap-2 text-sm font-semibold">
              <button onClick={() => setLayout(DEFAULT_LAYOUT)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-white/10">
                <RotateCcw className="size-4" /> Padrão
              </button>
              <button
                onClick={() => setLayout({ ...layout, confirmed: !layout.confirmed })}
                className={cn("flex min-h-11 items-center justify-center gap-1.5 rounded-lg", layout.confirmed ? "bg-free text-undb-ink" : "bg-white/10")}
              >
                <CheckCircle2 className="size-4" /> {layout.confirmed ? "Ok" : "Confirmar"}
              </button>
              <button onClick={exportLayout} className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-white/10">
                <Download className="size-4" /> JSON
              </button>
              <button onClick={() => setEditing(false)} className="min-h-11 rounded-lg bg-signal text-undb-ink">
                Concluir
              </button>
            </div>
          </div>
        )}

        {/* ─── painel de detalhe ────────────────────────────────────── */}
        {panel && tab !== "ra" && tab !== "passeio" && (
          <aside
            aria-label="Detalhes"
            className={cn(
              "sheet-in absolute inset-x-2 bottom-[5.25rem] z-[var(--z-sheet)] max-h-[64%] overflow-x-hidden overflow-y-auto rounded-3xl p-5",
              glass,
              "bg-card/95",
              "desk:inset-x-auto desk:top-20 desk:right-3 desk:bottom-24 desk:max-h-none desk:w-[25rem]",
            )}
          >
            <DetailPanel
              target={panel}
              mode={panelMode}
              layout={layout}
              now={now}
              reservations={reservations}
              route={route}
              totem={totem}
              onClose={() => setPanel(null)}
              onRoute={goRoute}
              onRoom={(r) => openRoom(r)}
              onMode={setPanelMode}
              onAddReservation={add}
              onGoReservations={() => {
                setPanel(null);
                setTab("reservas");
              }}
            />
          </aside>
        )}

        {/* ─── dock de navegação ────────────────────────────────────── */}
        <nav
          data-anim="dock"
          aria-label="Seções"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[var(--z-nav)] flex justify-center p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        >
          <div className={cn("pointer-events-auto grid w-full max-w-md grid-cols-5 gap-1 rounded-[1.4rem] p-1.5", glass)}>
            {TABS.map(([t, label, Icon]) => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => {
                    setTab(t);
                    setFocusSearch(false);
                  }}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[0.7rem] font-semibold transition-colors duration-200",
                    active ? "bg-primary text-primary-foreground shadow-[0_6px_18px_-6px_var(--primary)]" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-5" />
                  {label}
                  {t === "ra" && (
                    <span className="absolute top-1 right-1 rounded-md bg-signal px-1 font-display text-[0.5rem] leading-[1.4] font-extrabold tracking-wide text-undb-ink">
                      WIP
                    </span>
                  )}
                  {t === "reservas" && reservations.length > 0 && (
                    <span className="absolute top-1 right-2 grid size-4 place-items-center rounded-full bg-signal text-[0.6rem] font-bold text-undb-ink tabular">
                      {reservations.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </main>

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          totem={totem}
          onChange={setSettings}
          onClose={() => setSettingsOpen(false)}
          onEditor={() => {
            setSettingsOpen(false);
            setTab("mapa");
            setPanel(null);
            setEditing(true);
          }}
        />
      )}

      {totem && idle && <IdleScreen onStart={() => setIdle(false)} />}
    </div>
  );
}

/** Modo "Prédios": cartões com a ocupação de agora, ótimo para o totem. */
function BuildingsOverview({
  stats,
  onOpen,
  onTour,
}: {
  stats: Record<BuildingId, BuildingStats>;
  onOpen: (id: BuildingId) => void;
  onTour: (photo: number) => void;
}) {
  return (
    <div className="h-full overflow-y-auto px-3 pt-24 pb-44">
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        <h2 className="px-1 font-display text-2xl font-extrabold tracking-tight">Prédios do campus</h2>
        {BUILDINGS.map((b) => {
          const s = stats[b.id];
          const pct = s.total ? (s.free / s.total) * 100 : 0;
          return (
            <button
              key={b.id}
              onClick={() => onOpen(b.id)}
              className="group relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-border bg-card p-5 text-left transition-transform duration-200 active:scale-[.99]"
            >
              <span aria-hidden className="absolute -top-16 -right-16 size-48 rounded-full opacity-25 blur-3xl transition-opacity group-hover:opacity-40" style={{ background: b.color }} />
              <span className="flex items-center gap-4">
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl font-display text-2xl font-extrabold text-white" style={{ background: b.color }}>
                  {b.tile}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-xl font-extrabold tracking-tight">{b.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {b.note ?? b.series.map((x) => (/^\d00$/.test(x) ? `salas ${x.replace("00", "xx")}` : x)).join(" · ")}
                  </span>
                </span>
                {s.total > 0 ? (
                  <span className="text-right">
                    <span className="block font-display text-3xl leading-none font-extrabold text-free tabular">{s.free}</span>
                    <span className="block text-xs text-muted-foreground">de {s.total} livres</span>
                  </span>
                ) : (
                  <span className="max-w-24 text-right text-xs text-muted-foreground">horário não publicado</span>
                )}
              </span>
              <span className={cn("relative h-1.5 overflow-hidden rounded-full bg-muted", s.total === 0 && "hidden")} aria-hidden>
                <span className="absolute inset-y-0 left-0 rounded-full bg-free transition-[width] duration-700" style={{ width: `${pct}%` }} />
              </span>
            </button>
          );
        })}
        <button onClick={() => onTour(66)} className="flex items-center gap-3 rounded-3xl border border-dashed border-border bg-card/60 p-4 text-left text-sm">
          <Footprints className="size-5 shrink-0 text-primary" />
          <span className="flex-1 text-muted-foreground">Veja o Prédio Oeste e os laboratórios de Engenharia no passeio por fotos.</span>
        </button>
      </div>
    </div>
  );
}
