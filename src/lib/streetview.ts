/**
 * Passeio pelo campus (street view por fotos).
 *
 * Fonte: 80 fotos tiradas pela equipe na noite de 10/11/2026, padronizadas em
 * public/streetview/fotos (retrato 720×1280, luz equilibrada, WebP); originais em raw/
 * (public/streetview/raw). A ordem de ENVIO não era a ordem da caminhada,
 * então o trajeto abaixo foi reconstruído foto a foto, pela continuidade
 * visual: tipo de piso, teto, telas, grades e placas (ver `cue` de cada trecho).
 * O WhatsApp remove o GPS: cada foto tem trecho e legenda, não coordenada.
 *
 * `pessoas: true` = há gente identificável. Borrar rostos antes de publicar.
 * Fora do passeio: sv-001 (print de grade curricular), sv-028/029 (tremidas).
 */

export type SegmentId =
  | "entrada"
  | "terreo"
  | "tutorias"
  | "salas"
  | "cantina"
  | "jardins"
  | "fachada"
  | "grades"
  | "oeste"
  | "patio";

export interface Segment {
  name: string;
  color: string;
  /** pista visual que liga este trecho ao anterior */
  cue: string;
}

export const SEGMENTS: Record<SegmentId, Segment> = {
  entrada: { name: "Entrada", color: "#FB2A41", cue: "Recepção envidraçada e catracas com piso tátil contínuo" },
  terreo: { name: "Térreo · estudo e convivência", color: "#E0124F", cue: "Mesmo piso de granilite com faixa tátil preta e pilares verde-oliva" },
  tutorias: { name: "Rampas e tutorias", color: "#CF004E", cue: "Rampas de piso mosaico saindo do corredor do térreo (vistas na foto anterior)" },
  salas: { name: "Andar das salas", color: "#B4087A", cue: "Piso branco com faixas pretas, vigas aparentes e tela de proteção lateral" },
  cantina: { name: "Passarela e cantina", color: "#FFBA00", cue: "A tela da passarela é a mesma do corredor; o piso de borracha desce até a cantina" },
  jardins: { name: "Jardins e praça", color: "#9A0F86", cue: "Saída lateral da cantina, sob a mesma treliça amarela" },
  fachada: { name: "Fachada e calçadas", color: "#7A1F9E", cue: "Passarela de policarbonato e calçada ao longo do prédio cinza" },
  grades: { name: "Corredor das grades", color: "#54595F", cue: "Cobertura metálica e grade branca, ao lado do pátio do Colégio Dom Bosco" },
  oeste: { name: "Prédio Oeste", color: "#3F2C84", cue: "Placas “Prédio Oeste · salas 701–803” apontando o caminho" },
  patio: { name: "Pátio, Engenharia e Anatomia", color: "#4600A6", cue: "Pilares vermelhos inclinados e a grande treliça clara do pátio" },
};

export interface Stop {
  file: string;
  n: number;
  segment: SegmentId;
  caption: string;
  pessoas?: boolean;
}

const S = (n: number, segment: SegmentId, caption: string, pessoas = false): Stop => ({
  file: `/streetview/fotos/sv-${String(n).padStart(3, "0")}.webp`,
  n,
  segment,
  caption,
  pessoas,
});

export const STOPS: Stop[] = [
  // 1 · Entrada
  S(14, "entrada", "Recepção, logo na chegada", true),
  S(13, "entrada", "Corredor das catracas", true),
  S(15, "entrada", "Hall de serviço depois das catracas"),

  // 2 · Térreo
  S(34, "terreo", "Corredor de acesso às salas de estudo"),
  S(35, "terreo", "Salas de Estudo"),
  S(36, "terreo", "Cabines de estudo envidraçadas", true),
  S(38, "terreo", "Fim das cabines, já junto à parede vinho da convivência"),
  S(37, "terreo", "CPA · Comissão Própria de Avaliação", true),
  S(42, "terreo", "Convivência: “Os melhores se formam aqui” (placa da CPA à direita)", true),
  S(41, "terreo", "Convivência sob o teto verde", true),
  S(43, "terreo", "Sofás da convivência, escada ao fundo", true),
  S(45, "terreo", "Máquina de lanches no mesmo salão", true),
  S(44, "terreo", "Recepção da biblioteca, vista da convivência", true),
  S(46, "terreo", "Biblioteca Consuelo Bello Pereira · Unidade I", true),
  S(40, "terreo", "Corredor com as rampas à direita", true),

  // 3 · Rampas e tutorias
  S(9, "tutorias", "Subindo a rampa de piso mosaico", true),
  S(12, "tutorias", "Rampa com pilar de pastilhas", true),
  S(10, "tutorias", "Cisco Networking Academy"),
  S(11, "tutorias", "Entrada da Central de Tutorias"),
  S(16, "tutorias", "Sala dos Professores"),
  S(17, "tutorias", "Corredor dos armários", true),
  S(18, "tutorias", "Placa: Laboratórios → · Sala de Conferências, Professores e Tutorias ←"),
  S(19, "tutorias", "Rumo aos labs de Microscopia, Multidisciplinar e Morfofuncional", true),
  S(20, "tutorias", "Fim do corredor dos laboratórios"),

  // 4 · Andar das salas
  S(2, "salas", "Corredor das salas, tela de proteção à esquerda", true),
  S(5, "salas", "Mesmo corredor no intervalo", true),
  S(3, "salas", "Porta do Departamento Pessoal"),
  S(8, "salas", "Mural: Mentoria e campanha de doação de sangue"),
  S(4, "salas", "Escada com rampa ao lado"),
  S(7, "salas", "Hall da escada", true),
  S(6, "salas", "Acesso aos banheiros"),

  // 5 · Passarela e cantina
  S(21, "cantina", "Passarela de borracha, mesma tela do corredor"),
  S(22, "cantina", "Descendo a rampa coberta"),
  S(39, "cantina", "Fim da rampa: entrada da cantina", true),
  S(24, "cantina", "Praça de alimentação; ao fundo, placa do Prédio Central", true),

  // 6 · Jardins e praça
  S(30, "jardins", "Saída lateral da cantina", true),
  S(25, "jardins", "Rampa de borracha junto ao muro"),
  S(26, "jardins", "Canteiro de palmeiras"),
  S(27, "jardins", "Canteiro de palmeiras"),
  S(23, "jardins", "Jardim iluminado"),
  S(31, "jardins", "Praça das mesas redondas"),
  S(32, "jardins", "Praça das mesas redondas"),
  S(33, "jardins", "Praça das mesas redondas"),

  // 7 · Fachada e calçadas
  S(49, "fachada", "Passarela de policarbonato", true),
  S(53, "fachada", "Hall visto pela fachada de vidro"),
  S(51, "fachada", "Sala de piso roxo vista pelo vidro", true),
  S(50, "fachada", "Passarela ao lado do jardim"),
  S(47, "fachada", "Vista do estacionamento"),
  S(48, "fachada", "Subestação de energia (acesso restrito)"),
  S(52, "fachada", "Calçada lateral arborizada"),

  // 8 · Corredor das grades
  S(54, "grades", "Calçada coberta junto à grade"),
  S(55, "grades", "Portão da grade", true),
  S(56, "grades", "Vista pela grade"),
  S(57, "grades", "Pátio do Colégio Dom Bosco, pela grade"),
  S(58, "grades", "Corredor coberto entre grades"),
  S(78, "grades", "Corredor coberto entre grades"),
  S(79, "grades", "Portão com vista para o pátio do colégio"),
  S(77, "grades", "Passagem entre muro e grade"),
  S(59, "grades", "Curva da passagem"),
  S(60, "grades", "Rampa entre grade e muro"),
  S(74, "grades", "Rampa coberta longa", true),
  S(61, "grades", "Corredor coberto ao longo do prédio"),

  // 9 · Prédio Oeste
  S(81, "oeste", "Placa do Prédio Oeste ao fundo"),
  S(80, "oeste", "“Prédio Oeste · salas 701–803 →”", true),
  S(76, "oeste", "“Prédio Oeste ← salas 701–803”"),
  S(75, "oeste", "Portão de acesso, placa suspensa à frente"),
  S(66, "oeste", "Entrada do Prédio Oeste · salas 701–803"),

  // 10 · Pátio, Engenharia e Anatomia
  S(67, "patio", "Pátio sob os pilares vermelhos"),
  S(68, "patio", "Escadaria sob a treliça"),
  S(62, "patio", "Elevador · Térreo: Labs da Engenharia · 1º e 2º: Labs Multidisciplinares"),
  S(65, "patio", "Labs de Solos, Análise de Materiais, Topografia, Hidráulica e Resistência"),
  S(63, "patio", "Janela de laboratório"),
  S(64, "patio", "Laboratório visto pela janela"),
  S(72, "patio", "Calçada com piso tátil e rampa"),
  S(73, "patio", "Rampa com corrimão"),
  S(71, "patio", "Centro de Anatomia Humana"),
  S(69, "patio", "Pátio interno"),
  S(70, "patio", "Pátio com quiosque, fim do passeio"),
];

/** Lugares confirmados por placa nas fotos → atalho direto no passeio. */
export const PLACES: { name: string; detail: string; file: number }[] = [
  { name: "Prédio Oeste", detail: "Salas 701–803 (não consta no Mapa de Salas 2025.2)", file: 66 },
  { name: "Biblioteca Consuelo Bello Pereira", detail: "Unidade I", file: 46 },
  { name: "Centro de Anatomia Humana", detail: "Fachada própria", file: 71 },
  { name: "Laboratórios da Engenharia", detail: "Solos, Materiais, Topografia, Hidráulica, Resistência", file: 65 },
  { name: "Labs Multidisciplinares", detail: "1º e 2º andares, junto ao elevador", file: 62 },
  { name: "Central de Tutorias", detail: "Placa na entrada da ala", file: 11 },
  { name: "Sala dos Professores", detail: "Ala das tutorias", file: 16 },
  { name: "Labs de Microscopia e Morfofuncional", detail: "Seguir a placa →", file: 18 },
  { name: "Salas de Estudo", detail: "Cabines envidraçadas", file: 35 },
  { name: "CPA", detail: "Comissão Própria de Avaliação", file: 37 },
  { name: "Praça de alimentação", detail: "Ao lado do Prédio Central", file: 24 },
  { name: "Área de convivência", detail: "Sofás e mesas", file: 42 },
  { name: "Recepção", detail: "Catracas e atendimento", file: 14 },
];

export const stopIndexOf = (n: number) => STOPS.findIndex((s) => s.n === n);
