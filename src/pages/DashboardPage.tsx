import { CircleCheck, Clock } from "lucide-react";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BentoGrid } from "@/components/dashboard/BentoGrid";
import { KingProjectsPanel } from "@/components/dashboard/KingProjectsPanel";
import {
  DashboardFilters,
  EMPTY_DASHBOARD_FILTERS,
  applyDashboardFilters,
  dashboardFilterCount,
  type DashboardFilterState,
} from "@/components/dashboard/DashboardFilters";
import * as React from "react";
import { formatDate } from "@/lib/format";
import { useProjects } from "@/hooks/useProjects";
import { ProjectsEmptyState } from "@/components/projects/ProjectsEmptyState";
import { aggregatePipelineBuckets } from "@/lib/selectors/aggregate";
import { cn } from "@/lib/utils";
import type { Project, VesselMilestones } from "@/lib/dataverse/entities";

export function DashboardPage() {
  const now = new Date();
  const [filters, setFilters] = React.useState<DashboardFilterState>(
    EMPTY_DASHBOARD_FILTERS
  );

  // 🔒 Read-only — composes Project[] from cached Dataverse entities (real
  // mode) or returns mockProjects (mock mode). isEmpty cues the empty state
  // when the user hasn't run "Güncelle" yet.
  const { projects: rawProjects, isEmpty } = useProjects();
  // No hard-coded ship-plan filter — every project flows in. The advanced
  // filter (`DashboardFilters`) carries the same `includeWithoutShipPlan`
  // toggle as the Projects page, so the user controls inclusion themselves.
  const allProjects = rawProjects;

  const projects = React.useMemo(
    () => applyDashboardFilters(allProjects, filters),
    [allProjects, filters]
  );
  const totalAvailable = allProjects.length;
  const activeFilterCount = dashboardFilterCount(filters);
  const totalProjects = projects.length;

  const buckets = aggregatePipelineBuckets(projects, now);
  const inTransit = buckets.inTransit;
  const loading = buckets.loading;

  const activity = buildActivityFeed(projects, now);

  const greeting = getGreeting();

  if (isEmpty) {
    return <ProjectsEmptyState />;
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 pb-3">
        <GlassPanel tone="default" className="rounded-2xl">
          <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {new Intl.DateTimeFormat("tr-TR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(now)}
              </div>
              <h2 className="text-xl font-semibold tracking-tight">
                {greeting}, Cenk
              </h2>
              <p className="text-sm text-muted-foreground">
                Bugün <span className="font-medium text-foreground">{totalProjects} aktif proje</span>{" "}
                izleniyor. {inTransit > 0 && `${inTransit} yolda, `}
                {loading > 0 && `${loading} yüklemede.`}
                {activeFilterCount > 0 && (
                  <span className="ml-1 text-foreground/70">
                    · {activeFilterCount} filtre aktif
                  </span>
                )}
              </p>
            </div>
            <DashboardFilters
              projects={allProjects}
              filters={filters}
              onChange={setFilters}
              resultCount={projects.length}
              totalCount={totalAvailable}
            />
          </div>
        </GlassPanel>

        <BentoGrid projects={projects} now={now} />

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-3">
          {/* KingProjects ranks by invoiced sales — pass the unfiltered
              project list so older big earners (without ship plans) still
              appear. The hasUsableShipPlan + dashboard filters are aimed at
              the operational tiles, not the leaderboard. */}
          <KingProjectsPanel projects={rawProjects} />
          <ActivityPanel activity={activity} />
        </div>
      </div>
    </ScrollArea>
  );
}

interface ActivityEvent {
  projectNo: string;
  vesselName: string;
  label: string;
  date: Date;
  kind: "done" | "upcoming";
}

function buildActivityFeed(projects: Project[], now: Date): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (const p of projects) {
    const vp = p.vesselPlan;
    if (!vp) continue;
    const ms = vp.milestones;
    const list: Array<[keyof VesselMilestones, string]> = [
      ["lpEta", "Yükleme limanına varış (LP-ETA)"],
      ["lpNorAccepted", "LP-NOR Kabul"],
      ["lpSd", "Yükleme başladı"],
      ["lpEd", "Yükleme tamamlandı"],
      ["blDate", "Bill of Lading düzenlendi"],
      ["dpEta", "Varış limanına ulaşma (DP-ETA)"],
      ["dpNorAccepted", "DP-NOR Kabul"],
      ["dpSd", "Tahliye başladı (DP-SD)"],
      ["dpEd", "Tahliye tamamlandı (DP-ED)"],
    ];
    for (const [key, label] of list) {
      const iso = ms[key];
      if (!iso) continue;
      const d = new Date(iso);
      events.push({
        projectNo: p.projectNo,
        vesselName: vp.vesselName,
        label,
        date: d,
        kind: d.getTime() <= now.getTime() ? "done" : "upcoming",
      });
    }
  }
  events.sort((a, b) => b.date.getTime() - a.date.getTime());
  return events.slice(0, 12);
}

function ActivityPanel({ activity }: { activity: ActivityEvent[] }) {
  return (
    <GlassPanel tone="default" className="rounded-2xl">
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-sm font-semibold">Son Olaylar</h3>
        <p className="text-[11px] text-muted-foreground">
          Tüm projeler boyunca milestone akışı
        </p>
      </div>
      <div className="px-4 pb-4">
        <ol className="space-y-2.5">
          {activity.map((e, i) => (
            <li key={i} className="flex gap-2.5">
              <div className="shrink-0 mt-0.5">
                {e.kind === "done" ? (
                  <span className="size-6 rounded-full bg-emerald-500/15 text-emerald-700 grid place-items-center">
                    <CircleCheck className="size-3.5" />
                  </span>
                ) : (
                  <span className="size-6 rounded-full bg-muted text-muted-foreground grid place-items-center">
                    <Clock className="size-3.5" />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    "text-xs leading-snug",
                    e.kind === "done" ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {e.label}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  <span className="font-mono">{e.projectNo}</span> ·{" "}
                  {e.vesselName} · {formatDate(e.date.toISOString())}
                </div>
              </div>
            </li>
          ))}
          {activity.length === 0 && (
            <li className="text-xs text-muted-foreground text-center py-6">
              Henüz milestone yok
            </li>
          )}
        </ol>
      </div>
    </GlassPanel>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "İyi geceler";
  if (h < 12) return "Günaydın";
  if (h < 18) return "İyi günler";
  return "İyi akşamlar";
}
