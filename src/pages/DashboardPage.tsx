import { GlassPanel } from "@/components/glass/GlassPanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BentoGrid } from "@/components/dashboard/BentoGrid";
import { LeaderboardPanel } from "@/components/dashboard/LeaderboardPanel";
import { LeaderboardSegmentsPanel } from "@/components/dashboard/LeaderboardSegmentsPanel";
import { EventsPanel } from "@/components/dashboard/EventsPanel";
import { AdvancedFilter } from "@/components/filters/AdvancedFilter";
import {
  KpiDetailDrawer,
  type KpiId,
} from "@/components/dashboard/KpiDetailDrawer";
import {
  ExpenseBreakdown,
  PipelineBreakdown,
  CurrencyBreakdown,
  CorridorBreakdown,
  VelocityBreakdown,
  CounterpartyBreakdown,
  PeriodPerformanceBreakdown,
  EstimatedPLBreakdown,
  QuantityBreakdown,
} from "@/components/dashboard/kpiBreakdowns";
import {
  TONE_FORECAST,
  TONE_PL,
  TONE_CARGO,
  TONE_EXPENSE,
  TONE_SEA,
  TONE_CURRENCY,
  TONE_CORRIDOR,
  TONE_VELOCITY,
  TONE_COUNTERPARTY,
  type IconBadgeTone,
} from "@/components/details/AccentIconBadge";
import type { IconSvgElement } from "@hugeicons/react";
import {
  ChartLineData01Icon,
  Coins02Icon,
  WeightScale01Icon,
  Wallet01Icon,
  ContainerIcon,
  MoneyExchange01Icon,
  Route01Icon,
  Clock01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import {
  applyProjectFilter,
  makeEmptyFilters,
  projectFilterCount,
  type ProjectFilterState,
} from "@/lib/filters/projectFilters";
import * as React from "react";
import { useProjects } from "@/hooks/useProjects";
import { ProjectsEmptyState } from "@/components/projects/ProjectsEmptyState";
import { aggregatePipelineBuckets } from "@/lib/selectors/aggregate";
import { getFinancialYear } from "@/lib/dashboard/financialPeriod";
import type { Project } from "@/lib/dataverse/entities";

// Dashboard default = inclusive (all projects flow into KPIs unless
// the user explicitly toggles ship-plan-only). Vessel Projects uses
// the opposite default — both are passed to the unified filter via
// `makeEmptyFilters({ includeWithoutShipPlan })`.
const DASHBOARD_SHIP_PLAN_DEFAULT = true;

export function DashboardPage() {
  const now = new Date();
  const [filters, setFilters] = React.useState<ProjectFilterState>(() =>
    makeEmptyFilters({ includeWithoutShipPlan: DASHBOARD_SHIP_PLAN_DEFAULT })
  );
  // Active KPI drawer — `null` when no tile is open. Each click on a
  // BentoGrid tile fires `onSelectKpi(id)` and we render the matching
  // breakdown component inside the shared KpiDetailDrawer chrome.
  const [drawerKpi, setDrawerKpi] = React.useState<KpiId | null>(null);
  const closeDrawer = React.useCallback(() => setDrawerKpi(null), []);

  // 🔒 Read-only — composes Project[] from cached Dataverse entities (real
  // mode) or returns mockProjects (mock mode). isEmpty cues the empty state
  // when the user hasn't run "Güncelle" yet.
  const { projects: rawProjects, isEmpty, fetchedAt } = useProjects();
  const allProjects = rawProjects;

  const projects = React.useMemo(
    () => applyProjectFilter(allProjects, filters, now),
    // `now` recomputed every render but stable string-equal so we leave it
    // out of deps to avoid a render thrash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allProjects, filters]
  );
  const totalAvailable = allProjects.length;
  const activeFilterCount = projectFilterCount(
    filters,
    DASHBOARD_SHIP_PLAN_DEFAULT
  );
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
            <AdvancedFilter
              projects={allProjects}
              filters={filters}
              onChange={setFilters}
              shipPlanDefault={DASHBOARD_SHIP_PLAN_DEFAULT}
              resultCount={projects.length}
              totalCount={totalAvailable}
            />
          </div>
        </GlassPanel>

        <BentoGrid
          projects={projects}
          now={now}
          onSelectKpi={setDrawerKpi}
        />

        {/* Bottom 12-col grid: Kral Projeler + Kral Segmentler stacked
            in the left 9 cols (matches BentoGrid's wider tiles above);
            Olaylar fills the right 3 cols and stretches the full
            stack height — same width as Counterparty in the bento row
            above so columns align vertically across the page. */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
          <div className="xl:col-span-9 flex flex-col gap-3 min-w-0">
            <LeaderboardPanel projects={projects} />
            <LeaderboardSegmentsPanel projects={projects} />
          </div>
          <div className="xl:col-span-3 min-w-0">
            <EventsPanel projects={projects} now={now} />
          </div>
        </div>
      </div>

      {/* KPI detail drawer — renders the breakdown component matching
          the active tile id. The drawer keeps mounted across switches
          so the slide-in animation only plays on first open; switching
          KPI IDs swaps the children content in-place. */}
      <KpiDetailDrawer
        open={drawerKpi !== null}
        onOpenChange={(open) => !open && closeDrawer()}
        title={drawerKpi ? KPI_META[drawerKpi].title : ""}
        subtitle={
          drawerKpi
            ? KPI_META[drawerKpi].subtitle?.(projects)
            : undefined
        }
        icon={drawerKpi ? KPI_META[drawerKpi].icon : undefined}
        iconTone={drawerKpi ? KPI_META[drawerKpi].tone : undefined}
      >
        {drawerKpi === "period" && (
          <PeriodPerformanceBreakdown projects={projects} onClose={closeDrawer} now={now} />
        )}
        {drawerKpi === "pl" && (
          <EstimatedPLBreakdown projects={projects} onClose={closeDrawer} />
        )}
        {drawerKpi === "quantity" && (
          <QuantityBreakdown projects={projects} onClose={closeDrawer} />
        )}
        {drawerKpi === "expense" && (
          <ExpenseBreakdown projects={projects} onClose={closeDrawer} />
        )}
        {drawerKpi === "pipeline" && (
          <PipelineBreakdown projects={projects} onClose={closeDrawer} />
        )}
        {drawerKpi === "currency" && (
          <CurrencyBreakdown projects={projects} onClose={closeDrawer} />
        )}
        {drawerKpi === "corridor" && (
          <CorridorBreakdown projects={projects} onClose={closeDrawer} />
        )}
        {drawerKpi === "velocity" && (
          <VelocityBreakdown projects={projects} onClose={closeDrawer} now={now} />
        )}
        {drawerKpi === "counterparty" && (
          <CounterpartyBreakdown projects={projects} onClose={closeDrawer} />
        )}
      </KpiDetailDrawer>
    </ScrollArea>
  );
}

/* ─────────── KPI metadata ─────────── */

interface KpiMeta {
  title: string;
  /** Subtitle factory — receives the filtered project set so it can
   *  surface a count or context fragment that matches the data the
   *  drawer is about to render. */
  subtitle?: (projects: Project[]) => string;
  icon: IconSvgElement;
  tone: IconBadgeTone;
}

const KPI_META: Record<KpiId, KpiMeta> = {
  period: {
    title: "Dönem Performansı",
    subtitle: (p) => `${p.length} proje · finansal görünüm`,
    icon: ChartLineData01Icon,
    tone: TONE_FORECAST,
  },
  pl: {
    title: "Tahmini Kâr & Zarar",
    subtitle: (p) => `${p.length} proje · USD eşdeğeri`,
    icon: Coins02Icon,
    tone: TONE_PL,
  },
  quantity: {
    title: "Tahmini Miktar",
    subtitle: (p) => `${p.length} proje · toplam tonaj dağılımı`,
    icon: WeightScale01Icon,
    tone: TONE_CARGO,
  },
  expense: {
    title: "Tahmini Gider",
    subtitle: (p) => `${p.length} proje · USD bazlı kalemler`,
    icon: Wallet01Icon,
    tone: TONE_EXPENSE,
  },
  pipeline: {
    title: "Aktif Pipeline",
    subtitle: (p) => `${p.length} proje · sefer durumuna göre`,
    icon: ContainerIcon,
    tone: TONE_SEA,
  },
  currency: {
    title: "Para Birimi Maruziyeti",
    subtitle: (p) => `${p.length} proje · USD / EUR / TRY`,
    icon: MoneyExchange01Icon,
    tone: TONE_CURRENCY,
  },
  corridor: {
    title: "Koridor Konsantrasyonu",
    subtitle: (p) => `${p.length} proje · LP → DP dağılımı`,
    icon: Route01Icon,
    tone: TONE_CORRIDOR,
  },
  velocity: {
    title: "Ortalama Transit",
    subtitle: (p) => `${p.length} proje · LP-(ED) → DP-ETA`,
    icon: Clock01Icon,
    tone: TONE_VELOCITY,
  },
  counterparty: {
    title: "Karşı Taraf Dağılımı",
    subtitle: (p) => `${p.length} proje · tedarikçi & alıcı`,
    icon: UserGroupIcon,
    tone: TONE_COUNTERPARTY,
  },
};

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
