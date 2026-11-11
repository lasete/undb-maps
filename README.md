# UNDB Maps · protótipo

Mapa do campus da UNDB (Av. Colares Moreira, 443 · Renascença · São Luís-MA) com:
sala de cada turma, ocupação por turno, reserva de salas, rota até o prédio e conceito de realidade aumentada.
Um único web app, com layout próprio para **totem vertical (1080×1920)** e **celular**.

```bash
npm install
npm run dev        # http://localhost:3000
```

| Rota | O que é |
| --- | --- |
| `/` | Web app (celular; no computador o painel vira coluna lateral) |
| `/totem` | Totem vertical: proporção 9:16 travada, tela de descanso após 60 s, QR para levar a rota |
| `/apresentacao` | Página para apresentar: totem e celular lado a lado + lista de funcionalidades |

Deep links (usados pelos QR do totem): `/?sala=302`, `/?predio=norte`, `/?sala=302&reservar=1`.

## Modos de visualização

- **Satélite**: imagem real do campus + contorno do lote (OpenStreetMap)
- **Mapa**: versão vetorial simplificada, com as mesmas coordenadas
- **3D**: satélite como chão + volumes dos prédios (altura ilustrativa)
- **Prédios**: cartões com salas livres agora (bom para quem não lê mapa)
- **Salas**: "Onde é minha aula?" (curso + turno → sala) e busca em todas as salas
- **Passeio** (street view por fotos): 78 fotos reais em ordem de caminhada reconstruída pela continuidade visual (piso, teto, grades, placas), setas no chão, 10 trechos e atalhos para 13 lugares identificados pelas placas
- **RA (em desenvolvimento / WIP)**: prévia do conceito com câmera, seta e distância real até o prédio
- Tema claro/escuro, **alto contraste**, **texto maior** e **modo alcance** (totem)

## Fontes dos dados (nada inventado)

| Dado | Fonte | Arquivo |
| --- | --- | --- |
| Prédios, salas e turmas por turno | Mapa de Salas 2025.2 oficial (undb.edu.br/mapa-de-salas) | `src/lib/alocacao.ts`, `docs/referencia/mapa-salas-2025-2.pdf` |
| Imagem do campus | Esri World Imagery, zoom 19 | `public/campus/satelite.jpg` |
| Contornos dos prédios (quarteirão inteiro) | Mapa colorido da equipe (11/11/2026) traçado sobre o satélite | `src/lib/campus.ts` (`BUILDINGS`, `AREAS`) |
| Passeio (fotos) | 81 fotos da equipe, 10/11/2026 (sv-001 é print, sv-028/029 tremidas: fora do passeio) | `public/streetview/raw`, `src/lib/streetview.ts` |
| Identidade visual | Paleta e fontes do site undb.edu.br, logos oficiais | `src/app/globals.css`, `public/logo*.png` |

## A confirmar com a UNDB

1. **Prédios mapeados** (mapa da equipe): Norte e Sul, Central (MET 01/02, Hands On e entrada das Tutorias), Ala das Tutorias
   (salas de tutoria e Medicina), Prédio Oeste + Labs de Engenharia e a garagem da diretoria. O Colégio Dom Bosco aparece
   apagado e fica fora do mapeamento. O editor (⚙️ → *Abrir editor do mapa*) agora só move o portão/totem.
2. **Andar de cada série de salas** (100/200, 300/400…), capacidade e recursos das salas: ainda não foram publicados.
3. **Caminhos internos.** A rota hoje é uma linha reta do portão até o prédio, com distância real. Falta levantar as calçadas.
4. **Faixa de horário dos turnos**: o protótipo usa manhã até 12h30, tarde até 18h30 e noite até 22h30.
5. **Prédio Oeste (salas 701–803)** e **Ala das Tutorias**: os espaços vêm das placas fotografadas; falta a lista de salas e os horários.
6. **Fotos do passeio**: borrar rostos (`pessoas: true` em `src/lib/streetview.ts`) antes de publicar. Para um street view 360° de verdade, refazer com câmera 360° e GPS ligado.
7. **RA no totem**: ideia em aberto: no totem, a aba RA mostraria só um QR code para abrir a RA no celular. Definir com a equipe.
8. **Imagem de satélite para produção**: trocar por foto de drone própria ou por tiles licenciados.

## Protótipo × produto

- As reservas ficam no `localStorage` do aparelho. No produto, vão para uma API com login pela matrícula.
- Para o 2026.1, basta atualizar a tabela `RAW` em `src/lib/alocacao.ts`.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind 4 · shadcn/ui (Base UI) · Three.js / React Three Fiber + postprocessing (WebGL) · GSAP · Spline (opcional) · lucide-react · qrcode.react.

- **Mapa 3D** (`src/components/CampusScene.tsx`): uma cena WebGL só para Satélite, Mapa e 3D. Chão = satélite em duotone
  (`public/campus/satelite-noite.jpg` / `-dia.jpg`), telhados = recorte real do satélite, fachadas procedurais com janelas,
  câmera animada por GSAP, rota em arco (distância em linha reta). Altura dos prédios é ilustrativa (2 pavimentos).
- **Spline**: crie a cena no editor do Spline, publique e coloque a URL em `.env.local`:
  `NEXT_PUBLIC_SPLINE_SCENE=https://prod.spline.design/.../scene.splinecode`. Ela vira o fundo da tela de descanso do totem.
- **Editor do mapa** continua em SVG sobre o satélite (`CampusMap.tsx`), por ser uma ferramenta de precisão.
