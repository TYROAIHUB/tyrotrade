import { GlassPanel } from "@/components/glass/GlassPanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BentoGrid } from "@/components/dashboard/BentoGrid";
import { LeaderboardPanel } from "@/components/dashboard/LeaderboardPanel";
import { LeaderboardSegmentsPanel } from "@/components/dashboard/LeaderboardSegmentsPanel";
import { EventsPanel } from "@/components/dashboard/EventsPanel";
import {
  DashboardFilters,
  EMPTY_DASHBOARD_FILTERS,
  applyDashboardFilters,
  dashboardFilterCount,
  type DashboardFilterState,
} from "@/components/dashboard/DashboardFilters";
import * as React from "react";
import { useProjects } from "@/hooks/useProjects";
import { ProjectsEmptyState } from "@/components/projects/ProjectsEmptyState";
import { aggregatePipelineBuckets } from "@/lib/selectors/aggregate";
import { getFinancialYear } from "@/lib/dashboard/financialPeriod";

export function DashboardPage() {
  const now = new Date();
  const [filters, setFilters] = React.useState<DashboardFilterState>(
    EMPTY_DASHBOARD_FILTERS
  );

  // 🔒 Read-only — composes Project[] from cached Dataverse entities (real
  // mode) or returns mockProjects (mock mode). isEmpty cues the empty state
  // when the user hasn't run "Güncelle" yet.
  const { projects: rawProjects, isEmpty, fetchedAt } = useProjects();
  // No hard-coded ship-plan filter — every project flows in. The advanced
  // filter (`DashboardFilters`) carries the same `includeWithoutShipPlan`
  // toggle as the Projects page, so the user controls inclusion themselves.
  const allProjects = rawProjects;

  const projects = React.useMemo(
    () => applyDashboardFilters(allProjects, filters, now),
    // `now` recomputed every render but stable string-equal so we leave it
    // out of deps to avoid a render thrash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allProjects, filters]
  );
  const totalAvailable = allProjects.length;
  const activeFilterCount = dashboardFilterCount(filters);
  const totalProjects = projects.length;

  const buckets = aggregatePipelineBuckets(projects, now);
  const inTransit = buckets.inTransit;
  const loading = buckets.loading;
  const atDischarge = buckets.atDischarge;

  const greeting = getGreeting();
  const fy = getFinancialYear(now);
  const lastSyncLabel = fetchedAt ? formatSyncTime(fetchedAt) : null;

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
              {/* Subtitle: FY context + pipeline state breakdown (loading /
                  in-transit / at-discharge counts), active filter chip, and
                  last sync timestamp when in real mode. Empty stages are
                  skipped — only meaningful counts render so the line stays
                  short and scannable. */}
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {fy.fullLabel}
                </span>{" "}
                finansal döneminde{" "}
                <span className="font-semibold text-foreground">
                  {totalProjects} proje
                </span>{" "}
                izleniyor.
                {(inTransit > 0 || loading > 0 || atDischarge > 0) && (
                  <>
                    {" "}
                    {[
                      inTransit > 0 && `${inTransit} yolda`,
                      loading > 0 && `${loading} yüklemede`,
                      atDischarge > 0 && `${atDischarge} tahliyede`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    .
                  </>
                )}
                {activeFilterCount > 0 && (
                  <span className="ml-1.5 text-foreground/70">
                    · <span className="font-medium">{activeFilterCount}</span>{" "}
                    filtre aktif
                  </span>
                )}
                {lastSyncLabel && (
                  <span className="ml-1.5 text-muted-foreground/70">
                    · son senkron {lastSyncLabel}
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
          {/* Leaderboard reads from the same filtered project set as the
              bento — top-right Filtre is the single source of truth for
              the whole dashboard, no per-panel scope. */}
          <LeaderboardPanel projects={projects} />
          <EventsPanel projects={projects} now={now} />
        </div>

        {/* Segment-level leaderboard sits below the project-level one and
            shares the exact same filter scope — same metrics, but rolled
            up by `segment`. */}
        <LeaderboardSegmentsPanel projects={projects} />
      </div>
    </ScrollArea>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "İyi geceler";
  if (h < 12) return "Günaydın";
  if (h < 18) return "İyi günler";
  return "İyi akşamlar";
}

/** Compact "saat:dakika" if today, otherwise "dd.MM HH:mm". Used for the
 *  greeting subtitle's last-sync footnote — dense, scannable. */
function formatSyncTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (sameDay) return `${hh}:${mm}`;
  const dd = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mo} ${hh}:${mm}`;
}
