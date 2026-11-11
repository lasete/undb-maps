"use client";

import { useEffect } from "react";
import { MapPin, X } from "lucide-react";
import type { Settings } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button, SectionTitle, Toggle } from "./ui";

interface Props {
  settings: Settings;
  totem: boolean;
  onChange: (p: Partial<Settings>) => void;
  onClose: () => void;
  onEditor: () => void;
}

const THEMES: { value: Settings["theme"]; label: string; bg: string; card: string; accent: string }[] = [
  { value: "system", label: "Automático", bg: "linear-gradient(90deg,#fbf6f2 50%,#120a10 50%)", card: "#ffffff80", accent: "#cf004e" },
  { value: "light", label: "Claro", bg: "#fbf6f2", card: "#ffffff", accent: "#cf004e" },
  { value: "dark", label: "Escuro", bg: "#120a10", card: "#1c1018", accent: "#ff3f80" },
];

export default function SettingsPanel({ settings, totem, onChange, onClose, onEditor }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[var(--z-overlay)] flex items-end justify-center bg-black/55 backdrop-blur-sm desk:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
        className="sheet-in flex max-h-[88dvh] w-full max-w-lg flex-col gap-6 overflow-y-auto rounded-t-[2rem] border border-border bg-card p-5 pb-8 shadow-2xl desk:rounded-[2rem]"
      >
        <div className="mx-auto -mt-2 h-1.5 w-12 rounded-full bg-border desk:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-[0.7rem] font-bold tracking-[0.2em] text-primary uppercase">Preferências</p>
            <h2 id="settings-title" className="font-display text-2xl font-extrabold tracking-tight">
              Visualização
            </h2>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="grid size-10 place-items-center rounded-full bg-muted transition-colors hover:bg-accent">
            <X className="size-[1.1rem]" />
          </button>
        </div>

        <section className="flex flex-col gap-3">
          <SectionTitle>Tema</SectionTitle>
          <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2">
            {THEMES.map((t) => {
              const active = settings.theme === t.value;
              return (
                <button
                  key={t.value}
                  role="radio"
                  aria-checked={active}
                  onClick={() => onChange({ theme: t.value })}
                  className={cn(
                    "flex flex-col gap-2 rounded-2xl border p-2 text-left transition-colors duration-150",
                    active ? "border-primary ring-2 ring-primary/30" : "border-border hover:bg-muted",
                  )}
                >
                  <span className="relative block h-16 overflow-hidden rounded-xl border border-border" style={{ background: t.bg }} aria-hidden>
                    <span className="absolute inset-x-2 top-2 h-3 rounded-md" style={{ background: t.card }} />
                    <span className="absolute bottom-2 left-2 h-3 w-8 rounded-full" style={{ background: t.accent }} />
                  </span>
                  <span className="px-1 text-sm font-semibold">{t.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-1">
          <SectionTitle>Acessibilidade</SectionTitle>
          <div className="divide-y divide-border">
            <Toggle checked={settings.contrast} onChange={(v) => onChange({ contrast: v })} label="Alto contraste" hint="Preto, branco e amarelo, para baixa visão" />
            <Toggle checked={settings.largeText} onChange={(v) => onChange({ largeText: v })} label="Texto maior" hint="Aumenta toda a interface em 20%" />
            {totem && (
              <Toggle
                checked={settings.reach}
                onChange={(v) => onChange({ reach: v })}
                label="Modo alcance"
                hint="Traz a interface para a metade de baixo do totem (cadeirantes e crianças)"
              />
            )}
          </div>
        </section>

        <section className="flex flex-col gap-1">
          <SectionTitle>Apresentação</SectionTitle>
          <Toggle
            checked={settings.demoClock}
            onChange={(v) => onChange({ demoClock: v })}
            label="Relógio de demonstração"
            hint="Simula um dia útil às 10h05 para mostrar a ocupação real do turno da manhã"
          />
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle>Equipe</SectionTitle>
          <Button onClick={onEditor} size="lg">
            <MapPin className="size-4" /> Ajustar posição do totem
          </Button>
          <p className="text-xs text-muted-foreground">Arraste o portão até onde o totem vai ficar e exporte o JSON para o projeto.</p>
        </section>
      </div>
    </div>
  );
}
