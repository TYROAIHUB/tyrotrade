import { Check, Anchor, FileCheck, Ship as ShipIcon, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { formatDate } from "@/lib/format";
import type { Project, VesselMilestones } from "@/lib/dataverse/entities";

interface Props {
  project: Project;
}

interface Step {
  key: keyof VesselMilestones;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: "loading" | "transit" | "discharge";
}

const STEPS: Step[] = [
  { key: "lpEta", label: "LP-ETA Yükleme Limanı Varış", icon: Anchor, group: "loading" },
  { key: "lpNorAccepted", label: "LP-NOR Kabul", icon: FileCheck, group: "loading" },
  { key: "lpSd", label: "Yükleme Başlangıç", icon: ShipIcon, group: "loading" },
  { key: "lpEd", label: "Yükleme Bitiş", icon: Check, group: "loading" },
  { key: "blDate", label: "Bill of Lading", icon: FileCheck, group: "transit" },
  { key: "dpEta", label: "DP-ETA Varış Limanı", icon: Anchor, group: "discharge" },
  { key: "dpNorAccepted", label: "DP-NOR Kabul", icon: FileCheck, group: "discharge" },
  { key: "dpSd", label: "Tahliye Başlangıç", icon: ShipIcon, group: "discharge" },
  { key: "dpEd", label: "Tahliye Bitiş", icon: Check, group: "discharge" },
];

export function RouteTimeline({ project }: Props) {
  const ms = project.vesselPlan?.milestones;
  if (!ms) return null;

  const lp = project.vesselPlan?.loadingPort;
  const dp = project.vesselPlan?.dischargePort;

  return (
    <GlassPanel tone="default" className="rounded-2xl">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Rota İlerlemesi</h3>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 min-w-0">
            <span className="truncate max-w-[100px]">{lp?.name}</span>
            <ChevronRight className="size-3 shrink-0" />
            <span className="truncate max-w-[100px]">{dp?.name}</span>
          </div>
        </div>

        <ol className="relative">
          {STEPS.map((step, i) => {
            const date = ms[step.key];
            const done = !!date;
            const next = STEPS[i + 1];
            const isCurrent = done && (!next || !ms[next.key]);
            const Icon = step.icon;

            return (
              <li key={step.key} className="flex gap-3 relative pb-3 last:pb-0">
                <div className="flex flex-col items-center shrink-0">
                  <div
                    className={cn(
                      "size-7 rounded-full grid place-items-center transition-colors shrink-0 z-[1]",
                      done
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted/70 text-muted-foreground border border-border"
                    )}
                  >
                    <Icon className="size-3.5" />
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={cn(
                        "w-px flex-1 mt-1 mb-1",
                        done ? "bg-primary/40" : "bg-border"
                      )}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1 pb-1">
                  <div
                    className={cn(
                      "text-xs font-medium leading-tight",
                      !done && "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                    <span>{formatDate(date)}</span>
                    {isCurrent && (
                      <span className="inline-flex items-center gap-1 text-primary font-medium">
                        <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                        Şu an
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </GlassPanel>
  );
}
