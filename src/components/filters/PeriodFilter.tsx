import * as React from "react";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { useThemeAccent } from "@/components/layout/theme-accent";
import {
  PERIODS,
  type PeriodKey,
} from "@/lib/dashboard/periods";
import {
  getCurrentFyKey,
  lastNFinancialYears,
} from "@/lib/dashboard/financialPeriod";
import { cn } from "@/lib/utils";

interface PeriodFilterProps {
  period: PeriodKey;
  fyKey: string | null;
  onChange: (period: PeriodKey, fyKey: string | null) => void;
  /** Optional title above the chips. Hidden when omitted. */
  title?: string;
  className?: string;
  /** "compact" drops the title + tightens spacing for inline use
   *  next to a page header. Default = "default" with eyebrow title. */
  variant?: "default" | "compact";
}

/**
 * Top-of-page period selector — Aylık · Çeyreklik · Yıllık · Finansal
 * Dönem · Tüm Zamanlar. When `fy` is active, a second row reveals the
 * last 3 financial year chips so the user can scrub between them.
 *
 * Theme-aware via `useThemeAccent` — active chip uses accent.tint /
 * accent.solid / accent.ring so it matches the rest of the dashboard.
 */
export function PeriodFilter({
  period,
  fyKey,
  onChange,
  title = "Dönem",
  className,
  variant = "default",
}: PeriodFilterProps) {
  const accent = useThemeAccent();
  const fyOptions = React.useMemo(() => lastNFinancialYears(new Date(), 3), []);
  const showFyOptions = period === "fy";

  const chipClass = cn(
    "h-7 rounded-full text-[11.5px] px-2.5 font-medium",
    "border-foreground/15 bg-transparent",
    "hover:bg-foreground/[0.04] hover:border-foreground/25",
    "data-[state=on]:bg-[var(--filter-active-bg)]",
    "data-[state=on]:text-[var(--filter-active-fg)]",
    "data-[state=on]:border-[var(--filter-active-border)]",
    "data-[state=on]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4)]",
    "data-[state=on]:font-semibold",
    "transition-colors"
  );

  return (
    <div
      className={cn(
        variant === "default" ? "flex flex-col gap-1.5" : "flex flex-col gap-1",
        className
      )}
      style={
        {
          "--filter-active-bg": accent.tint,
          "--filter-active-fg": accent.solid,
          "--filter-active-border": accent.ring,
        } as React.CSSProperties
      }
    >
      {variant === "default" && title && (
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </div>
      )}
      <ToggleGroup
        type="single"
        value={period}
        onValueChange={(v) => {
          if (!v) return;
          const next = v as PeriodKey;
          // Switching to fy → seed with current FY when no key is set.
          const nextFy = next === "fy" ? fyKey ?? getCurrentFyKey() : null;
          onChange(next, nextFy);
        }}
        variant="outline"
        size="sm"
        spacing={4}
        className="flex-wrap"
      >
        {PERIODS.map((p) => (
          <ToggleGroupItem key={p.key} value={p.key} className={chipClass}>
            {p.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {showFyOptions && (
        <div className="mt-1.5">
          {variant === "default" && (
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
              Finansal Yıl
            </div>
          )}
          <ToggleGroup
            type="single"
            value={fyKey ?? getCurrentFyKey()}
            onValueChange={(v) => {
              if (!v) return;
              onChange("fy", v);
            }}
            variant="outline"
            size="sm"
            spacing={4}
            className="flex-wrap"
          >
            {fyOptions.map((fy) => (
              <ToggleGroupItem key={fy.key} value={fy.key} className={chipClass}>
                {fy.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}
    </div>
  );
}
