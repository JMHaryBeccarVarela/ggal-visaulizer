import type { ReactNode } from "react";

export type StrategyCategory =
  | "market-making"
  | "spreads"
  | "carry"
  | "microstructure"
  | "risk";

export interface Strategy {
  id: string;
  title: string;
  category: StrategyCategory;
  difficulty: "intro" | "intermedio" | "avanzado";
  /** Cuán crítica es para cumplir el programa NOR */
  norRelevance: "critica" | "alta" | "media";
  /** Frase única que resume la idea operativa */
  oneLiner: string;
  /** Descripción breve para el listado */
  shortDescription: string;
  /** Contenido en JSX (estructurado con <Section>) */
  content: ReactNode;
}

export const CATEGORY_LABELS: Record<StrategyCategory, string> = {
  "market-making": "Market making",
  spreads: "Spreads calendario",
  carry: "Carry & curva",
  microstructure: "Microestructura",
  risk: "Gestión y supervivencia",
};

export const DIFFICULTY_LABELS: Record<Strategy["difficulty"], string> = {
  intro: "Intro",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
};
