/**
 * Alocação de turmas · transcrição fiel do "Mapa de Salas 2025.2" oficial
 * (docs/referencia/mapa-salas-2025-2.pdf). Formato: "período:sala; ...".
 * Ao sair o mapa de 2026.1, basta atualizar esta tabela.
 */

export type Shift = "manha" | "tarde" | "noite";

export const SHIFT_LABEL: Record<Shift, string> = { manha: "Manhã", tarde: "Tarde", noite: "Noite" };

export const SEMESTER = "2025.2";

const RAW: [Shift, string, string][] = [
  // MANHÃ · Prédio Norte
  ["manha", "Odontologia", "1º:205; 3º:203; 4º:204; 6º/9º:202; 7º:201"],
  ["manha", "Biomedicina", "1º:106; 3º:209; 4º/5º:206; 7º:207"],
  ["manha", "Farmácia", "1º:106; 3º/4º:209; 6º/7º/8º:208; 9º/10º:210"],
  ["manha", "Enfermagem", "3º:211; 5º:212; 8º:213"],
  ["manha", "Psicologia", "3º:214; 5º:215; 7º:216"],
  ["manha", "Medicina", "MET 04:101; MET 05:102"],
  ["manha", "Nutrição", "1º:107"],
  ["manha", "Fisioterapia", "1º:107; 2º/9º/10º:105"],
  // MANHÃ · Prédio Sul
  ["manha", "Psicologia", "1º:405; 2º:401; 4º:403; 6º:301; 8º:402; 9º/10º:404"],
  ["manha", "Biomedicina", "2º:303; 6º:304; 8º:305"],
  ["manha", "Nutrição", "2º:302; 3º/4º:306; 5º/6º:307; 7º/8º:308"],
  ["manha", "Fisioterapia", "3º/4º/5º:310; 6º/7º/8º:309"],
  ["manha", "Enfermagem", "1º:406; 2º:407; 4º:408; 6º:409; 7º:410"],
  ["manha", "Farmácia", "2º:302"],
  // MANHÃ · Prédio Central
  ["manha", "Medicina", "MET 01:501; MET 02:502; MET 03:tutorias"],
  ["manha", "Arquitetura", "Turma:hands-on"],

  // TARDE · Prédio Norte
  ["tarde", "Odontologia", "2º:201; 3º:203; 4º:204; 5º/6º/7º/9º:202; 8º:205"],
  ["tarde", "Arquitetura", "1º/2º:206; 3º/4º:207; 5º/6º:209; 7º:210; 8º:208; 9º:211; 10º:212"],
  ["tarde", "Medicina", "MET 04:101; MET 05:102"],
  ["tarde", "Escola de Tecnologia", "1º:216"],
  // TARDE · Prédio Sul
  [
    "tarde",
    "Direito",
    "1º:301; 2ºA:302; 2ºB:303; 2ºC:304; 3º:305; 4ºA:306; 4ºB:401; 4ºC:307; 5º:308; 6ºA:309; 6ºB:310; 7º:402; 8ºA:403; 8ºB:404; 9º:405; 10º:406",
  ],
  ["tarde", "Medicina Veterinária", "1º:409; 2ºA:407; 2ºB:408"],
  ["tarde", "Escola de Tecnologia", "2º:410"],
  // TARDE · Prédio Central
  ["tarde", "Medicina", "MET 01:501; MET 02:502; MET 03:tutorias"],
  ["tarde", "Arquitetura", "Turma:hands-on"],

  // NOITE · Prédio Norte
  ["noite", "Administração", "1º:105; 2º:201; 3º:202; 4º:203; 5º/8º:204; 6º/7º:205"],
  ["noite", "Ciências Contábeis", "2º:202; 4º/5º/6º/7º/8º:101; 3º:214; 5º:215; 7º:216"],
  ["noite", "Engenharia", "1º/2º:206; 3º/4º:208; 5º/6º:207; 7º/8º:209; 9º/10º:210"],
  ["noite", "Psicologia", "1º/2º:216; 3º/4º:215; 5º:212; 6º:211; 7º/8º:213; 9º/10º:214"],
  ["noite", "Engenharia de Software", "1º:107; 4ºB:102"],
  ["noite", "Saúde", "1º:104; 2º:103"],
  ["noite", "Escola de Tecnologia", "1º:106"],
  // NOITE · Prédio Sul
  ["noite", "Análise e Des. de Sistemas", "3º:303; 4º:301; 5º:305"],
  ["noite", "Engenharia de Software", "3º:304; 4ºA:302; 4ºC:301; 5º:305; 6ºA:306; 6ºB:307; 7º:308; 8º:309; 9º:310"],
  ["noite", "Sistemas de Informação", "3º:303; 4º:301; 5º:305; 6ºA:306; 7º:308; 8º:310"],
  ["noite", "Direito", "1º:402; 2º:403; 3º:404; 4º:405; 6ºA:401; 6ºB:406; 7º:407; 8ºA:408; 8ºB:409; 10º:410"],
  // NOITE · Prédio Central
  ["noite", "Análise e Des. de Sistemas / SI", "2º:501"],
  ["noite", "Engenharia de Software", "2ºA:502; 2ºB:tutorias"],
  ["noite", "Direito", "9º:hands-on"],
];

export interface Allocation {
  shift: Shift;
  course: string;
  period: string;
  roomId: string;
}

export const ALLOCATIONS: Allocation[] = RAW.flatMap(([shift, course, list]) =>
  list.split(";").map((pair) => {
    const i = pair.lastIndexOf(":");
    return { shift, course, period: pair.slice(0, i).trim(), roomId: pair.slice(i + 1).trim() };
  }),
);

export const COURSES = [...new Set(ALLOCATIONS.map((a) => a.course))].sort((a, b) => a.localeCompare(b, "pt-BR"));

export const allocationsOf = (roomId: string, shift?: Shift) =>
  ALLOCATIONS.filter((a) => a.roomId === roomId && (!shift || a.shift === shift));

/** Turnos (convenção usada no protótipo; faixa exata a confirmar com a UNDB). */
export function shiftAt(d: Date): Shift | null {
  const day = d.getDay();
  if (day === 0 || day === 6) return null; // o PDF não cobre fim de semana
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 7 && h < 12.5) return "manha";
  if (h >= 12.5 && h < 18.5) return "tarde";
  if (h >= 18.5 && h < 22.5) return "noite";
  return null;
}

export const describeAllocation = (a: Allocation) =>
  a.period === "Turma" ? a.course : `${a.course} · ${a.period.includes("º") ? `${a.period} período` : a.period}`;
