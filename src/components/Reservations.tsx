"use client";

import { useState } from "react";
import { CalendarPlus, CalendarX2, QrCode, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { getBuilding, getRoom } from "@/lib/campus";
import { SHIFT_LABEL } from "@/lib/alocacao";
import { fromDateKey, toDateKey, type Reservation } from "@/lib/status";
import { cn } from "@/lib/utils";
import { Button, EmptyState, PageHeader, SectionTitle } from "./ui";

interface Props {
  now: Date | null;
  reservations: Reservation[];
  onCancel: (id: string) => void;
  onFind: () => void;
}

export default function Reservations({ now, reservations, onCancel, onFind }: Props) {
  const today = now ? toDateKey(now) : "";
  const sorted = [...reservations].sort((a, b) => (a.date + a.shift).localeCompare(b.date + b.shift));
  const upcoming = sorted.filter((r) => r.date >= today);
  const past = sorted.filter((r) => r.date < today).reverse();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4">
      <div className="flex items-end justify-between gap-3">
        <PageHeader eyebrow="Reservas" title="Minhas reservas">
          {upcoming.length ? `${upcoming.length} reserva${upcoming.length > 1 ? "s" : ""} pela frente` : "Reserve salas livres por turno, direto pelo app."}
        </PageHeader>
        {upcoming.length > 0 && (
          <Button variant="secondary" onClick={onFind} className="shrink-0">
            <CalendarPlus className="size-4" /> Nova
          </Button>
        )}
      </div>

      {upcoming.length === 0 && (
        <EmptyState
          icon={<CalendarX2 className="size-6" />}
          title="Nenhuma reserva por enquanto"
          action={
            <Button variant="primary" onClick={onFind} className="mt-1">
              Encontrar uma sala livre
            </Button>
          }
        >
          Escolha uma sala livre no mapa ou na lista e toque em “Reservar”.
        </EmptyState>
      )}

      {upcoming.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle>Próximas</SectionTitle>
          {upcoming.map((r) => (
            <TicketCard key={r.id} r={r} onCancel={onCancel} today={today} />
          ))}
        </section>
      )}

      {past.length > 0 && (
        <section className="flex flex-col gap-3 opacity-60">
          <SectionTitle>Anteriores</SectionTitle>
          {past.map((r) => (
            <TicketCard key={r.id} r={r} today={today} />
          ))}
        </section>
      )}
    </div>
  );
}

function TicketCard({ r, onCancel, today }: { r: Reservation; onCancel?: (id: string) => void; today: string }) {
  const [showQr, setShowQr] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const room = getRoom(r.roomId);
  if (!room) return null;
  const b = getBuilding(room.building);
  const d = fromDateKey(r.date);
  const isToday = r.date === today;

  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card">
      <div className="flex items-stretch">
        {/* data */}
        <div className="flex w-20 shrink-0 flex-col items-center justify-center gap-0.5 py-4 text-white" style={{ background: b.color }}>
          <span className="text-[0.65rem] font-bold tracking-[0.12em] uppercase opacity-85">{isToday ? "Hoje" : d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</span>
          <span className="font-display text-3xl leading-none font-extrabold tabular">{d.getDate()}</span>
          <span className="text-[0.65rem] font-semibold uppercase opacity-85">{d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-4">
          <p className="text-xs font-semibold text-muted-foreground">{b.name}</p>
          <h3 className="truncate font-display text-lg leading-tight font-extrabold tracking-tight">{room.label}</h3>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">{SHIFT_LABEL[r.shift]}</span>
            {r.purpose} · {r.people} pessoa{r.people > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {showQr && (
        <div className="flex items-center gap-4 border-t border-dashed border-border p-4">
          <div className="rounded-xl bg-white p-2">
            <QRCodeSVG value={`UNDBMAPS:${r.code}:${r.roomId}:${r.date}:${r.shift}`} size={112} fgColor="#1B0D17" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Código da reserva</p>
            <p className="font-display text-xl font-extrabold tracking-wider tabular">{r.code}</p>
            <p className="mt-1 text-xs text-muted-foreground">Apresente na portaria.</p>
          </div>
        </div>
      )}

      {onCancel && (
        <div className="grid grid-cols-2 gap-px border-t border-border bg-border">
          <button onClick={() => setShowQr(!showQr)} className="flex min-h-12 items-center justify-center gap-2 bg-card text-sm font-semibold transition-colors hover:bg-muted">
            <QrCode className="size-4" /> {showQr ? "Ocultar código" : "Mostrar código"}
          </button>
          <button
            onClick={() => (confirming ? onCancel(r.id) : setConfirming(true))}
            onBlur={() => setConfirming(false)}
            className={cn(
              "flex min-h-12 items-center justify-center gap-2 bg-card text-sm font-semibold transition-colors",
              confirming ? "bg-destructive/10 text-destructive" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Trash2 className="size-4" /> {confirming ? "Toque para confirmar" : "Cancelar"}
          </button>
        </div>
      )}
    </article>
  );
}
