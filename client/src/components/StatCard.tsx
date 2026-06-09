interface Props {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "bull" | "bear" | "accent";
}

const toneClass: Record<NonNullable<Props["tone"]>, string> = {
  default: "text-text",
  bull: "text-bull",
  bear: "text-bear",
  accent: "text-accent",
};

export function StatCard({ label, value, sub, tone = "default" }: Props) {
  return (
    <div className="panel px-4 py-3 flex-1 min-w-[140px]">
      <div className="text-[10px] uppercase tracking-wider text-text-muted">
        {label}
      </div>
      <div className={`mt-1 text-xl font-mono font-semibold ${toneClass[tone]}`}>
        {value}
      </div>
      {sub && (
        <div className="text-xs text-text-muted mt-0.5 num">{sub}</div>
      )}
    </div>
  );
}
