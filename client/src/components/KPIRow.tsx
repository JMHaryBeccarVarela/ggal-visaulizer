import { useMarket } from "../store/market";
import { fmtInt, fmtPrice, shortSymbol } from "../lib/format";
import { StatCard } from "./StatCard";

export function KPIRow() {
  const contracts = useMarket((s) => s.contracts);
  const order = useMarket((s) => s.order);
  const spot = useMarket((s) => s.spot);

  const list = order.map((s) => contracts[s]).filter(Boolean);
  const total = list.length;
  const withQuotes = list.filter((c) => c!.bid !== null || c!.ask !== null).length;
  const totalVolume = list.reduce((acc, c) => acc + (c!.volume ?? 0), 0);
  const totalOI = list.reduce((acc, c) => acc + (c!.openInterest ?? 0), 0);

  const front = list.find((c) => c!.last || c!.mid || c!.settlement);
  const frontPx = front ? (front.last ?? front.mid ?? front.settlement) : null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        label="Contratos activos"
        value={`${withQuotes}/${total}`}
        sub="con punta"
      />
      <StatCard
        label="Spot referencia"
        value={spot ? fmtPrice(spot) : "—"}
        sub="USD/ARS mayorista (A3500)"
        tone="accent"
      />
      <StatCard
        label="Front month"
        value={frontPx ? fmtPrice(frontPx) : "—"}
        sub={front ? `${shortSymbol(front.symbol)} · ${front.daysToMaturity}d` : "—"}
      />
      <StatCard
        label="Volumen / OI total"
        value={fmtInt(totalVolume)}
        sub={`OI ${fmtInt(totalOI)}`}
      />
    </div>
  );
}
