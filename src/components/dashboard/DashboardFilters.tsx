import * as React from "react";
import { Search } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  FilterHorizontalIcon,
  FilterResetIcon,
  FilterIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { hasUsableShipPlan } from "@/lib/selectors/project";
import {
  applyPeriodFilter,
  DEFAULT_PERIOD,
  PERIODS,
  type PeriodKey,
} from "@/lib/dashboard/periods";
import {
  getCurrentFyKey,
  lastNFinancialYears,
} from "@/lib/dashboard/financialPeriod";
import type { Project } from "@/lib/dataverse/entities";

export interface DashboardFilterState {
  statuses: Set<string>;
  groups: Set<string>;
  segments: Set<string>;
  incoterms: Set<string>;
  /** Vessel-plan voyage status — Commenced or Completed only. */
  voyageStatuses: Set<string>;
  /** When false, projects without `vesselPlan` are hidden. Default true. */
  includeWithoutShipPlan: boolean;
  /** Time-window selector — default = current financial year. */
  period: PeriodKey;
  /** When `period === "fy"`, which FY ("25-26"). Null → current FY. */
  fyKey: string | null;
}

export const EMPTY_DASHBOARD_FILTERS: DashboardFilterState = {
  statuses: new Set(),
  groups: new Set(),
  segments: new Set(),
  incoterms: new Set(),
  voyageStatuses: new Set(),
  // Dashboard default = inclusive — user can scope down with the toggle.
  includeWithoutShipPlan: true,
  // Default period = current financial year (Tiryaki convention).
  period: DEFAULT_PERIOD,
  fyKey: getCurrentFyKey(),
};

/**
 * Apply filter state to a list of projects. Period filter is applied first
 * (cheapest cull), then categorical filters layer on top.
 */
export function applyDashboardFilters(
  projects: Project[],
  f: DashboardFilterState,
  now: Date = new Date()
): Project[] {
  const periodFiltered = applyPeriodFilter(projects, f.period, f.fyKey, now);
  return periodFiltered.filter((p) => {
    if (!f.includeWithoutShipPlan && !hasUsableShipPlan(p)) return false;
    if (f.voyageStatuses.size > 0) {
      const vs = p.vesselPlan?.vesselStatus ?? "";
      if (!f.voyageStatuses.has(vs)) return false;
    }
    if (f.statuses.size > 0 && !f.statuses.has(p.status)) return false;
    if (f.groups.size > 0 && !f.groups.has(p.projectGroup)) return false;
    if (f.segments.size > 0) {
      if (!p.segment || !f.segments.has(p.segment)) return false;
    }
    if (f.incoterms.size > 0 && !f.incoterms.has(p.incoterm)) return false;
    return true;
  });
}

/** Active-filter chip count. Default period (fy + currentFy) doesn't count;
 *  any deviation from default does. */
export function dashboardFilterCount(f: DashboardFilterState): number {
  const periodActive =
    f.period !== DEFAULT_PERIOD ||
    (f.period === "fy" && f.fyKey !== null && f.fyKey !== getCurrentFyKey());
  return (
    f.statuses.size +
    f.groups.size +
    f.segments.size +
    f.incoterms.size +
    f.voyageStatuses.size +
    (f.includeWithoutShipPlan ? 0 : 1) +
    (periodActive ? 1 : 0)
  );
}

interface DashboardFiltersProps {
  projects: Project[];
  filters: DashboardFilterState;
  onChange: (next: DashboardFilterState) => void;
  /** Number of projects after filters applied — shown in footer. */
  resultCount?: number;
  /** Total before filters — shown in footer. */
  totalCount?: number;
  className?: string;
}

export function DashboardFilters({
  projects,
  filters,
  onChange,
  resultCount,
  totalCount,
  className,
}: DashboardFiltersProps) {
  const accent = useThemeAccent();
  const activeCount = dashboardFilterCount(filters);
  const hasFilters = activeCount > 0;

  const { statuses, groups, segments, incoterms, voyageStatuses } =
    React.useMemo(() => {
      const s = new Set<string>();
      const g = new Set<string>();
      const seg = new Set<string>();
      const i = new Set<string>();
      const vs = new Set<string>();
      for (const p of projects) {
        if (p.status) s.add(p.status);
        if (p.projectGroup) g.add(p.projectGroup);
        if (p.segment) seg.add(p.segment);
        if (p.incoterm) i.add(p.incoterm);
        if (p.vesselPlan?.vesselStatus) vs.add(p.vesselPlan.vesselStatus);
      }
      return {
        statuses: [...s].sort(),
        groups: [...g].sort(),
        segments: [...seg].sort(),
        incoterms: [...i].sort(),
        voyageStatuses: [...vs].sort(),
      };
    }, [projects]);

  function clearAll() {
    onChange(EMPTY_DASHBOARD_FILTERS);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        {/* Square accent-gradient pill — same dialect as the ProjectList
            FilterPopover trigger. White stroke HugeIcon, accent shadow,
            count badge on the corner when active. */}
        <button
          type="button"
          aria-label="Gelişmiş filtre"
          className={cn(
            "size-9 rounded-xl grid place-items-center shrink-0 shadow-sm relative transition-transform",
            "hover:scale-[1.04] active:scale-95",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
            className
          )}
          style={{
            background: accent.gradient,
            color: "white",
            boxShadow: `0 4px 12px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
          }}
        >
          <HugeiconsIcon
            icon={FilterHorizontalIcon}
            size={16}
            strokeWidth={2}
          />
          {activeCount > 0 && (
            <span
              className="absolute -top-1 -right-1 size-4 grid place-items-center rounded-full text-[9px] font-bold tabular-nums"
              style={{
                background: "white",
                color: accent.solid,
                boxShadow: `0 0 0 1.5px ${accent.solid}, 0 2px 6px -1px ${accent.ring}`,
              }}
            >
              {activeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        collisionPadding={12}
        className={cn(
          "w-[min(20rem,calc(100vw-1rem))] p-0 overflow-hidden flex flex-col",
          "max-h-[min(calc(100vh-120px),580px)]",
          // Opaque enough that chip text never blurs into the dashboard
          // bento underneath. The user explicitly called out the previous
          // 85% as too transparent.
          "bg-white/95 backdrop-blur-2xl backdrop-saturate-150",
          "ring-1 ring-white/55",
          "shadow-[0_28px_72px_-16px_rgba(15,23,42,0.45)]"
        )}
        style={
          {
            "--filter-active-bg": accent.tint,
            "--filter-active-fg": accent.solid,
            "--filter-active-border": accent.ring,
          } as React.CSSProperties
        }
      >
        {/* Header — accent gradient pill icon + title + tagline */}
        <div className="px-4 py-3 flex items-center gap-3 shrink-0 border-b border-border/40">
          <span
            className="size-9 rounded-xl grid place-items-center shrink-0 text-white shadow-sm"
            style={{
              background: accent.gradient,
              boxShadow: `0 4px 12px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
            }}
          >
            <HugeiconsIcon
              icon={FilterHorizontalIcon}
              size={16}
              strokeWidth={2}
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold tracking-tight leading-tight">
              Gelişmiş Filtre
            </div>
            <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              {hasFilters
                ? `${activeCount} filtre aktif`
                : "Çoklu seçim yapabilirsin"}
            </div>
          </div>
        </div>

        {/* Body — sections stacked, tighter gap (was 5 → 3) */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-3">
          {/* Period selector — single-select, default = fy + currentFy */}
          <PeriodSection
            period={filters.period}
            fyKey={filters.fyKey}
            onChange={(period, fyKey) =>
              onChange({ ...filters, period, fyKey })
            }
          />

          {/* Ship-plan inclusion toggle */}
          <label className="flex items-start gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={filters.includeWithoutShipPlan}
              onChange={(e) =>
                onChange({
                  ...filters,
                  includeWithoutShipPlan: e.target.checked,
                })
              }
              className="mt-0.5 size-4 rounded border-border cursor-pointer"
              style={{ accentColor: accent.solid }}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold leading-tight">
                Gemi planı olmayanları da dahil et
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                Varsayılan: tüm projeler dahil
              </div>
            </div>
          </label>

          {voyageStatuses.length > 0 && (
            <FilterToggleSet
              title="Sefer Durumu"
              values={voyageStatuses}
              selected={filters.voyageStatuses}
              onChange={(next) =>
                onChange({ ...filters, voyageStatuses: next })
              }
            />
          )}

          <FilterToggleSet
            title="Durum"
            values={statuses}
            selected={filters.statuses}
            onChange={(next) => onChange({ ...filters, statuses: next })}
          />

          <FilterToggleSet
            title="Proje Grubu"
            values={groups}
            selected={filters.groups}
            onChange={(next) => onChange({ ...filters, groups: next })}
            searchable
          />

          <FilterToggleSet
            title="Teslimat Koşulu (Incoterm)"
            values={incoterms}
            selected={filters.incoterms}
            onChange={(next) => onChange({ ...filters, incoterms: next })}
          />

          <FilterToggleSet
            title="Segment"
            values={segments}
            selected={filters.segments}
            onChange={(next) => onChange({ ...filters, segments: next })}
          />
        </div>

        {/* Sticky footer — Clear button + result counter */}
        <div className="sticky bottom-0 z-[1] px-4 py-2.5 border-t border-border/50 bg-white/95 backdrop-blur-xl flex items-center justify-between gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            disabled={!hasFilters}
            className={cn(
              "h-8 px-2.5 gap-1.5 text-[11.5px] font-medium rounded-full",
              hasFilters
                ? "text-foreground hover:bg-foreground/[0.06]"
                : "text-muted-foreground/60"
            )}
            style={hasFilters ? { color: accent.solid } : undefined}
          >
            <HugeiconsIcon
              icon={FilterResetIcon}
              size={13}
              strokeWidth={2}
            />
            Filtreleri Temizle
          </Button>

          {resultCount !== undefined && totalCount !== undefined && (
            <div className="text-[11px] text-muted-foreground text-right">
              {hasFilters ? (
                <>
                  <span
                    className="font-bold tabular-nums"
                    style={{ color: accent.solid }}
                  >
                    {resultCount}
                  </span>
                  {" / "}
                  <span className="tabular-nums">{totalCount}</span> proje
                </>
              ) : (
                <>
                  Tüm{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    {totalCount}
                  </span>{" "}
                  proje
                </>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ─────────── Period section (fy + rolling) ─────────── */

function PeriodSection({
  period,
  fyKey,
  onChange,
}: {
  period: PeriodKey;
  fyKey: string | null;
  onChange: (period: PeriodKey, fyKey: string | null) => void;
}) {
  const fyOptions = React.useMemo(() => lastNFinancialYears(new Date(), 3), []);
  const showFyOptions = period === "fy";
  return (
    <FilterSection title="Dönem">
      <ToggleGroup
        type="single"
        value={period}
        onValueChange={(v) => {
          if (!v) return;
          const next = v as PeriodKey;
          // When switching to fy, default to current FY if none selected.
          const nextFy = next === "fy" ? fyKey ?? getCurrentFyKey() : null;
          onChange(next, nextFy);
        }}
        variant="outline"
        size="sm"
        spacing={4}
        className="flex-wrap"
      >
        {PERIODS.map((p) => (
          <ToggleGroupItem
            key={p.key}
            value={p.key}
            className={ACTIVE_CHIP_CLASS}
          >
            {p.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {showFyOptions && (
        <div className="mt-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1.5">
            Finansal Yıl
          </div>
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
              <ToggleGroupItem
                key={fy.key}
                value={fy.key}
                className={ACTIVE_CHIP_CLASS}
              >
                {fy.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}
    </FilterSection>
  );
}

/* ─────────── Shared chip styling ─────────── */

const ACTIVE_CHIP_CLASS = cn(
  // Tighter chip — height 7 → keep, padding tighter (was px-3 → px-2.5)
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

function FilterSection({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  const accent = useThemeAccent();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </div>
        {count !== undefined && count > 0 && (
          <span
            className="h-[18px] min-w-[18px] inline-flex items-center justify-center rounded-full px-1.5 text-[9.5px] font-bold tabular-nums shadow-sm"
            style={{
              background: accent.gradient,
              color: "white",
            }}
          >
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

interface FilterToggleSetProps {
  title: string;
  values: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  searchable?: boolean;
}

function FilterToggleSet({
  title,
  values,
  selected,
  onChange,
  searchable,
}: FilterToggleSetProps) {
  const [query, setQuery] = React.useState("");
  const filtered = React.useMemo(() => {
    if (!query.trim()) return values;
    const q = query.toLowerCase();
    return values.filter((v) => v.toLowerCase().includes(q));
  }, [values, query]);

  if (values.length === 0) {
    return (
      <FilterSection title={title}>
        <Empty className="border py-3">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={FilterIcon} size={14} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle className="text-[11px]">Veri yok</EmptyTitle>
          </EmptyHeader>
        </Empty>
      </FilterSection>
    );
  }

  const showSearch = searchable && values.length > 8;

  return (
    <FilterSection title={title} count={selected.size}>
      {showSearch && (
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`${title} ara...`}
            className="w-full h-7 rounded-md border border-input bg-background pl-7 pr-2 text-[11.5px] outline-none focus:ring-1 focus:ring-ring focus:border-ring"
          />
        </div>
      )}
      <ToggleGroup
        type="multiple"
        value={[...selected]}
        onValueChange={(arr) => onChange(new Set(arr))}
        variant="outline"
        size="sm"
        spacing={4}
        className="flex-wrap"
      >
        {filtered.map((v) => (
          <ToggleGroupItem key={v} value={v} className={ACTIVE_CHIP_CLASS}>
            {v}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {showSearch && filtered.length === 0 && (
        <div className="text-[10.5px] text-muted-foreground italic py-1">
          "{query}" için sonuç yok
        </div>
      )}
    </FilterSection>
  );
}
