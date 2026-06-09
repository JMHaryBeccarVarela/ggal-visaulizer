import { marketMaking } from "./content/MarketMaking";
import { calendarSpread } from "./content/CalendarSpread";
import { carryLecap } from "./content/CarryLecap";
import { scalpingAbsorption } from "./content/ScalpingAbsorption";
import { sizingSurvival } from "./content/SizingSurvival";
import type { Strategy } from "./types";

export const STRATEGIES: Strategy[] = [
  // Riesgo primero — sin esto, lo demás no importa
  sizingSurvival,
  // Las que generan valor en el ratio AA
  marketMaking,
  calendarSpread,
  carryLecap,
  // Microestructura para cuando ya hay disciplina
  scalpingAbsorption,
];
