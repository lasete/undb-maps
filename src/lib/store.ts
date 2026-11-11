"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Reservation } from "./status";
import { DEFAULT_LAYOUT, type Layout } from "./campus";

/**
 * Store mínimo persistido em localStorage. No produto real as reservas vão
 * para o back-end (com autenticação pela matrícula); aqui ficam no navegador.
 */
function createStore<T>(key: string, initial: T) {
  let state: T = initial;
  let loaded = false;
  const listeners = new Set<() => void>();

  const load = () => {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) state = { ...initial, ...JSON.parse(raw) };
    } catch {
      /* armazenamento indisponível: segue com o estado inicial */
    }
  };

  return {
    get: () => {
      load();
      return state;
    },
    set: (next: T | ((prev: T) => T)) => {
      load();
      state = typeof next === "function" ? (next as (p: T) => T)(state) : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(state));
      } catch {
        /* ignora */
      }
      listeners.forEach((l) => l());
    },
    subscribe: (l: () => void) => {
      listeners.add(l);
      const onStorage = (e: StorageEvent) => {
        if (e.key === key) {
          loaded = false;
          load();
          l();
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(l);
        window.removeEventListener("storage", onStorage);
      };
    },
    initial,
  };
}

/* ------------------------------------------------------------ reservas */

const reservationStore = createStore<{ items: Reservation[] }>("undb-maps:reservas", { items: [] });

export function useReservations() {
  const { items } = useSyncExternalStore(reservationStore.subscribe, reservationStore.get, () => reservationStore.initial);
  return {
    reservations: items,
    add: (r: Reservation) => reservationStore.set((s) => ({ items: [...s.items, r] })),
    cancel: (id: string) => reservationStore.set((s) => ({ items: s.items.filter((r) => r.id !== id) })),
  };
}

/* -------------------------------------------------------- preferências */

export interface Settings {
  theme: "system" | "light" | "dark";
  contrast: boolean;
  largeText: boolean;
  reach: boolean; // modo alcance (totem): conteúdo na metade de baixo
  demoClock: boolean;
  view: "satelite" | "mapa" | "3d" | "predios";
}

const settingsStore = createStore<Settings>("undb-maps:prefs", {
  theme: "system",
  contrast: false,
  largeText: false,
  reach: false,
  demoClock: false,
  view: "satelite",
});

/* ------------------------------------------------- layout (editor do mapa) */

const layoutStore = createStore<Layout>("undb-maps:layout-v2", DEFAULT_LAYOUT);

export function useLayout() {
  const layout = useSyncExternalStore(layoutStore.subscribe, layoutStore.get, () => layoutStore.initial);
  return [layout, layoutStore.set] as const;
}

export function useSettings() {
  const settings = useSyncExternalStore(settingsStore.subscribe, settingsStore.get, () => settingsStore.initial);
  return [settings, (patch: Partial<Settings>) => settingsStore.set((s) => ({ ...s, ...patch }))] as const;
}

/* --------------------------------------------------------------- relógio */

/**
 * Hora atual. Com o "relógio de demonstração" ligado, fixa em 10:05 de um
 * dia útil para a apresentação mostrar a ocupação real do turno da manhã.
 */
export function useNow(demo: boolean) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);
  if (!now) return null;
  if (!demo) return now;
  const d = new Date(now);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  d.setHours(10, 5, 0, 0);
  return d;
}
