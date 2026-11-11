/**
 * Campus UNDB · Renascença · São Luís-MA — o quarteirão inteiro.
 *
 * FONTES:
 *  - Imagem: Esri World Imagery, zoom 19 (public/campus/satelite*.jpg),
 *    do quarteirão entre Av. do Vale, R. Prof. Luís Pinho Rodrigues,
 *    R. Monção e Av. Coronel Colares Moreira.
 *  - Contornos dos prédios: mapa colorido feito pela equipe (11/11/2026),
 *    traçados sobre o satélite. Norte/Sul (azul), Central (lilás), Ala das
 *    Tutorias (roxo), Prédio Oeste + Labs (vinho), garagem (laranja) e
 *    Colégio Dom Bosco (vermelho, fora do mapeamento).
 *  - Salas e turmas: "Mapa de Salas 2025.2" oficial (undb.edu.br/mapa-de-salas).
 *  - Espaços sem horário publicado: placas fotografadas no passeio.
 *
 * Coordenadas: pixels da imagem (1600 × 1180), norte para cima.
 */

export type Pt = [number, number];

export const MAP = {
  width: 1600,
  height: 1180,
  image: "/campus/satelite.jpg",
  metersPerPx: 0.1491,
  bounds: { north: -2.498979, west: -44.288339, south: -2.50056, east: -44.286193 },
  attribution: "Imagem © Esri World Imagery · contornos: equipe UNDB Maps",
  /** área do quarteirão usada para enquadrar a câmera */
  focus: { x0: 100, x1: 1510, y0: 140, y1: 1080 },
  /** borda da Av. Coronel Colares Moreira (para o modo "Mapa") */
  avenue: { origin: { x: 1166, y: 694 }, dir: { x: 0.926, y: -0.378 }, normal: { x: 0.378, y: 0.926 } },
};

export type BuildingId = "norte" | "sul" | "central" | "tutorias" | "oeste";

export interface Building {
  id: BuildingId;
  tile: string;
  name: string;
  short: string;
  color: string;
  ink: string;
  /** contorno real (pixels da imagem) */
  poly: Pt[];
  /** pavimentos — ILUSTRATIVO onde a UNDB não publica */
  floors: number;
  /** grupos de salas/espaços exibidos no painel */
  series: string[];
  note?: string;
}

export const BUILDINGS: Building[] = [
  {
    id: "norte",
    tile: "N",
    name: "Prédio Norte",
    short: "Norte",
    color: "#FB2A41",
    ink: "#FFFFFF",
    poly: [[972, 205], [1498, 205], [1498, 325], [972, 325]],
    floors: 2,
    series: ["100", "200"],
  },
  {
    id: "central",
    tile: "C",
    name: "Prédio Central",
    short: "Central",
    color: "#B4087A",
    ink: "#FFFFFF",
    poly: [[981, 336], [1143, 336], [1143, 446], [981, 446]],
    floors: 2,
    series: ["500"],
    note: "Entrada das Tutorias",
  },
  {
    id: "sul",
    tile: "S",
    name: "Prédio Sul",
    short: "Sul",
    color: "#4600A6",
    ink: "#FFFFFF",
    poly: [[992, 459], [1488, 459], [1488, 571], [992, 571]],
    floors: 2,
    series: ["300", "400"],
  },
  {
    id: "tutorias",
    tile: "T",
    name: "Ala das Tutorias",
    short: "Tutorias",
    color: "#6C2BD9",
    ink: "#FFFFFF",
    poly: [[555, 190], [770, 196], [968, 205], [968, 316], [770, 316], [770, 286], [555, 286]],
    floors: 2,
    series: ["Tutorias", "Medicina"],
    note: "Extensão do Prédio Central: a entrada é pelo Central",
  },
  {
    id: "oeste",
    tile: "O",
    name: "Prédio Oeste",
    short: "Oeste",
    color: "#8C1C3C",
    ink: "#FFFFFF",
    poly: [[150, 549], [540, 549], [540, 949], [500, 1066], [117, 1066], [117, 930], [150, 930]],
    floors: 3,
    series: ["Salas", "Engenharia"],
    note: "Salas 701–803 e laboratórios de Engenharia",
  },
];

/** Áreas que aparecem no mapa mas não têm salas. */
export const AREAS: { id: string; name: string; kind: "servico" | "fora"; poly: Pt[] }[] = [
  { id: "garagem", name: "Garagem da diretoria", kind: "servico", poly: [[752, 322], [901, 322], [901, 469], [752, 469]] },
  { id: "dombosco-1", name: "Colégio Dom Bosco", kind: "fora", poly: [[245, 203], [320, 150], [565, 352], [528, 501], [459, 501], [245, 330]] },
  { id: "dombosco-2", name: "Colégio Dom Bosco", kind: "fora", poly: [[539, 459], [939, 459], [939, 800], [853, 830], [629, 960], [539, 960]] },
];

/** Posição editável (só o portão / totem). */
export interface Layout {
  gate: { x: number; y: number };
  confirmed: boolean;
}

export const DEFAULT_LAYOUT: Layout = {
  gate: { x: 1169, y: 686 },
  confirmed: true,
};

/* ------------------------------------------------------------------ salas */

export interface Room {
  id: string;
  code: string;
  label: string;
  building: BuildingId;
  series: string;
  aka?: string;
  /** sem horário publicado: não entra na contagem de livres/ocupadas */
  noSchedule?: boolean;
  source?: "pdf" | "placa";
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const sala = (n: number, building: BuildingId, aka?: string): Room => ({
  id: String(n),
  code: String(n),
  label: aka ? `Sala ${n} · ${aka}` : `Sala ${n}`,
  building,
  series: `${Math.floor(n / 100)}00`,
  aka,
  source: "pdf",
});

const espaco = (id: string, label: string, building: BuildingId, series: string, code = label): Room => ({
  id,
  code,
  label,
  building,
  series,
  noSchedule: true,
  source: "placa",
});

export const ROOMS: Room[] = [
  // Prédio Norte (PDF)
  sala(101, "norte", "MET 04"),
  sala(102, "norte", "MET 05"),
  ...range(103, 107).map((n) => sala(n, "norte")),
  ...range(201, 216).map((n) => sala(n, "norte")),
  // Prédio Sul (PDF)
  ...range(301, 310).map((n) => sala(n, "sul")),
  ...range(401, 410).map((n) => sala(n, "sul")),
  // Prédio Central (PDF)
  sala(501, "central", "MET 01"),
  sala(502, "central", "MET 02"),
  { id: "hands-on", code: "Hands On", label: "Hands On", building: "central", series: "500", source: "pdf" },
  // Ala das Tutorias (PDF + placas)
  { id: "tutorias", code: "MET 03", label: "Tutorias · MET 03", building: "tutorias", series: "Tutorias", aka: "Tutorias", source: "pdf" },
  espaco("sala-professores", "Sala dos Professores", "tutorias", "Tutorias", "Professores"),
  espaco("sala-conferencias", "Sala de Conferências", "tutorias", "Tutorias", "Conferências"),
  espaco("lab-microscopia", "Laboratórios de Microscopia 1 e 2", "tutorias", "Medicina", "Microscopia"),
  espaco("lab-multidisciplinar", "Laboratório Multidisciplinar", "tutorias", "Medicina", "Multidisc."),
  espaco("lab-morfofuncional", "Laboratório Morfofuncional", "tutorias", "Medicina", "Morfofunc."),
  // Prédio Oeste (placas)
  espaco("oeste-salas", "Salas 701–803", "oeste", "Salas", "701–803"),
  espaco("lab-solos", "Laboratório de Solos", "oeste", "Engenharia", "Solos"),
  espaco("lab-materiais", "Laboratório de Análise de Materiais", "oeste", "Engenharia", "Materiais"),
  espaco("lab-topografia", "Laboratório de Topografia", "oeste", "Engenharia", "Topografia"),
  espaco("lab-hidraulica", "Laboratório de Hidráulica", "oeste", "Engenharia", "Hidráulica"),
  espaco("lab-resistencia", "Laboratório de Resistência", "oeste", "Engenharia", "Resistência"),
  espaco("labs-multi-oeste", "Labs Multidisciplinares (1º e 2º andares)", "oeste", "Engenharia", "Multidisc."),
];

export const getBuilding = (id: BuildingId) => BUILDINGS.find((b) => b.id === id)!;
export const getRoom = (id: string) => ROOMS.find((r) => r.id === id);
export const roomsOf = (b: BuildingId, series?: string) =>
  ROOMS.filter((r) => r.building === b && (series === undefined || r.series === series));
export const scheduledRoomsOf = (b: BuildingId) => roomsOf(b).filter((r) => !r.noSchedule);

export const seriesLabel = (s: string) => (/^\d00$/.test(s) ? `Salas ${s.replace("00", "xx")}` : s);

/* --------------------------------------------------------------- geometria */

export function bbox(poly: Pt[]) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

export function centroid(poly: Pt[]): Pt {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  a /= 2;
  return [cx / (6 * a), cy / (6 * a)];
}

/** ponto do contorno mais próximo de p */
export function nearestOnPoly(poly: Pt[], p: { x: number; y: number }) {
  let best = { x: poly[0][0], y: poly[0][1] };
  let bd = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / (dx * dx + dy * dy || 1)));
    const q = { x: ax + t * dx, y: ay + t * dy };
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  return best;
}
