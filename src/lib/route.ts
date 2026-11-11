import { MAP, getBuilding, nearestOnPoly, seriesLabel, type BuildingId, type Layout, type Room } from "./campus";

/**
 * Rota do protótipo: linha reta do portão até a fachada mais próxima do
 * prédio, com distância real (escala da imagem de satélite). Os caminhos
 * internos do campus ainda não foram mapeados, então não desenhamos curvas
 * inventadas. Próximo passo: levantar as calçadas e montar o grafo.
 */
export interface RoutePlan {
  building: BuildingId;
  roomId?: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  meters: number;
  minutes: number;
  steps: string[];
}

const DIRS = ["norte", "nordeste", "leste", "sudeste", "sul", "sudoeste", "oeste", "noroeste"];

function compass(dx: number, dy: number) {
  const ang = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0 = norte (imagem com norte para cima)
  return DIRS[Math.round(((ang + 360) % 360) / 45) % 8];
}

export function planRoute(layout: Layout, building: BuildingId, room?: Room): RoutePlan {
  const from = layout.gate;
  const to = nearestOnPoly(getBuilding(building).poly, from);
  const meters = Math.round(Math.hypot(to.x - from.x, to.y - from.y) * MAP.metersPerPx);
  const b = getBuilding(building);
  const steps = [
    "Entre pelo portão da Av. Colares Moreira.",
    `Siga cerca de ${meters} m em direção ao ${compass(to.x - from.x, to.y - from.y)} até o ${b.name}.`,
  ];
  if (building === "tutorias") steps.push("A entrada da Ala das Tutorias é pelo Prédio Central.");
  if (room) {
    steps.push(
      /^\d00$/.test(room.series)
        ? `A ${room.label} faz parte das ${seriesLabel(room.series).toLowerCase()} deste prédio (o andar ainda será confirmado com a UNDB).`
        : `Procure por "${room.label}" na sinalização do prédio.`,
    );
  }
  return { building, roomId: room?.id, from, to, meters, minutes: Math.max(1, Math.round(meters / 70)), steps };
}
