import { useMemo, useState } from "react";
import { STRATEGIES } from "../strategies/registry";
import {
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  type Strategy,
  type StrategyCategory,
} from "../strategies/types";

const CATEGORY_ORDER: StrategyCategory[] = [
  "risk",
  "market-making",
  "spreads",
  "carry",
  "microstructure",
];

function NorBadge({ rel }: { rel: Strategy["norRelevance"] }) {
  if (rel === "critica")
    return <span className="pill bg-bear-bg text-bear">Crítico NOR</span>;
  if (rel === "alta")
    return <span className="pill bg-accent/15 text-accent">Alto NOR</span>;
  return <span className="pill-neutral">NOR medio</span>;
}

function DifficultyBadge({ d }: { d: Strategy["difficulty"] }) {
  const cls =
    d === "intro"
      ? "pill-neutral"
      : d === "intermedio"
        ? "pill bg-accent/10 text-accent"
        : "pill bg-bear/10 text-bear";
  return <span className={cls}>{DIFFICULTY_LABELS[d]}</span>;
}

function StrategyListItem({
  s,
  selected,
  onClick,
}: {
  s: Strategy;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-md transition-colors border ${
        selected
          ? "bg-bg-elev border-accent/40"
          : "bg-transparent border-transparent hover:bg-bg-hover/60 hover:border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold leading-tight">{s.title}</div>
        {s.norRelevance === "critica" && (
          <span className="w-1.5 h-1.5 rounded-full bg-bear shrink-0 mt-1" />
        )}
      </div>
      <div className="text-xs text-text-muted mt-1 leading-snug">
        {s.shortDescription}
      </div>
    </button>
  );
}

function StrategyReader({ s }: { s: Strategy }) {
  return (
    <article>
      <header className="mb-5 pb-4 border-b border-border">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="pill-neutral">
            {CATEGORY_LABELS[s.category]}
          </span>
          <DifficultyBadge d={s.difficulty} />
          <NorBadge rel={s.norRelevance} />
        </div>
        <h2 className="text-xl font-semibold text-text">{s.title}</h2>
        <p className="text-sm text-text-muted italic mt-2">{s.oneLiner}</p>
      </header>
      <div className="pb-4">{s.content}</div>
    </article>
  );
}

function Welcome() {
  return (
    <div className="py-10 px-4 text-center">
      <div className="text-text-muted text-sm mb-3">
        Seleccioná una estrategia del listado para abrirla.
      </div>
      <div className="text-xs text-text-dim max-w-md mx-auto leading-relaxed">
        Las estrategias están ordenadas por prioridad: primero{" "}
        <strong>gestión de riesgo</strong> (sin esto, lo demás es irrelevante),
        después <strong>market making</strong> y{" "}
        <strong>spreads</strong> que mejoran tu ratio AA, y al final{" "}
        <strong>microestructura</strong> para cuando ya tenés disciplina.
      </div>
    </div>
  );
}

export function StrategyLibrary() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => STRATEGIES.find((s) => s.id === selectedId) ?? null,
    [selectedId],
  );

  const grouped = useMemo(() => {
    const m = new Map<StrategyCategory, Strategy[]>();
    for (const s of STRATEGIES) {
      const arr = m.get(s.category) ?? [];
      arr.push(s);
      m.set(s.category, arr);
    }
    return CATEGORY_ORDER.filter((c) => m.has(c)).map((c) => ({
      category: c,
      items: m.get(c)!,
    }));
  }, []);

  return (
    <div className="panel">
      <div className="panel-title">
        <span>
          Biblioteca · Estrategias para NOR DLR{" "}
          <span className="text-text-dim normal-case font-normal">
            ({STRATEGIES.length} estrategias)
          </span>
        </span>
        {selected && (
          <button
            className="btn text-xs"
            onClick={() => setSelectedId(null)}
            title="Volver al listado"
          >
            Cerrar
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] lg:divide-x divide-border max-h-[640px]">
        <aside className="p-3 space-y-4 overflow-y-auto max-h-[640px]">
          {grouped.map((g) => (
            <div key={g.category}>
              <div className="text-[10px] uppercase tracking-wider text-text-dim px-2 mb-1.5">
                {CATEGORY_LABELS[g.category]}
              </div>
              <div className="space-y-1">
                {g.items.map((s) => (
                  <StrategyListItem
                    key={s.id}
                    s={s}
                    selected={selectedId === s.id}
                    onClick={() => setSelectedId(s.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </aside>
        <main className="p-6 overflow-y-auto max-h-[640px]">
          {selected ? <StrategyReader s={selected} /> : <Welcome />}
        </main>
      </div>
    </div>
  );
}
