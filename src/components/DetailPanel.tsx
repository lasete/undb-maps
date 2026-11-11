"use client";

import { CalendarPlus, Footprints, Navigation, Smartphone, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { getBuilding, getRoom, roomsOf, seriesLabel, type BuildingId, type Layout, type Room } from "@/lib/campus";
import { SEMESTER, SHIFT_LABEL, allocationsOf, describeAllocation, type Shift } from "@/lib/alocacao";
import { roomStatusNow, type Reservation } from "@/lib/status";
import type { RoutePlan } from "@/lib/route";
import { cn } from "@/lib/utils";
import ReserveFlow from "./ReserveFlow";
import { Button, SectionTitle, SourceNote, StatusDot, StatusPill, type Tone } from "./ui";

export type PanelTarget = { kind: "building"; id: BuildingId } | { kind: "room"; id: string };

interface Props {
  target: PanelTarget;
  mode: "info" | "reserve";
  layout: Layout;
  now: Date | null;
  reservations: Reservation[];
  route: RoutePlan | null;
  totem: boolean;
  onClose: () => void;
  onRoute: (b: BuildingId, room?: Room) => void;
  onRoom: (r: Room) => void;
  onMode: (m: "info" | "reserve") => void;
  onAddReservation: (r: Reservation) => void;
  onGoReservations: () => void;
}

export default function DetailPanel(p: Props) {
  return (
    <div className="sheet-in flex flex-col gap-5">
      {p.target.kind === "building" ? <BuildingDetail {...p} id={p.target.id} /> : <RoomDetail {...p} room={getRoom(p.target.id)!} />}
    </div>
  );
}

function CloseBtn({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      aria-label="Fechar painel"
      className="grid size-10 shrink-0 place-items-center rounded-full bg-black/20 text-white backdrop-blur transition-colors hover:bg-black/35"
    >
      <X className="size-[1.1rem]" />
    </button>
  );
}

/** Cabeçalho com a cor do prédio (o mesmo bloco de cor da logo). */
function Hero({ building, eyebrow, title, children, onClose }: { building: BuildingId; eyebrow: string; title: string; children?: React.ReactNode; onClose: () => void }) {
  const b = getBuilding(building);
  return (
    <header
      className="relative -mx-5 -mt-5 overflow-hidden rounded-t-3xl px-5 pt-5 pb-5 text-white"
      style={{ background: `linear-gradient(135deg, ${b.color} 0%, color-mix(in oklab, ${b.color} 55%, #120a10) 100%)` }}
    >
      <span aria-hidden className="absolute -top-6 -right-4 font-display text-[7.5rem] leading-none font-extrabold text-white/10 select-none">
        {b.tile}
      </span>
      <div className="relative flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-[0.14em] text-white/75 uppercase">{eyebrow}</p>
          <h2 className="mt-1 font-display text-[1.65rem] leading-[1.05] font-extrabold tracking-tight">{title}</h2>
          {children}
        </div>
        <CloseBtn onClose={onClose} />
      </div>
    </header>
  );
}

function RouteBox({ route, totem, deepLink }: { route: RoutePlan; totem: boolean; deepLink: string }) {
  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-primary/30 bg-accent/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display font-extrabold">
          <Footprints className="size-4 text-primary" /> Como chegar
        </h3>
        <span className="rounded-full bg-card px-2.5 py-1 text-xs font-bold tabular">
          ~{route.meters} m · {route.minutes} min
        </span>
      </div>
      <ol className="relative flex flex-col gap-3 text-sm">
        <span aria-hidden className="absolute top-3 bottom-3 left-[11px] w-px bg-primary/30" />
        {route.steps.map((s, i) => (
          <li key={i} className="relative flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary font-display text-[0.7rem] font-bold text-primary-foreground ring-4 ring-accent">
              {i + 1}
            </span>
            <span className="pt-0.5 leading-snug">{s}</span>
          </li>
        ))}
      </ol>
      <SourceNote>Distância em linha reta medida no satélite. Os caminhos internos do campus ainda serão mapeados.</SourceNote>
      {totem && (
        <div className="flex items-center gap-3 rounded-2xl bg-card p-3">
          <div className="shrink-0 rounded-xl bg-white p-1.5">
            <QRCodeSVG value={deepLink} size={76} />
          </div>
          <p className="text-sm">
            <strong className="flex items-center gap-1.5">
              <Smartphone className="size-4" /> Leve a rota no celular
            </strong>
            <span className="text-muted-foreground">Aponte a câmera para o código.</span>
          </p>
        </div>
      )}
    </section>
  );
}

const TILE_TONE: Record<Tone, string> = {
  free: "border-free/35 bg-free-soft text-free",
  busy: "border-busy/25 bg-busy-soft text-busy",
  mine: "border-mine/35 bg-mine-soft text-mine",
  neutral: "border-border bg-muted text-foreground",
};

function BuildingDetail({ id, layout, now, reservations, route, totem, onClose, onRoute, onRoom }: Props & { id: BuildingId }) {
  const b = getBuilding(id);
  const rooms = roomsOf(id);
  const tones = rooms.map((r) => (now ? roomStatusNow(r.id, now, reservations).tone : "neutral"));
  const count = (t: Tone) => tones.filter((x) => x === t).length;
  const scheduled = rooms.filter((r) => !r.noSchedule).length;
  const showRoute = route && route.building === id && !route.roomId;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <>
      <Hero building={id} eyebrow={scheduled ? `${scheduled} salas · Mapa de Salas ${SEMESTER}` : "Espaços das placas no local"} title={b.name} onClose={onClose}>
        {b.note && <p className="mt-1.5 text-sm text-white/85">{b.note}</p>}
        {!layout.confirmed && <p className="mt-1.5 text-xs font-semibold text-white">Posição no mapa a confirmar</p>}
      </Hero>

      {now && (
        <div className="grid grid-cols-3 gap-2" aria-label="Ocupação agora">
          {(
            [
              ["free", "livres"],
              ["busy", "com aula"],
              ["neutral", "sem horário"],
            ] as [Tone, string][]
          ).map(([t, label]) => (
            <div key={t} className={cn("rounded-2xl border px-3 py-2.5", TILE_TONE[t])}>
              <p className="font-display text-2xl leading-none font-extrabold tabular">{count(t) + (t === "free" ? count("mine") : 0)}</p>
              <p className="mt-1 text-[0.7rem] font-semibold opacity-85">{label}</p>
            </div>
          ))}
        </div>
      )}

      <Button variant="primary" size="lg" onClick={() => onRoute(id)}>
        <Navigation className="size-4" /> Como chegar
      </Button>
      {showRoute && <RouteBox route={route} totem={totem} deepLink={`${origin}/?predio=${id}`} />}

      {b.series.map((s) => {
        const list = roomsOf(id, s);
        const numeric = list.every((r) => /^\d+$/.test(r.code));
        return (
          <section key={s} className="flex flex-col gap-2.5">
            <SectionTitle aside={<span className="text-[0.7rem] text-muted-foreground">{list.length}</span>}>{seriesLabel(s)}</SectionTitle>
            <div className={cn("grid gap-2", numeric ? "grid-cols-4" : "grid-cols-1")}>
              {list.map((r) => {
                const st = now ? roomStatusNow(r.id, now, reservations) : null;
                const tone = st?.tone ?? "neutral";
                return numeric ? (
                  <button
                    key={r.id}
                    onClick={() => onRoom(r)}
                    aria-label={`${r.label}${st ? `, ${st.label}` : ""}`}
                    className={cn(
                      "flex min-h-14 flex-col items-center justify-center rounded-2xl border font-display text-[0.95rem] font-extrabold tabular transition-transform duration-150 active:scale-95",
                      TILE_TONE[tone],
                    )}
                  >
                    {r.code}
                    {r.aka && <span className="font-sans text-[0.6rem] font-semibold opacity-80">{r.aka}</span>}
                  </button>
                ) : (
                  <button
                    key={r.id}
                    onClick={() => onRoom(r)}
                    className="flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-card px-3.5 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <StatusDot tone={tone} />
                    <span className="min-w-0 flex-1 truncate font-medium">{r.label}</span>
                    <span className="text-[0.7rem] text-muted-foreground">{st?.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      <SourceNote>
        Ocupação do turno atual pelo Mapa de Salas {SEMESTER}. Espaços sem horário vieram das placas fotografadas no local.
      </SourceNote>
    </>
  );
}

function RoomDetail(p: Props & { room: Room }) {
  const { room, now, reservations, route, totem, onClose, onRoute, mode, onMode } = p;
  const b = getBuilding(room.building);
  const st = now ? roomStatusNow(room.id, now, reservations) : null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  if (mode === "reserve" && now) {
    return (
      <ReserveFlow
        room={room}
        now={now}
        reservations={reservations}
        totem={totem}
        onAdd={p.onAddReservation}
        onBack={() => onMode("info")}
        onDone={p.onGoReservations}
      />
    );
  }

  return (
    <>
      <Hero building={room.building} eyebrow={b.name} title={room.label} onClose={onClose}>
        {st && <StatusPill tone={st.tone} label={st.label} className="mt-3 bg-white/95" />}
      </Hero>

      <div className={cn("grid gap-2", room.noSchedule ? "grid-cols-1" : "grid-cols-2")}>
        <Button variant="primary" size="lg" onClick={() => onRoute(room.building, room)}>
          <Navigation className="size-4" /> Como chegar
        </Button>
        {!room.noSchedule && (
          <Button size="lg" onClick={() => onMode("reserve")} disabled={!now}>
            <CalendarPlus className="size-4" /> Reservar
          </Button>
        )}
      </div>

      {route && route.roomId === room.id && <RouteBox route={route} totem={totem} deepLink={`${origin}/?sala=${room.id}`} />}

      {room.noSchedule ? (
        <SourceNote>Este espaço foi identificado pelas placas no local. A UNDB ainda não publicou horários para ele, por isso não dá para reservar pelo app.</SourceNote>
      ) : (
        <section className="flex flex-col gap-2.5">
          <SectionTitle>Turmas · {SEMESTER}</SectionTitle>
          <ol className="flex flex-col gap-2">
            {(["manha", "tarde", "noite"] as Shift[]).map((s) => {
              const al = allocationsOf(room.id, s);
              const current = st?.shift === s;
              return (
                <li
                  key={s}
                  className={cn(
                    "flex gap-3 rounded-2xl border p-3.5 transition-colors",
                    current ? "border-primary/40 bg-accent/60" : "border-border bg-card",
                  )}
                >
                  <div className="w-16 shrink-0">
                    <p className="text-sm font-bold">{SHIFT_LABEL[s]}</p>
                    {current && <p className="mt-0.5 text-[0.62rem] font-bold tracking-[0.12em] text-primary uppercase">agora</p>}
                  </div>
                  {al.length ? (
                    <ul className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                      {al.map((a, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <StatusDot tone="busy" />
                          <span className="-mt-1 leading-snug">{describeAllocation(a)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="flex items-center gap-2 text-sm font-semibold text-free">
                      <StatusDot tone="free" /> Sem turma, dá para reservar
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
          <SourceNote>Fonte: Mapa de Salas {SEMESTER} (undb.edu.br/mapa-de-salas). Capacidade, recursos e andar ainda não foram publicados.</SourceNote>
        </section>
      )}
    </>
  );
}
