"use client";

import { useId, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { Room } from "@/lib/campus";
import { getBuilding } from "@/lib/campus";
import { SEMESTER, SHIFT_LABEL, type Shift } from "@/lib/alocacao";
import { fromDateKey, isWeekday, makeReservationCode, shiftState, toDateKey, type Reservation } from "@/lib/status";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Button, SectionTitle } from "./ui";

const PURPOSES = ["Estudo em grupo", "Monitoria", "Reunião de projeto", "Aula extra", "Evento acadêmico"];
const SHIFTS: Shift[] = ["manha", "tarde", "noite"];
const SHIFT_HINT: Record<Shift, string> = { manha: "até 12h30", tarde: "12h30–18h30", noite: "18h30–22h30" };

interface Props {
  room: Room;
  now: Date;
  reservations: Reservation[];
  totem: boolean;
  onAdd: (r: Reservation) => void;
  onBack: () => void;
  onDone: () => void;
}

export default function ReserveFlow({ room, now, reservations, totem, onAdd, onBack, onDone }: Props) {
  const days = nextWeekdays(now, 10);
  const [step, setStep] = useState<1 | 2>(1);
  const [date, setDate] = useState(days[0]);
  const [shift, setShift] = useState<Shift | null>(null);
  const [form, setForm] = useState({ name: "", matricula: "", purpose: PURPOSES[0], people: "4" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<Reservation | null>(null);
  const uid = useId();
  const b = getBuilding(room.building);

  if (done) return <Ticket r={done} room={room} onDone={onDone} />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (form.name.trim().length < 3) err.name = "Informe seu nome completo.";
    if (!/^\d{6,12}$/.test(form.matricula.trim())) err.matricula = "A matrícula tem de 6 a 12 números.";
    const n = Number(form.people);
    if (!Number.isInteger(n) || n < 1 || n > 80) err.people = "Entre 1 e 80 pessoas.";
    setErrors(err);
    if (Object.keys(err).length || !shift) return;
    setSending(true);
    await new Promise((r) => setTimeout(r, 650)); // simula a chamada à API
    const createdAt = Date.now();
    const res: Reservation = {
      id: `${room.id}-${date}-${shift}-${createdAt}`,
      code: makeReservationCode(`${room.id}${date}${shift}${createdAt}`),
      roomId: room.id,
      date,
      shift,
      name: form.name.trim(),
      matricula: form.matricula.trim(),
      purpose: form.purpose,
      people: n,
      createdAt,
    };
    onAdd(res);
    setSending(false);
    setDone(res);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={step === 1 ? onBack : () => setStep(1)}
          aria-label="Voltar"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-muted transition-colors hover:bg-accent"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-muted-foreground">Reservar · {b.name}</p>
          <h3 className="truncate font-display text-xl font-extrabold tracking-tight">{room.label}</h3>
        </div>
      </div>

      {/* etapas */}
      <ol className="grid grid-cols-2 gap-2" aria-label="Etapas">
        {["Dia e turno", "Seus dados"].map((l, i) => (
          <li key={l} className="flex flex-col gap-1.5">
            <span className={cn("h-1 rounded-full transition-colors duration-300", step > i ? "bg-primary" : "bg-muted")} />
            <span className={cn("text-[0.7rem] font-semibold", step === i + 1 ? "text-foreground" : "text-muted-foreground")}>
              {i + 1}. {l}
            </span>
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <>
          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 w-full">
              <SectionTitle>Dia</SectionTitle>
            </legend>
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
              {days.map((d) => {
                const dt = fromDateKey(d);
                const active = d === date;
                return (
                  <button
                    type="button"
                    key={d}
                    aria-pressed={active}
                    onClick={() => {
                      setDate(d);
                      setShift(null);
                    }}
                    className={cn(
                      "flex min-h-[4.25rem] min-w-[3.6rem] shrink-0 flex-col items-center justify-center rounded-2xl border transition-colors duration-150",
                      active ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-muted",
                    )}
                  >
                    <span className="text-[0.65rem] font-semibold uppercase opacity-75">{dt.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</span>
                    <span className="font-display text-xl leading-tight font-extrabold tabular">{dt.getDate()}</span>
                    <span className="text-[0.6rem] uppercase opacity-60">{dt.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 w-full">
              <SectionTitle>Turno</SectionTitle>
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {SHIFTS.map((s) => {
                const st = shiftState(room.id, date, s, reservations);
                const past = date === toDateKey(now) && isPastShift(s, now);
                const disabled = st.kind !== "livre" || past;
                const active = shift === s;
                const why = past ? "Já passou" : st.kind === "aula" ? "Com aula" : st.kind === "minha" ? "Sua reserva" : SHIFT_HINT[s];
                return (
                  <button
                    type="button"
                    key={s}
                    disabled={disabled}
                    aria-pressed={active}
                    onClick={() => setShift(s)}
                    className={cn(
                      "flex min-h-[4.5rem] flex-col items-start justify-between rounded-2xl border p-3 text-left transition-colors duration-150 disabled:cursor-not-allowed",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-[0_10px_24px_-12px_var(--primary)]"
                        : disabled
                          ? "border-dashed border-border bg-transparent text-muted-foreground"
                          : "border-border bg-card hover:border-foreground/40",
                    )}
                  >
                    <span className="text-sm font-bold">{SHIFT_LABEL[s]}</span>
                    <span className={cn("text-[0.68rem] leading-tight", disabled && !active ? "line-through decoration-1" : "opacity-85")}>{why}</span>
                  </button>
                );
              })}
            </div>
            {SHIFTS.every((s) => shiftState(room.id, date, s, reservations).kind !== "livre" || (date === toDateKey(now) && isPastShift(s, now))) ? (
              <p role="status" className="rounded-2xl bg-busy-soft px-3.5 py-2.5 text-sm text-busy">
                Nenhum turno livre neste dia. Escolha outro dia ou use o filtro <strong>“Livres agora”</strong> na aba Salas.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Turnos com aula no Mapa de Salas {SEMESTER} ficam bloqueados.</p>
            )}
          </fieldset>

          {totem && (
            <div className="flex items-center gap-3 rounded-2xl bg-muted p-3">
              <div className="shrink-0 rounded-xl bg-white p-1.5">
                <QRCodeSVG value={typeof window !== "undefined" ? `${window.location.origin}/?sala=${room.id}&reservar=1` : room.id} size={72} />
              </div>
              <p className="text-sm">
                <strong className="flex items-center gap-1.5">
                  <Smartphone className="size-4" /> Prefere usar o celular?
                </strong>
                <span className="text-muted-foreground">Aponte a câmera e termine no seu aparelho.</span>
              </p>
            </div>
          )}

          <Button type="button" variant="primary" size="lg" disabled={!shift} onClick={() => setStep(2)}>
            Continuar <ArrowRight className="size-4" />
          </Button>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3 text-sm">
            <span className="font-display text-2xl leading-none font-extrabold tabular">{fromDateKey(date).getDate()}</span>
            <span className="leading-tight">
              <span className="block font-semibold first-letter:uppercase">{fmtDay(date)}</span>
              <span className="text-muted-foreground">Turno da {shift && SHIFT_LABEL[shift].toLowerCase()}</span>
            </span>
          </div>

          <div className="grid gap-4">
            <Field id={`${uid}-n`} label="Nome completo" error={errors.name}>
              <Input id={`${uid}-n`} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={!!errors.name} className={inputCls} />
            </Field>
            <Field id={`${uid}-m`} label="Matrícula" error={errors.matricula}>
              <Input
                id={`${uid}-m`}
                inputMode="numeric"
                value={form.matricula}
                onChange={(e) => setForm({ ...form, matricula: e.target.value.replace(/\D/g, "") })}
                aria-invalid={!!errors.matricula}
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-[1fr_6.5rem] gap-3">
              <Field id={`${uid}-p`} label="Finalidade">
                <select
                  id={`${uid}-p`}
                  value={form.purpose}
                  onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                  className={cn(inputCls, "w-full rounded-xl border border-input bg-transparent px-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50")}
                >
                  {PURPOSES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <Field id={`${uid}-q`} label="Pessoas" error={errors.people}>
                <Input id={`${uid}-q`} type="number" min={1} max={80} value={form.people} onChange={(e) => setForm({ ...form, people: e.target.value })} aria-invalid={!!errors.people} className={inputCls} />
              </Field>
            </div>
          </div>

          <Button type="submit" variant="primary" size="lg" disabled={sending}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {sending ? "Reservando…" : "Confirmar reserva"}
          </Button>
        </>
      )}
    </form>
  );
}

/** Confirmação em formato de ingresso. */
function Ticket({ r, room, onDone }: { r: Reservation; room: Room; onDone: () => void }) {
  const b = getBuilding(room.building);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-free-soft text-free">
          <Check className="size-6" />
        </span>
        <div>
          <h3 className="font-display text-xl font-extrabold tracking-tight">Reserva confirmada</h3>
          <p className="text-sm text-muted-foreground">Apresente o código na portaria.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-background">
        <div className="p-4 text-white" style={{ background: `linear-gradient(135deg, ${b.color}, color-mix(in oklab, ${b.color} 55%, #120a10))` }}>
          <p className="text-xs font-semibold tracking-[0.14em] text-white/75 uppercase">{b.name}</p>
          <p className="font-display text-2xl font-extrabold tracking-tight">{room.label}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Dia</p>
            <p className="font-semibold first-letter:uppercase">{fmtDay(r.date)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Turno</p>
            <p className="font-semibold">{SHIFT_LABEL[r.shift]}</p>
          </div>
        </div>
        {/* picote */}
        <div className="relative flex items-center" aria-hidden>
          <span className="-ml-3 size-6 rounded-full border border-border bg-card" />
          <span className="flex-1 border-t-2 border-dashed border-border" />
          <span className="-mr-3 size-6 rounded-full border border-border bg-card" />
        </div>
        <div className="flex items-center gap-4 p-4">
          <div className="rounded-xl bg-white p-2">
            <QRCodeSVG value={`UNDBMAPS:${r.code}:${r.roomId}:${r.date}:${r.shift}`} size={96} fgColor="#1B0D17" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Código</p>
            <p className="font-display text-xl font-extrabold tracking-wider tabular">{r.code}</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">No sistema real, a coordenação valida este código. No protótipo, a reserva fica salva neste aparelho.</p>
      <Button variant="primary" size="lg" onClick={onDone}>
        Ver minhas reservas
      </Button>
    </div>
  );
}

const inputCls = "h-12 rounded-xl px-3.5 text-base";

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      {children}
      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function nextWeekdays(from: Date, n: number) {
  const out: string[] = [];
  const d = new Date(from);
  while (out.length < n) {
    if (isWeekday(d)) out.push(toDateKey(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function isPastShift(s: Shift, now: Date) {
  const h = now.getHours() + now.getMinutes() / 60;
  return s === "manha" ? h >= 12.5 : s === "tarde" ? h >= 18.5 : h >= 22.5;
}

export const fmtDay = (k: string) => fromDateKey(k).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
