import { ArrowRight, Route } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTons } from "@/lib/format";
import { type Project } from "@/lib/dataverse/entities";
import { useThemeAccent } from "@/components/layout/theme-accent";

interface ProjectCardProps {
  project: Project;
  selected: boolean;
  onClick: () => void;
}

const STATUS_TONE: Record<
  string,
  { dot: string; ring: string; label: string }
> = {
  Commenced: {
    dot: "bg-amber-500",
    ring: "ring-amber-500/30",
    label: "text-amber-700",
  },
  Completed: {
    dot: "bg-emerald-500",
    ring: "ring-emerald-500/30",
    label: "text-emerald-700",
  },
  Open: {
    dot: "bg-sky-500",
    ring: "ring-sky-500/30",
    label: "text-sky-700",
  },
  Closed: {
    dot: "bg-slate-400",
    ring: "ring-slate-400/30",
    label: "text-slate-600",
  },
};

const FALLBACK_TONE = {
  dot: "bg-slate-400",
  ring: "ring-slate-400/30",
  label: "text-slate-600",
};

export function ProjectCard({ project, selected, onClick }: ProjectCardProps) {
  const accent = useThemeAccent();
  const totalKg = project.lines.reduce((s, l) => s + l.quantityKg, 0);
  // Use vessel voyage status when present; fall back to project Open/Closed.
  const status = project.vesselPlan?.vesselStatus ?? project.status;
  const tone = STATUS_TONE[status] ?? FALLBACK_TONE;
  const lp = project.vesselPlan?.loadingPort.name;
  const dp = project.vesselPlan?.dischargePort.name;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group relative w-full min-w-0 max-w-full text-left rounded-xl px-3 py-2.5 transition-all overflow-hidden",
        "border outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        selected
          ? "border-transparent"
          : "bg-card/40 border-border/60 hover:bg-card/70 hover:border-border"
      )}
      style={
        selected
          ? {
              boxShadow: `inset 0 0 0 1px ${accent.ring}`,
              backgroundColor: accent.tint,
            }
          : undefined
      }
    >
      {/* Selected — gradient mesh that fades inward from the left edge.
          Stays within ~28px so it doesn't bleed across the card surface. */}
      {selected && (
        <>
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-7 pointer-events-none"
            style={{
              background: `linear-gradient(90deg, ${accent.tint}, transparent)`,
            }}
          />
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-[3px] pointer-events-none"
            style={{ background: accent.gradient }}
          />
        </>
      )}

      {/* Row 1 — meta: status dot, project no, segment */}
      <div className="relative flex items-center gap-1.5 min-w-0 text-[11.5px]">
        <span
          className={cn(
            "size-2 rounded-full ring-2 shrink-0",
            tone.dot,
            tone.ring
          )}
          aria-hidden
        />
        <span className="font-mono text-muted-foreground tracking-tight truncate min-w-0">
          {project.projectNo}
        </span>
        {project.segment && (
          <>
            <span className="text-muted-foreground/80 shrink-0">·</span>
            <span className="text-muted-foreground/80 truncate min-w-0">
              {project.segment}
            </span>
          </>
        )}
      </div>

      {/* Row 2 — title (wraps up to 2 lines, then ellipsis) */}
      <h3 className="relative text-[14.5px] font-semibold leading-snug mt-1 line-clamp-2 break-words">
        {project.projectName}
      </h3>

      {/* Row 3 — route + tonage */}
      <div className="relative mt-1.5 flex items-center gap-1.5 min-w-0 text-[11.5px] text-muted-foreground">
        <Route
          className="size-3 shrink-0 opacity-60 text-muted-foreground"
          strokeWidth={2}
          aria-hidden
        />
        <span className="truncate min-w-0">{lp}</span>
        <ArrowRight className="size-3 shrink-0 opacity-50" />
        <span className="truncate min-w-0">{dp}</span>
        <span className="ml-auto font-medium text-foreground/85 tabular-nums shrink-0">
          {formatTons(totalKg)}t
        </span>
      </div>

      {/* Status caption — only shown when selected */}
      {selected && (
        <div className="relative mt-1.5 text-[10.5px] uppercase tracking-wider">
          <span className={cn("font-semibold", tone.label)}>{status}</span>
        </div>
      )}
    </button>
  );
}
