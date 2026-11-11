"use client";

import { useId, useMemo, useState } from "react";
import { ChevronRight, GraduationCap, Search, SearchX } from "lucide-react";
import { BUILDINGS, ROOMS, getBuilding, getRoom, type BuildingId, type Room } from "@/lib/campus";
import { ALLOCATIONS, COURSES, SEMESTER, SHIFT_LABEL, allocationsOf, describeAllocation, shiftAt, type Shift } from "@/lib/alocacao";
import { roomStatusNow, type Reservation } from "@/lib/status";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Chip, EmptyState, PageHeader, Segmented, SectionTitle, SourceNote, StatusPill } from "./ui";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const SHIFTS: Shift[] = ["manha", "tarde", "noite"];

interface Props {
  now: Date | null;
  reservations: Reservation[];
  autoFocus?: boolean;
  onRoom: (r: Room) => void;
}

export default function RoomList({ now, reservations, autoFocus, onRoom }: Props) {
  const [mode, setMode] = useState<"turma" | "salas">(autoFocus ? "salas" : "turma");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4">
      <PageHeader eyebrow={`Mapa de Salas ${SEMESTER}`} title="Salas e turmas" />
      <Segmented
        label="Modo"
        value={mode}
        onChange={setMode}
        options={[
          { value: "turma", label: "Onde é minha aula?" },
          { value: "salas", label: "Todas as salas" },
        ]}
      />
      {mode === "turma" ? <TurmaFinder now={now} onRoom={onRoom} /> : <AllRooms now={now} reservations={reservations} autoFocus={autoFocus} onRoom={onRoom} />}
    </div>
  );
}

/* ----------------------------------------------------- onde é minha aula? */

function TurmaFinder({ now, onRoom }: { now: Date | null; onRoom: (r: Room) => void }) {
  const uid = useId();
  const [course, setCourse] = useState("");
  const [shift, setShift] = useState<Shift | "">("");
  const effectiveShift = (shift || (now ? shiftAt(now) : null) || "manha") as Shift;

  const results = useMemo(() => ALLOCATIONS.filter((a) => a.course === course && a.shift === effectiveShift), [course, effectiveShift]);

  return (
    <section className="flex flex-col gap-4">
      <div
        className="relative overflow-hidden rounded-3xl p-5 text-white"
        style={{ background: "linear-gradient(135deg, #ee0a3c 0%, #d9206e 50%, #8e1a8a 100%)" }}
      >
        <span aria-hidden className="absolute -top-8 -right-8 grid rotate-12 grid-cols-2 gap-1.5 opacity-15">
          {["U", "N", "D", "B"].map((l) => (
            <span key={l} className="grid size-16 place-items-center bg-white font-display text-3xl font-bold text-[#d1237a]">
              {l}
            </span>
          ))}
        </span>
        <GraduationCap className="relative mb-3 size-7" />
        <h2 className="relative font-display text-2xl leading-tight font-extrabold tracking-tight">Descubra a sala da sua turma</h2>
        <p className="relative mt-1 max-w-[18rem] text-sm text-white/85">Escolha o curso e o turno. A sala vem direto do Mapa de Salas oficial.</p>

        <div className="relative mt-4 flex flex-col gap-2.5">
          <label htmlFor={`${uid}-c`} className="sr-only">
            Curso
          </label>
          <select
            id={`${uid}-c`}
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            className="h-12 w-full rounded-2xl border-0 bg-white px-4 text-base font-medium text-[#1b0d17] outline-none focus-visible:ring-4 focus-visible:ring-white/40"
          >
            <option value="">Selecione o seu curso</option>
            {COURSES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <div role="radiogroup" aria-label="Turno" className="grid grid-cols-3 gap-1 rounded-2xl bg-black/20 p-1">
            {SHIFTS.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={effectiveShift === s}
                onClick={() => setShift(s)}
                className={cn(
                  "min-h-10 rounded-xl text-sm font-semibold transition-colors duration-150",
                  effectiveShift === s ? "bg-white text-[#1b0d17]" : "text-white/85 hover:bg-white/10",
                )}
              >
                {SHIFT_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {course &&
        (results.length === 0 ? (
          <EmptyState icon={<SearchX className="size-6" />} title="Nenhuma turma nesse turno">
            {course} não tem turmas no turno da {SHIFT_LABEL[effectiveShift].toLowerCase()} em {SEMESTER}. Tente outro turno.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {results.map((a, i) => {
              const r = getRoom(a.roomId)!;
              const b = getBuilding(r.building);
              return (
                <li key={i}>
                  <button
                    onClick={() => onRoom(r)}
                    className="group flex w-full items-stretch overflow-hidden rounded-3xl border border-border bg-card text-left transition-transform duration-150 active:scale-[.99]"
                  >
                    <span className="w-1.5 shrink-0" style={{ background: b.color }} aria-hidden />
                    <span className="flex min-w-0 flex-1 items-center gap-4 p-4">
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-muted-foreground">
                          {a.period === "Turma" ? a.course : a.period.includes("º") ? `${a.period} período` : a.period}
                        </span>
                        <span className="mt-0.5 block font-display text-[1.6rem] leading-none font-extrabold tracking-tight tabular">{r.aka ?? r.code}</span>
                        <span className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <span className="size-2 rounded-sm" style={{ background: b.color }} aria-hidden />
                          {r.aka ? `${r.label} · ` : ""}
                          {b.name}
                        </span>
                      </span>
                      <span className="grid size-10 place-items-center rounded-full bg-muted transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <ChevronRight className="size-5" />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ))}
    </section>
  );
}

/* ----------------------------------------------------------- todas as salas */

function AllRooms({ now, reservations, autoFocus, onRoom }: Props) {
  const uid = useId();
  const [q, setQ] = useState("");
  const [building, setBuilding] = useState<BuildingId | "all">("all");
  const [onlyFree, setOnlyFree] = useState(false);

  const list = useMemo(() => {
    const nq = norm(q.trim());
    return ROOMS.filter((r) => {
      if (building !== "all" && r.building !== building) return false;
      if (onlyFree && now && roomStatusNow(r.id, now, reservations).tone !== "free") return false;
      if (!nq) return true;
      const hay = norm([r.label, r.code, r.aka ?? "", getBuilding(r.building).name, ...allocationsOf(r.id).map(describeAllocation)].join(" "));
      return nq.split(/\s+/).every((t) => hay.includes(t));
    });
  }, [q, building, onlyFree, now, reservations]);

  const groups = BUILDINGS.map((b) => ({ b, rooms: list.filter((r) => r.building === b.id) })).filter((g) => g.rooms.length);

  return (
    <section className="flex flex-col gap-4">
      <div className="relative">
        <label htmlFor={`${uid}-q`} className="sr-only">
          Buscar sala ou curso
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={`${uid}-q`}
          type="search"
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Sala, MET, curso… ex.: 302, direito 5º"
          className="h-13 rounded-2xl bg-card pr-4 pl-12 text-base"
        />
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <Chip active={onlyFree} onClick={() => setOnlyFree(!onlyFree)} className={onlyFree ? "border-free bg-free text-background" : ""}>
          <span className={cn("size-2 rounded-full", onlyFree ? "bg-background" : "bg-free")} />
          Livres agora
        </Chip>
        <Chip active={building === "all"} onClick={() => setBuilding("all")}>
          Todos
        </Chip>
        {BUILDINGS.map((b) => (
          <Chip key={b.id} active={building === b.id} onClick={() => setBuilding(b.id)}>
            <span className="size-2.5 rounded-sm" style={{ background: b.color }} />
            {b.short}
          </Chip>
        ))}
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={<SearchX className="size-6" />} title="Nenhuma sala encontrada">
          Tente o número da sala, “MET” ou o nome do curso.
        </EmptyState>
      ) : (
        groups.map(({ b, rooms }) => (
          <section key={b.id} className="flex flex-col gap-2">
            <SectionTitle aside={<span className="text-[0.7rem] text-muted-foreground">{rooms.length}</span>}>
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-sm" style={{ background: b.color }} aria-hidden />
                {b.name}
              </span>
            </SectionTitle>
            <ul className="overflow-hidden rounded-3xl border border-border bg-card">
              {rooms.map((r, i) => {
                const st = now ? roomStatusNow(r.id, now, reservations) : null;
                const al = now && st?.shift ? allocationsOf(r.id, st.shift) : [];
                return (
                  <li key={r.id} className={cn(i > 0 && "border-t border-border")}>
                    <button onClick={() => onRoom(r)} className="flex min-h-16 w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-muted">
                      <span className="grid h-11 min-w-12 shrink-0 place-items-center rounded-xl bg-muted px-2 font-display text-sm font-extrabold tabular">
                        {r.aka ?? (/^\d+$/.test(r.code) ? r.code : r.code.slice(0, 4))}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{r.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{al.length ? describeAllocation(al[0]) : r.noSchedule ? "Espaço sem horário publicado" : "Sem turma neste turno"}</span>
                      </span>
                      {st && <StatusPill tone={st.tone} label={st.tone === "free" ? "Livre" : st.tone === "busy" ? "Aula" : st.tone === "mine" ? "Sua" : "—"} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
      <SourceNote>Ocupação do turno atual pelo Mapa de Salas {SEMESTER}, cruzada com as reservas feitas no app.</SourceNote>
    </section>
  );
}
