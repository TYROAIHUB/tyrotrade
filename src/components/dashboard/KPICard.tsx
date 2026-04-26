import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassPanel } from "@/components/glass/GlassPanel";

export interface KPICardProps {
  label: string;
  value: string;
  sublabel?: string;
  icon: LucideIcon;
  iconTone?: "neutral" | "rose" | "orange" | "yellow" | "green" | "blue" | "purple";
  delta?: { value: string; positive: boolean; label?: string };
}

const TONE_COLORS: Record<NonNullable<KPICardProps["iconTone"]>, string> = {
  neutral: "bg-foreground/8 text-foreground",
  rose: "bg-rose-500/15 text-rose-700",
  orange: "bg-orange-500/15 text-orange-700",
  yellow: "bg-yellow-500/15 text-yellow-700",
  green: "bg-emerald-500/15 text-emerald-700",
  blue: "bg-sky-500/15 text-sky-700",
  purple: "bg-violet-500/15 text-violet-700",
};

export function KPICard({
  label,
  value,
  sublabel,
  icon: Icon,
  iconTone = "neutral",
  delta,
}: KPICardProps) {
  return (
    <GlassPanel tone="default" className="rounded-2xl">
      <div className="p-4 flex flex-col gap-2 h-full">
        <div className="flex items-start justify-between gap-2">
          <div
            className={cn(
              "size-10 shrink-0 rounded-xl grid place-items-center",
              TONE_COLORS[iconTone]
            )}
          >
            <Icon className="size-5" />
          </div>
          {delta && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full",
                delta.positive
                  ? "bg-emerald-500/12 text-emerald-700"
                  : "bg-rose-500/12 text-rose-700"
              )}
            >
              {delta.positive ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {delta.value}
            </span>
          )}
        </div>
        <div className="mt-1">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="text-2xl font-semibold leading-tight mt-0.5 tracking-tight">
            {value}
          </div>
          {sublabel && (
            <div className="text-[11px] text-muted-foreground mt-1">{sublabel}</div>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}
