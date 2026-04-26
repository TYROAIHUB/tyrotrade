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
import { Separator } from "@/components/ui/separator";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { useThemeAccent } from "@/components/layout/theme-accent";
import type { Project } from "@/lib/dataverse/entities";

export interface DashboardFilterState {
  statuses: Set<string>;
  groups: Set<string>;
  segments: Set<string>;
  incoterms: Set<string>;
  /** Vessel-plan voyage status — Commenced or Completed only. Projects
   *  without a recognised voyage status fall back to project Open/Closed
   *  in the UI but are not surfaced as a filter chip here. */
  voyageStatuses: Set<string>;
  /** When false (default), projects without `vesselPlan` are hidden from
   *  the dashboard aggregations — same default as the Projects page. */
  includeWithoutShipPlan: boolean;
}

export const EMPTY_DASHBOARD_FILTERS: DashboardFilterState = {
  statuses: new Set(),
  groups: new Set(),
  segments: new Set(),
  incoterms: new Set(),
  voyageStatuses: new Set(),
  // Dashboard defaults to "all projects in calculations" — the user
  // explicitly opted for inclusive aggregates, with the toggle there
  // for whoever wants to scope down. Projects page keeps its own
  // operations-focused default (only ship-plan projects).
  includeWithoutShipPlan: true,
};

import { hasUsableShipPlan } from "@/lib/selectors/project";

/** Apply the filter state to a list of projects. */
export function applyDashboardFilters(
  projects: Project[],
  f: DashboardFilterState
): Project[] {
  return projects.filter((p) => {
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

export function dashboardFilterCount(f: DashboardFilterState): number {
  return (
    f.statuses.size +
    f.groups.size +
    f.segments.size +
    f.incoterms.size +
    f.voyageStatuses.size +
    // The dashboard default is "include all" — count toggling it OFF as an
    // active filter (i.e. "show only ship-plan projects").
    (f.includeWithoutShipPlan ? 0 : 1)
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

  const activeCount = dashboardFilterCount(filters);
  const accent = useThemeAccent();
  const hasFilters = activeCount > 0;

  function clearAll() {
    onChange(EMPTY_DASHBOARD_FILTERS);
  }

  // Resting + hover shadow stacks for the liquid-glass trigger.
  // Hover adds a stronger inset highlight + accent-tinted soft glow ("kabarma").
  const restShadow =
    "inset 0 1px 0 0 rgba(255,255,255,0.75), inset 0 -1px 1px 0 rgba(15,23,42,0.04), 0 1px 2px rgba(15,23,42,0.05), 0 4px 14px -6px rgba(15,23,42,0.12)";
  const hoverShadow = `inset 0 1px 0 0 rgba(255,255,255,0.95), inset 0 -1px 2px 0 rgba(15,23,42,0.05), 0 2px 6px -1px rgba(15,23,42,0.08), 0 12px 28px -8px ${accent.ring}`;
  const activeShadow = `inset 0 1px 0 0 rgba(255,255,255,0.85), 0 0 0 2px ${accent.ring}, 0 8px 22px -6px ${accent.ring}`;
  const activeHoverShadow = `inset 0 1px 0 0 rgba(255,255,255,0.95), 0 0 0 2px ${accent.ringStrong}, 0 14px 32px -8px ${accent.ring}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "group/cmd relative inline-flex items-center gap-2 shrink-0",
            "h-9 rounded-full pl-3 pr-2 text-[12.5px] font-semibold",
            // Liquid-glass surface — top-to-bottom gradient sheen + heavy backdrop blur
            "bg-gradient-to-b from-white/85 via-white/65 to-white/55",
            "backdrop-blur-xl backdrop-saturate-200",
            "ring-1 ring-foreground/10",
            "transition-[transform,box-shadow,background] duration-300 ease-out",
            "focus-visible:outline-none focus-visible:ring-2",
            "active:scale-[0.97]",
            // Lift + scale on hover — "kabarsın"
            "hover:scale-[1.04] hover:-translate-y-[1px]",
            "hover:from-white/95 hover:via-white/80 hover:to-white/70",
            "hover:ring-foreground/20",
            // Filter-active state stays slightly elevated
            hasFilters && "ring-2",
            className
          )}
          style={{
            boxShadow: hasFilters ? activeShadow : restShadow,
            ...({
              "--cmd-rest": hasFilters ? activeShadow : restShadow,
              "--cmd-hover": hasFilters ? activeHoverShadow : hoverShadow,
            } as React.CSSProperties),
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = hasFilters
              ? activeHoverShadow
              : hoverShadow;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = hasFilters
              ? activeShadow
              : restShadow;
          }}
        >
          {/* Top specular highlight — pure liquid-glass hairline */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-white/85 to-transparent rounded-full"
          />
          {/* Glow sheen that intensifies on hover */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full opacity-0 group-hover/cmd:opacity-100 transition-opacity duration-300"
            style={{
              background: `radial-gradient(120% 100% at 50% 0%, ${accent.tint}, transparent 60%)`,
            }}
          />
          <span
            className={cn(
              "relative size-5 rounded-full grid place-items-center shrink-0",
              "transition-all duration-300",
              "group-hover/cmd:scale-110"
            )}
            style={{
              backgroundColor: hasFilters ? accent.solid : "transparent",
              color: hasFilters ? "white" : accent.solid,
              boxShadow: hasFilters
                ? `0 2px 6px -2px ${accent.ring}`
                : undefined,
            }}
          >
            <HugeiconsIcon
              icon={FilterHorizontalIcon}
              size={12}
              strokeWidth={2.25}
            />
          </span>
          <span className="relative tracking-tight">Gelişmiş Filtre</span>
          {hasFilters && (
            <span
              className="relative ml-0.5 h-5 min-w-5 px-1.5 inline-flex items-center justify-center rounded-full text-[10.5px] font-bold tabular-nums shadow-sm transition-transform duration-300 group-hover/cmd:scale-110"
              style={{
                background: accent.gradient,
                color: "white",
              }}
            >
              {activeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={12}
        collisionPadding={12}
        className={cn(
          // Premium liquid-glass shell — relies on shadcn .glass + .glass-strong defaults
          // Mobile clamps width to viewport so the popover never overflows.
          "w-[min(440px,calc(100vw-1rem))] p-0 overflow-hidden flex flex-col",
          "max-h-[min(calc(100vh-120px),600px)]",
          // Crisp white hairline + deep elevation so it pops off the dashboard
          "ring-1 ring-white/55",
          "shadow-[0_30px_80px_-16px_rgba(15,23,42,0.5)]"
        )}
      >
        {/* Top specular hairline */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent z-10"
        />
        {/* Soft accent gradient sheen at top corners */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-24 z-0 opacity-60"
          style={{
            background: `radial-gradient(120% 80% at 50% 0%, ${accent.tint}, transparent 70%)`,
          }}
        />

        {/* Header — fixed, premium glassy bar */}
        <div className="relative px-5 pt-4 pb-3 flex items-center justify-between gap-3 shrink-0 z-[1]">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="size-9 rounded-xl grid place-items-center shrink-0 shadow-sm"
              style={{
                background: accent.gradient,
                color: "white",
                boxShadow: `0 4px 12px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
              }}
            >
              <HugeiconsIcon icon={FilterIcon} size={16} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold tracking-tight leading-tight">
                Gelişmiş Filtre
              </div>
              <div className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                {hasFilters
                  ? `${activeCount} filtre aktif`
                  : "Dashboard'ı kriterlere göre süz"}
              </div>
            </div>
          </div>
        </div>
        <Separator className="opacity-60" />

        {/* Body — scrollable when content exceeds. Accent tokens scoped here
         *  so every chip's active state uses the live theme accent. */}
        <div
          className="flex-1 min-h-0 overflow-y-auto px-5 py-4 relative z-[1]"
          style={
            {
              "--filter-active-bg": accent.tint,
              "--filter-active-fg": accent.solid,
              "--filter-active-border": accent.ring,
            } as React.CSSProperties
          }
        >
          <div className="flex flex-col gap-5">
            {/* Ship-plan inclusion toggle — same default as Projects page */}
            <label className="flex items-start gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.includeWithoutShipPlan}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    includeWithoutShipPlan: e.target.checked,
                  })
                }
                className="mt-0.5 size-3.5 rounded border-border accent-foreground cursor-pointer"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[11.5px] font-semibold leading-tight">
                  Gemi planı olmayanları da dahil et
                </div>
                <div className="text-[10.5px] text-muted-foreground mt-0.5 leading-tight">
                  Varsayılan: yalnızca gemi planı olan projeler
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
        </div>

        {/* Footer — Temizle (clear) + result counter */}
        <Separator className="opacity-60" />
        <div className="relative z-[1] px-5 py-3 flex items-center justify-between gap-3 shrink-0 bg-white/30 backdrop-blur-md">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            disabled={!hasFilters}
            className={cn(
              "h-8 px-2.5 gap-1.5 text-[11.5px] font-medium rounded-full",
              "transition-all",
              hasFilters
                ? "text-foreground hover:bg-foreground/[0.06]"
                : "text-muted-foreground/60"
            )}
          >
            <HugeiconsIcon
              icon={FilterResetIcon}
              size={13}
              strokeWidth={2}
              data-icon="inline-start"
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

/** Shared chip styling — drives the data-[state=on] active appearance from
 *  CSS variables set on the popover body so it tracks the live theme accent
 *  (light → sky, navy → gold, black → bright sky). */
const ACTIVE_CHIP_CLASS = cn(
  "h-7 rounded-full text-[11.5px] px-3 font-medium",
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
    <div className="flex flex-col gap-2">
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
        spacing={6}
        className="flex-wrap"
      >
        {filtered.map((v) => (
          <ToggleGroupItem
            key={v}
            value={v}
            className={ACTIVE_CHIP_CLASS}
          >
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
