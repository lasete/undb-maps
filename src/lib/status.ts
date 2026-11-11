import { allocationsOf, describeAllocation, shiftAt, type Shift, SHIFT_LABEL } from "./alocacao";
import { getRoom } from "./campus";

export interface Reservation {
  id: string;
  code: string;
  roomId: string;
  date: string; // YYYY-MM-DD
  shift: Shift;
  name: string;
  matricula: string;
  purpose: string;
  people: number;
  createdAt: number;
}

export const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const fromDateKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const isWeekday = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6;

export type ShiftState =
  | { kind: "aula"; labels: string[] }
  | { kind: "minha"; reservation: Reservation }
  | { kind: "livre" }
  | { kind: "sem-dados" };

/** Situação da sala num dia/turno, cruzando o PDF oficial com as reservas. */
export function shiftState(roomId: string, dateKey: string, shift: Shift, reservations: Reservation[]): ShiftState {
  const mine = reservations.find((r) => r.roomId === roomId && r.date === dateKey && r.shift === shift);
  if (mine) return { kind: "minha", reservation: mine };
  if (!isWeekday(fromDateKey(dateKey))) return { kind: "sem-dados" };
  const al = allocationsOf(roomId, shift);
  if (al.length) return { kind: "aula", labels: al.map(describeAllocation) };
  return { kind: "livre" };
}

export function roomStatusNow(roomId: string, now: Date, reservations: Reservation[]) {
  const shift = shiftAt(now);
  if (getRoom(roomId)?.noSchedule) return { tone: "neutral" as const, label: "Horário não publicado", shift };
  if (!shift) return { tone: "neutral" as const, label: "Fora do horário de aulas", shift };
  const s = shiftState(roomId, toDateKey(now), shift, reservations);
  if (s.kind === "aula") return { tone: "busy" as const, label: `Com aula · ${SHIFT_LABEL[shift].toLowerCase()}`, shift, detail: s.labels };
  if (s.kind === "minha") return { tone: "mine" as const, label: "Sua reserva agora", shift };
  return { tone: "free" as const, label: `Livre · ${SHIFT_LABEL[shift].toLowerCase()}`, shift };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeReservationCode(seed: string) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += alphabet[hash(seed + i) % alphabet.length];
  return `UNDB-${out}`;
}
