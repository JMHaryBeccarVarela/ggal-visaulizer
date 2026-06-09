import type { ReactNode } from "react";

type Tone = "default" | "insight" | "warn" | "danger" | "neutral";

const BORDER: Record<Tone, string> = {
  default: "border-border",
  insight: "border-bull/60",
  warn: "border-accent/60",
  danger: "border-bear/60",
  neutral: "border-text-dim/50",
};

const TAG_BG: Record<Tone, string> = {
  default: "text-text-muted",
  insight: "text-bull",
  warn: "text-accent",
  danger: "text-bear",
  neutral: "text-text-muted",
};

export function Section({
  title,
  tone = "default",
  children,
}: {
  title: string;
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <section className={`border-l-2 ${BORDER[tone]} pl-4 mb-5`}>
      <h3
        className={`text-[10px] uppercase tracking-wider font-semibold mb-2 ${TAG_BG[tone]}`}
      >
        {title}
      </h3>
      <div className="text-sm leading-relaxed text-text space-y-2">
        {children}
      </div>
    </section>
  );
}

export function Callout({
  title,
  tone = "neutral",
  children,
}: {
  title?: string;
  tone?: Tone;
  children: ReactNode;
}) {
  const bg: Record<Tone, string> = {
    default: "bg-bg-elev/60",
    insight: "bg-bull-bg",
    warn: "bg-accent/10",
    danger: "bg-bear-bg",
    neutral: "bg-bg-elev/60",
  };
  return (
    <div
      className={`rounded-md border ${BORDER[tone]} ${bg[tone]} px-3 py-2 my-2`}
    >
      {title && (
        <div
          className={`text-[10px] uppercase tracking-wider font-semibold mb-1 ${TAG_BG[tone]}`}
        >
          {title}
        </div>
      )}
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[13px] bg-bg-elev px-1.5 py-0.5 rounded text-text">
      {children}
    </span>
  );
}

export function Checks({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 mt-1">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-bull select-none">✓</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function Crosses({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 mt-1">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-bear select-none">✗</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}
