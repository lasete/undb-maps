import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import DeviceFrame from "./DeviceFrame";

export const metadata: Metadata = { title: "UNDB Maps · Apresentação" };

const FEATURES = [
  ["Satélite real", "Imagem pública do campus com o contorno do lote do OpenStreetMap."],
  ["Mapa, 3D e Prédios", "Quatro modos de visualização para o mesmo dado: escolha o que lê melhor."],
  ["Onde é minha aula?", "Curso + turno → sala, direto do Mapa de Salas 2025.2 oficial."],
  ["Ocupação por turno", "Cada sala mostra se tem turma agora, pela alocação oficial."],
  ["Reserva de salas", "Turnos livres reserváveis, com código e QR de confirmação."],
  ["Totem + celular", "Mesma base, layout próprio para o totem vertical e QR para levar a rota."],
  ["Acessibilidade", "Alto contraste, texto maior e modo alcance para cadeirantes no totem."],
  ["RA (próxima fase)", "Conceito com câmera, seta e distância real até o prédio."],
];

export default function Apresentacao() {
  return (
    <main className="min-h-dvh bg-undb-ink text-undb-cream">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-8 sm:px-8">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-4">
            <Image src="/undb-mark.png" alt="UNDB Centro Universitário" width={64} height={64} className="size-16 rounded-2xl shadow-[0_18px_50px_-12px_#cf004e]" priority />
            <h1 className="font-display text-[clamp(2.2rem,5vw,4rem)] leading-[0.95] font-extrabold tracking-tight">
              UNDB <span className="grad-undb bg-clip-text text-transparent">Maps</span>
            </h1>
            <p className="max-w-xl text-undb-cream/75">
              Protótipo navegável: mapa do campus, a sala de cada turma, reserva de espaços e realidade aumentada. Um único web app, rodando no totem vertical e no celular.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/totem" target="_blank" className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-white/10 px-4 text-sm font-semibold hover:bg-white/20">
              Abrir totem <ArrowUpRight className="size-4" />
            </Link>
            <Link href="/" target="_blank" className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-[#CF004E] px-4 text-sm font-semibold text-white hover:brightness-110">
              Abrir web app <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </header>

        <section className="grid items-start gap-8 lg:grid-cols-[1.1fr_0.9fr_1fr]">
          <DeviceFrame src="/totem" label="Totem vertical · 1080 × 1920" width={1080} height={1920} kind="totem" />
          <DeviceFrame src="/" label="Celular · 390 × 844" width={390} height={844} kind="phone" />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {FEATURES.map(([t, d], i) => (
              <li key={t} className="flex gap-3 rounded-2xl bg-white/5 p-4">
                <span className="font-display text-sm font-extrabold text-[#FFBA00] tabular">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <strong className="block font-display">{t}</strong>
                  <span className="text-sm text-undb-cream/70">{d}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <footer className="border-t border-white/10 pt-6 text-xs text-undb-cream/60">
          Fontes: Mapa de Salas 2025.2 (undb.edu.br/mapa-de-salas) · Imagem © Esri World Imagery · Lote © OpenStreetMap. Posição dos prédios e andares a confirmar com a UNDB.
        </footer>
      </div>
    </main>
  );
}
