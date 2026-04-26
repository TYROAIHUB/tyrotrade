import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon,
  FilterHorizontalIcon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { cn } from "@/lib/utils";

export interface ProjectsFilterState {
  /** Free-text search (substring across all string fields) */
  search: string;
  /** Multi-select by mserp_projgroupid */
  groups: Set<string>;
  /** Multi-select by mserp_dlvmode */
  dlvModes: Set<string>;
  /** Multi-select by mserp_dlvterm */
  dlvTerms: Set<string>;
  /** Multi-select by mserp_currencycode */
  currencies: Set<string>;
  /** Multi-select by mserp_traderid */
  traders: Set<string>;
  /** Multi-select by mserp_tryprojectsegment */
  segments: Set<string>;
  /** Multi-select by status FormattedValue (Open / Closed / ...) */
  statuses: Set<string>;
}

export const EMPTY_PROJECT_FILTERS: ProjectsFilterState = {
  search: "",
  groups: new Set(),
  dlvModes: new Set(),
  dlvTerms: new Set(),
  currencies: new Set(),
  traders: new Set(),
  segments: new Set(),
  statuses: new Set(),
};

export function projectFilterCount(f: ProjectsFilterState): number {
  return (
    (f.search.trim() ? 1 : 0) +
    f.groups.size +
    f.dlvModes.size +
    f.dlvTerms.size +
    f.currencies.size +
    f.traders.size +
    f.segments.size +
    f.statuses.size
  );
}

/** Apply projects filter to rows. */
export function applyProjectsFilter(
  rows: Record<string, unknown>[],
  f: ProjectsFilterState
): Record<string, unknown>[] {
  const q = f.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (q) {
      const hay = Object.values(r)
        .filter((v) => typeof v === "string" || typeof v === "number")
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.groups.size > 0 && !f.groups.has(String(r.mserp_projgroupid ?? "")))
      return false;
    if (f.dlvModes.size > 0 && !f.dlvModes.has(String(r.mserp_dlvmode ?? "")))
      return false;
    if (f.dlvTerms.size > 0 && !f.dlvTerms.has(String(r.mserp_dlvterm ?? "")))
      return false;
    if (
      f.currencies.size > 0 &&
      !f.currencies.has(String(r.mserp_currencycode ?? ""))
    )
      return false;
    if (f.traders.size > 0 && !f.traders.has(String(r.mserp_traderid ?? "")))
      return false;
    if (
      f.segments.size > 0 &&
      !f.segments.has(String(r.mserp_tryprojectsegment ?? ""))
    )
      return false;
    if (f.statuses.size > 0) {
      const formatted =
        (r["mserp_status@OData.Community.Display.V1.FormattedValue"] as
          | string
          | undefined) ?? String(r.mserp_status ?? "");
      if (!f.statuses.has(formatted)) return false;
    }
    return true;
  });
}

interface ProjectsToolbarProps {
  rows: Record<string, unknown>[];
  filters: ProjectsFilterState;
  onChange: (next: ProjectsFilterState) => void;
  className?: string;
}

/**
 * Search input + Advanced Filter popover for Projects master table.
 *
 * - Search: free-text, hits all string/number fields.
 * - Advanced filter: multi-select toggle groups for the curated dimensions.
 * - Distinct values are derived from the loaded rows automatically.
 */
export function ProjectsToolbar({
  rows,
  filters,
  onChange,
  className,
}: ProjectsToolbarProps) {
  const accent = useThemeAccent();
  const activeCount = projectFilterCount(filters);
  const [open, setOpen] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);

  // Derive distinct values for each filter dimension
  const dimensions = React.useMemo(() => {
    const groups = new Set<string>();
    const dlvModes = new Set<string>();
    const dlvTerms = new Set<string>();
    const currencies = new Set<string>();
    const traders = new Set<string>();
    const segments = new Set<string>();
    const statuses = new Set<string>();
    for (const r of rows) {
      const g = String(r.mserp_projgroupid ?? "");
      if (g) groups.add(g);
      const m = String(r.mserp_dlvmode ?? "");
      if (m) dlvModes.add(m);
      const t = String(r.mserp_dlvterm ?? "");
      if (t) dlvTerms.add(t);
      const c = String(r.mserp_currencycode ?? "");
      if (c) currencies.add(c);
      const tr = String(r.mserp_traderid ?? "");
      if (tr) traders.add(tr);
      const s = String(r.mserp_tryprojectsegment ?? "");
      if (s) segments.add(s);
      const st =
        (r["mserp_status@OData.Community.Display.V1.FormattedValue"] as
          | string
          | undefined) ?? String(r.mserp_status ?? "");
      if (st) statuses.add(st);
    }
    return {
      groups: [...groups].sort(),
      dlvModes: [...dlvModes].sort(),
      dlvTerms: [...dlvTerms].sort(),
      currencies: [...currencies].sort(),
      traders: [...traders].sort(),
      segments: [...segments].sort(),
      statuses: [...statuses].sort(),
    };
  }, [rows]);

  function toggle<K extends keyof ProjectsFilterState>(
    key: K,
    values: string[]
  ) {
    const cur = filters[key];
    if (cur instanceof Set) {
      onChange({ ...filters, [key]: new Set(values) });
    }
  }

  function clearAll() {
    onChange(EMPTY_PROJECT_FILTERS);
  }

  return (
    <div className={cn("flex items-center gap-2 flex-wrap min-w-0", className)}>
      {/* Search input — frosted pill matching the buttons (same elevation) */}
      <div className="relative w-64 max-w-full">
        <HugeiconsIcon
          icon={Search01Icon}
          size={15}
          strokeWidth={2.25}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-[1]"
          style={{ color: accent.solid }}
        />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Tüm alanlarda ara…"
          className={cn(
            "w-full h-9 pl-10 pr-8 rounded-full text-[13px] outline-none",
            "bg-white/70 backdrop-blur-xl backdrop-saturate-150",
            "ring-1 ring-foreground/15 hover:ring-foreground/30 focus:ring-2 focus:ring-ring",
            "placeholder:text-muted-foreground/70 transition-shadow"
          )}
          style={{
            // Same elevation recipe as the filter/Güncelle buttons so all
            // three pills sit on the same shadow plane and the input clearly
            // lifts off the panel surface.
            boxShadow:
              "0 4px 12px -4px rgba(15,23,42,0.18), inset 0 1px 0 0 rgba(255,255,255,0.85)",
          }}
        />
        {filters.search && (
          <button
            type="button"
            onClick={() => onChange({ ...filters, search: "" })}
            aria-label="Aramayı temizle"
            className="absolute right-2 top-1/2 -translate-y-1/2 size-5 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] z-[1]"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={12} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* Advanced filter button — frosted-white twin of the Güncelle pill */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={cn(
              "group relative inline-flex items-center gap-2 shrink-0 self-center",
              "rounded-full px-3.5 h-9 text-[13px] font-semibold text-foreground",
              "ring-1 ring-foreground/15 hover:ring-foreground/30",
              "transition-all duration-200",
              "hover:scale-[1.04] active:scale-95",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "overflow-hidden whitespace-nowrap min-w-[140px] justify-center",
              // Frosted-white surface (matches Güncelle's shape, inverted color).
              "bg-white/70 backdrop-blur-xl backdrop-saturate-150",
              activeCount > 0 && "ring-2"
            )}
            style={{
              boxShadow:
                activeCount > 0
                  ? `0 4px 12px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.85), 0 0 0 2px ${accent.ring}`
                  : `0 4px 12px -4px rgba(15,23,42,0.18), inset 0 1px 0 0 rgba(255,255,255,0.85)`,
            }}
          >
            {/* Subtle shimmer (slate sweep on white) — same choreography as Güncelle */}
            <span
              aria-hidden
              className={cn(
                "absolute inset-0 rounded-full pointer-events-none",
                "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-foreground/10 before:to-transparent",
                "before:translate-x-[-120%] before:transition-transform before:duration-700",
                hovered && "before:translate-x-[120%]"
              )}
            />
            <HugeiconsIcon
              icon={FilterHorizontalIcon}
              size={16}
              strokeWidth={2}
              className={cn(
                "shrink-0 relative z-[1] transition-transform duration-300",
                hovered ? "rotate-6 scale-110" : "rotate-0"
              )}
              style={{ color: accent.solid }}
            />
            <span className="relative z-[1] tracking-tight">Gelişmiş Filtre</span>
            {activeCount > 0 && (
              <span
                className="ml-0.5 h-5 min-w-5 px-1.5 inline-flex items-center justify-center rounded-full text-[10.5px] font-bold tabular-nums shadow-sm relative z-[1]"
                style={{ background: accent.gradient, color: "white" }}
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
          className={cn(
            "w-[420px] p-0 overflow-hidden flex flex-col",
            "max-h-[min(calc(100vh-120px),600px)]",
            "ring-1 ring-white/55",
            "shadow-[0_30px_80px_-16px_rgba(15,23,42,0.5)]"
          )}
          style={
            {
              "--filter-active-bg": accent.tint,
              "--filter-active-fg": accent.solid,
              "--filter-active-border": accent.ring,
            } as React.CSSProperties
          }
        >
          <div className="px-4 py-3 flex items-center justify-between gap-2 shrink-0">
            <div>
              <div className="text-[13px] font-semibold tracking-tight">
                Gelişmiş Filtre
              </div>
              <div className="text-[10.5px] text-muted-foreground">
                Tüm seçimler birlikte uygulanır
              </div>
            </div>
            {activeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-7 px-2 text-[11px] gap-1"
              >
                Temizle
              </Button>
            )}
          </div>
          <Separator />
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
            <FilterSection title="Durum" values={dimensions.statuses}>
              <ToggleChips
                values={dimensions.statuses}
                selected={filters.statuses}
                onChange={(v) => toggle("statuses", v)}
              />
            </FilterSection>
            <FilterSection title="Proje Grubu" values={dimensions.groups}>
              <ToggleChips
                values={dimensions.groups}
                selected={filters.groups}
                onChange={(v) => toggle("groups", v)}
              />
            </FilterSection>
            <FilterSection title="Teslimat Şekli" values={dimensions.dlvModes}>
              <ToggleChips
                values={dimensions.dlvModes}
                selected={filters.dlvModes}
                onChange={(v) => toggle("dlvModes", v)}
              />
            </FilterSection>
            <FilterSection title="Teslimat Koşulu" values={dimensions.dlvTerms}>
              <ToggleChips
                values={dimensions.dlvTerms}
                selected={filters.dlvTerms}
                onChange={(v) => toggle("dlvTerms", v)}
              />
            </FilterSection>
            <FilterSection title="Para Birimi" values={dimensions.currencies}>
              <ToggleChips
                values={dimensions.currencies}
                selected={filters.currencies}
                onChange={(v) => toggle("currencies", v)}
              />
            </FilterSection>
            <FilterSection title="Trader" values={dimensions.traders}>
              <ToggleChips
                values={dimensions.traders}
                selected={filters.traders}
                onChange={(v) => toggle("traders", v)}
              />
            </FilterSection>
            <FilterSection title="Segment" values={dimensions.segments}>
              <ToggleChips
                values={dimensions.segments}
                selected={filters.segments}
                onChange={(v) => toggle("segments", v)}
              />
            </FilterSection>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function FilterSection({
  title,
  values,
  children,
}: {
  title: string;
  values: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <span>{title}</span>
        <span className="tabular-nums opacity-60">{values.length}</span>
      </div>
      {values.length === 0 ? (
        <div className="text-[10.5px] text-muted-foreground/70 italic">
          Veri yok
        </div>
      ) : (
        children
      )}
    </div>
  );
}

const CHIP_CLASS = cn(
  "h-7 rounded-full text-[11.5px] px-3 font-medium",
  "border-foreground/15 bg-transparent",
  "hover:bg-foreground/[0.04] hover:border-foreground/25",
  "data-[state=on]:bg-[var(--filter-active-bg)]",
  "data-[state=on]:text-[var(--filter-active-fg)]",
  "data-[state=on]:border-[var(--filter-active-border)]",
  "data-[state=on]:font-semibold transition-colors"
);

function ToggleChips({
  values,
  selected,
  onChange,
}: {
  values: string[];
  selected: Set<string>;
  onChange: (values: string[]) => void;
}) {
  return (
    <ToggleGroup
      type="multiple"
      value={[...selected]}
      onValueChange={onChange}
      variant="outline"
      size="sm"
      spacing={6}
      className="flex-wrap"
    >
      {values.map((v) => (
        <ToggleGroupItem key={v} value={v} className={CHIP_CLASS}>
          {v}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
