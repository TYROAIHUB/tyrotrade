import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon,
  FilterHorizontalIcon,
  Cancel01Icon,
  FilterResetIcon,
} from "@hugeicons/core-free-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { ProjectCard } from "./ProjectCard";
import type { Project } from "@/lib/dataverse/entities";
import { hasUsableShipPlan } from "@/lib/selectors/project";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { cn } from "@/lib/utils";

/** Date-range presets — single-select. `null` = "Tümü" (no filter). */
type DateRangeKey =
  | "this-month"
  | "last-30"
  | "last-90"
  | "this-year"
  | "last-12-months";

const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: "this-month", label: "Bu Ay" },
  { key: "last-30", label: "Son 30 Gün" },
  { key: "last-90", label: "Son 90 Gün" },
  { key: "this-year", label: "Bu Yıl" },
  { key: "last-12-months", label: "Son 12 Ay" },
];

/** Resolve a preset to a `>=` ISO date cutoff (yyyy-mm-dd). */
function resolveDateCutoff(key: DateRangeKey, now: Date): string {
  const d = new Date(now);
  switch (key) {
    case "this-month":
      return new Date(d.getFullYear(), d.getMonth(), 1)
        .toISOString()
        .slice(0, 10);
    case "last-30":
      return new Date(d.getTime() - 30 * 86400_000).toISOString().slice(0, 10);
    case "last-90":
      return new Date(d.getTime() - 90 * 86400_000).toISOString().slice(0, 10);
    case "this-year":
      return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10);
    case "last-12-months":
      return new Date(d.getFullYear() - 1, d.getMonth(), d.getDate())
        .toISOString()
        .slice(0, 10);
  }
}

interface FilterState {
  query: string;
  statuses: Set<string>;
  groups: Set<string>;
  incoterms: Set<string>;
  segments: Set<string>;
  /** Vessel-plan voyage status — Commenced or Completed only. */
  voyageStatuses: Set<string>;
  /** Trader codes (`project.traderNo`). */
  traders: Set<string>;
  /** Company codes (`vesselPlan.companyId`). */
  companies: Set<string>;
  /** Single-select preset for `project.projectDate`. `null` = no filter. */
  dateRange: DateRangeKey | null;
  /** When false (default), projects without `vesselPlan` are hidden. */
  includeWithoutShipPlan: boolean;
}

const EMPTY_FILTERS: FilterState = {
  query: "",
  statuses: new Set(),
  groups: new Set(),
  incoterms: new Set(),
  segments: new Set(),
  voyageStatuses: new Set(),
  traders: new Set(),
  companies: new Set(),
  dateRange: null,
  includeWithoutShipPlan: false,
};

interface ProjectListProps {
  projects: Project[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ProjectList({ projects, selectedId, onSelect }: ProjectListProps) {
  const accent = useThemeAccent();
  const [filters, setFilters] = React.useState<FilterState>(EMPTY_FILTERS);

  const {
    availableStatuses,
    availableGroups,
    availableIncoterms,
    availableSegments,
    availableVoyageStatuses,
    availableTraders,
    availableCompanies,
  } = React.useMemo(() => {
    const s = new Set<string>();
    const g = new Set<string>();
    const i = new Set<string>();
    const seg = new Set<string>();
    const vs = new Set<string>();
    const tr = new Set<string>();
    const co = new Set<string>();
    for (const p of projects) {
      if (p.status) s.add(p.status);
      if (p.projectGroup) g.add(p.projectGroup);
      if (p.incoterm) i.add(p.incoterm);
      if (p.segment) seg.add(p.segment);
      if (p.vesselPlan?.vesselStatus) vs.add(p.vesselPlan.vesselStatus);
      if (p.traderNo) tr.add(p.traderNo);
      if (p.vesselPlan?.companyId) co.add(p.vesselPlan.companyId);
    }
    return {
      availableStatuses: [...s].sort(),
      availableGroups: [...g].sort(),
      availableIncoterms: [...i].sort(),
      availableSegments: [...seg].sort(),
      availableVoyageStatuses: [...vs].sort(),
      availableTraders: [...tr].sort(),
      availableCompanies: [...co].sort(),
    };
  }, [projects]);

  // Cutoff resolved once per render — only when a preset is active.
  const dateCutoff = React.useMemo(
    () =>
      filters.dateRange ? resolveDateCutoff(filters.dateRange, new Date()) : null,
    [filters.dateRange]
  );

  const filtered = React.useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return projects.filter((p) => {
      if (!filters.includeWithoutShipPlan && !hasUsableShipPlan(p)) return false;
      if (filters.voyageStatuses.size > 0) {
        const vs = p.vesselPlan?.vesselStatus ?? "";
        if (!filters.voyageStatuses.has(vs)) return false;
      }
      if (filters.statuses.size > 0 && !filters.statuses.has(p.status)) return false;
      if (filters.groups.size > 0 && !filters.groups.has(p.projectGroup)) return false;
      if (filters.incoterms.size > 0 && !filters.incoterms.has(p.incoterm)) return false;
      if (filters.segments.size > 0 && !filters.segments.has(p.segment ?? "")) return false;
      if (filters.traders.size > 0 && !filters.traders.has(p.traderNo))
        return false;
      if (
        filters.companies.size > 0 &&
        !filters.companies.has(p.vesselPlan?.companyId ?? "")
      )
        return false;
      if (dateCutoff && (!p.projectDate || p.projectDate < dateCutoff))
        return false;
      if (!q) return true;
      const haystack = [
        p.projectNo,
        p.projectName,
        p.projectGroup,
        p.vesselPlan?.vesselName,
        p.vesselPlan?.loadingPort.name,
        p.vesselPlan?.dischargePort.name,
        p.vesselPlan?.supplier,
        p.vesselPlan?.buyer,
        p.segment,
        ...p.lines.map((l) => l.productName),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [projects, filters, dateCutoff]);

  const activeFilterCount =
    filters.statuses.size +
    filters.groups.size +
    filters.incoterms.size +
    filters.segments.size +
    filters.voyageStatuses.size +
    filters.traders.size +
    filters.companies.size +
    (filters.dateRange ? 1 : 0) +
    (filters.includeWithoutShipPlan ? 1 : 0);

  const clearAll = () =>
    setFilters({
      ...filters,
      statuses: new Set(),
      groups: new Set(),
      incoterms: new Set(),
      segments: new Set(),
      voyageStatuses: new Set(),
      traders: new Set(),
      companies: new Set(),
      dateRange: null,
      includeWithoutShipPlan: false,
    });

  return (
    <GlassPanel
      tone="default"
      className="rounded-2xl flex flex-col h-full overflow-hidden"
    >
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            Projeler
            {/* Theme-aware count badge */}
            <span
              className="inline-flex items-center gap-0.5 h-5 px-2 rounded-full text-[11px] font-bold tabular-nums"
              style={{
                backgroundColor: accent.tint,
                color: accent.solid,
                boxShadow: `inset 0 0 0 1px ${accent.ring}`,
              }}
            >
              {filtered.length}
              {filtered.length !== projects.length && (
                <span className="opacity-60">/{projects.length}</span>
              )}
            </span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Search input — frosted pill, accent magnifier */}
          <div className="relative flex-1 min-w-0">
            <HugeiconsIcon
              icon={Search01Icon}
              size={15}
              strokeWidth={2.25}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-[1]"
              style={{ color: accent.solid }}
            />
            <input
              type="text"
              value={filters.query}
              onChange={(e) => setFilters({ ...filters, query: e.target.value })}
              placeholder="Proje, gemi, liman, tedarikçi..."
              className={cn(
                "w-full h-9 pl-9 pr-7 rounded-full text-[13px] outline-none",
                "bg-white/70 backdrop-blur-xl backdrop-saturate-150",
                "ring-1 ring-foreground/15 hover:ring-foreground/30 focus:ring-2 focus:ring-ring",
                "placeholder:text-muted-foreground/70 transition-shadow"
              )}
              style={{
                boxShadow:
                  "0 4px 12px -4px rgba(15,23,42,0.18), inset 0 1px 0 0 rgba(255,255,255,0.85)",
              }}
            />
            {filters.query && (
              <button
                type="button"
                onClick={() => setFilters({ ...filters, query: "" })}
                aria-label="Aramayı temizle"
                className="absolute right-2 top-1/2 -translate-y-1/2 size-5 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] z-[1]"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={11} strokeWidth={2.5} />
              </button>
            )}
          </div>
          <FilterPopover
            filters={filters}
            setFilters={setFilters}
            activeCount={activeFilterCount}
            availableStatuses={availableStatuses}
            availableGroups={availableGroups}
            availableIncoterms={availableIncoterms}
            availableSegments={availableSegments}
            availableVoyageStatuses={availableVoyageStatuses}
            availableTraders={availableTraders}
            availableCompanies={availableCompanies}
            onClearAll={clearAll}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden px-2 pb-3 space-y-1.5">
        {filtered.map((p) => (
          <ProjectCard
            key={p.projectNo}
            project={p}
            selected={selectedId === p.projectNo}
            onClick={() => onSelect(p.projectNo)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">
            Sonuç bulunamadı
          </div>
        )}
      </div>
    </GlassPanel>
  );
}

function FilterPopover({
  filters,
  setFilters,
  activeCount,
  availableStatuses,
  availableGroups,
  availableIncoterms,
  availableSegments,
  availableVoyageStatuses,
  availableTraders,
  availableCompanies,
  onClearAll,
}: {
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  activeCount: number;
  availableStatuses: string[];
  availableGroups: string[];
  availableIncoterms: string[];
  availableSegments: string[];
  availableVoyageStatuses: string[];
  availableTraders: string[];
  availableCompanies: string[];
  onClearAll: () => void;
}) {
  const accent = useThemeAccent();
  const toggle = (set: Set<string>, value: string): Set<string> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Gelişmiş filtre"
          className={cn(
            "size-9 rounded-xl grid place-items-center shrink-0 shadow-sm relative transition-transform",
            "hover:scale-[1.04] active:scale-95",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
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
              className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full text-[10px] font-bold tabular-nums grid place-items-center bg-white shadow"
              style={{
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
        className={cn(
          "w-80 p-0 overflow-hidden flex flex-col",
          "max-h-[min(calc(100vh-120px),580px)]",
          "bg-white/85 backdrop-blur-2xl backdrop-saturate-150",
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
        {/* Header — accent icon pill + title + tagline */}
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
              {activeCount > 0
                ? `${activeCount} filtre aktif`
                : "Çoklu seçim yapabilirsin"}
            </div>
          </div>
        </div>

        {/* Body — scrollable sections */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-4">
          {/* Ship-plan inclusion toggle */}
          <label className="flex items-start gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={filters.includeWithoutShipPlan}
              onChange={(e) =>
                setFilters({
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
                Varsayılan: yalnızca gemi planı olan projeler
              </div>
            </div>
          </label>

          {/* Tarih — single-select preset (one chip active at a time). */}
          <SingleSelectSection
            title="Tarih"
            count={filters.dateRange ? 1 : 0}
            options={DATE_RANGE_OPTIONS}
            selected={filters.dateRange}
            onSelect={(k) => setFilters({ ...filters, dateRange: k })}
          />
          {availableVoyageStatuses.length > 0 && (
            <FilterSection
              title="Sefer Durumu"
              count={filters.voyageStatuses.size}
              options={availableVoyageStatuses}
              selected={filters.voyageStatuses}
              onToggle={(v) =>
                setFilters({
                  ...filters,
                  voyageStatuses: toggle(filters.voyageStatuses, v),
                })
              }
            />
          )}
          {availableTraders.length > 0 && (
            <FilterSection
              title="Trader"
              count={filters.traders.size}
              options={availableTraders}
              selected={filters.traders}
              onToggle={(v) =>
                setFilters({ ...filters, traders: toggle(filters.traders, v) })
              }
            />
          )}
          {availableCompanies.length > 0 && (
            <FilterSection
              title="Şirket"
              count={filters.companies.size}
              options={availableCompanies}
              selected={filters.companies}
              onToggle={(v) =>
                setFilters({
                  ...filters,
                  companies: toggle(filters.companies, v),
                })
              }
            />
          )}
          <FilterSection
            title="Durum"
            count={filters.statuses.size}
            options={availableStatuses}
            selected={filters.statuses}
            onToggle={(v) =>
              setFilters({ ...filters, statuses: toggle(filters.statuses, v) })
            }
          />
          <FilterSection
            title="Proje Grubu"
            count={filters.groups.size}
            options={availableGroups}
            selected={filters.groups}
            onToggle={(v) =>
              setFilters({ ...filters, groups: toggle(filters.groups, v) })
            }
          />
          <FilterSection
            title="Teslimat Koşulu"
            count={filters.incoterms.size}
            options={availableIncoterms}
            selected={filters.incoterms}
            onToggle={(v) =>
              setFilters({ ...filters, incoterms: toggle(filters.incoterms, v) })
            }
          />
          {availableSegments.length > 0 && (
            <FilterSection
              title="Segment"
              count={filters.segments.size}
              options={availableSegments}
              selected={filters.segments}
              onToggle={(v) =>
                setFilters({
                  ...filters,
                  segments: toggle(filters.segments, v),
                })
              }
            />
          )}
        </div>

        {/* Footer — sticky clear button */}
        <div className="px-4 py-2.5 border-t border-border/40 flex items-center justify-between gap-2 shrink-0 bg-white/40 backdrop-blur-md">
          <button
            type="button"
            onClick={onClearAll}
            disabled={activeCount === 0}
            className={cn(
              "h-8 px-3 inline-flex items-center gap-1.5 rounded-full text-[11.5px] font-semibold transition-all",
              activeCount > 0
                ? "text-foreground hover:bg-foreground/[0.06]"
                : "text-muted-foreground/60 cursor-not-allowed"
            )}
          >
            <HugeiconsIcon
              icon={FilterResetIcon}
              size={13}
              strokeWidth={2}
            />
            Filtreleri Temizle
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Single-select chip group — picking the same chip twice clears it.
 *  Shares the `FilterSection` look so the popover stays visually
 *  consistent. */
function SingleSelectSection({
  title,
  count,
  options,
  selected,
  onSelect,
}: {
  title: string;
  count: number;
  options: { key: DateRangeKey; label: string }[];
  selected: DateRangeKey | null;
  onSelect: (k: DateRangeKey | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <span>{title}</span>
        {count > 0 && (
          <span
            className="h-[18px] min-w-[18px] inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums"
            style={{
              backgroundColor: "var(--filter-active-bg)",
              color: "var(--filter-active-fg)",
            }}
          >
            {count}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = selected === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onSelect(active ? null : opt.key)}
              className={cn(
                "h-7 px-3 rounded-full text-[12px] font-medium transition-all border",
                active
                  ? "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5)] font-semibold"
                  : "border-foreground/15 bg-transparent text-foreground/80 hover:bg-foreground/[0.04] hover:border-foreground/25"
              )}
              style={
                active
                  ? {
                      backgroundColor: "var(--filter-active-bg)",
                      color: "var(--filter-active-fg)",
                      borderColor: "var(--filter-active-border)",
                    }
                  : undefined
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterSection({
  title,
  count,
  options,
  selected,
  onToggle,
}: {
  title: string;
  count: number;
  options: string[];
  selected: Set<string>;
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <span>{title}</span>
        {count > 0 && (
          <span
            className="h-[18px] min-w-[18px] inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums"
            style={{
              backgroundColor: "var(--filter-active-bg)",
              color: "var(--filter-active-fg)",
            }}
          >
            {count}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = selected.has(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className={cn(
                "h-7 px-3 rounded-full text-[12px] font-medium transition-all border",
                active
                  ? "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5)] font-semibold"
                  : "border-foreground/15 bg-transparent text-foreground/80 hover:bg-foreground/[0.04] hover:border-foreground/25"
              )}
              style={
                active
                  ? {
                      backgroundColor: "var(--filter-active-bg)",
                      color: "var(--filter-active-fg)",
                      borderColor: "var(--filter-active-border)",
                    }
                  : undefined
              }
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
