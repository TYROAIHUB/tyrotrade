import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  FilterIcon,
  FilterResetIcon,
} from "@hugeicons/core-free-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox";
import { useThemeAccent } from "@/components/layout/theme-accent";
import {
  extractAvailableOptions,
  projectFilterCount,
  type ProjectFilterState,
} from "@/lib/filters/projectFilters";
import { PERIODS, type PeriodKey } from "@/lib/dashboard/periods";
import {
  getCurrentFyKey,
  lastNFinancialYears,
} from "@/lib/dashboard/financialPeriod";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/dataverse/entities";

interface AdvancedFilterProps {
  /** Source projects — used to extract distinct option values per
   *  combobox section. Pass the unfiltered list. */
  projects: Project[];
  filters: ProjectFilterState;
  onChange: (next: ProjectFilterState) => void;
  /** Per-page default for the includeWithoutShipPlan toggle —
   *  determines what counts as "active filter" for the badge. */
  shipPlanDefault?: boolean;
  /** Number of projects after filters applied — shown in footer. */
  resultCount?: number;
  /** Total before filters — shown in footer. */
  totalCount?: number;
  /** Render a compact 36×36 icon-only square trigger instead of the
   *  full "Filtre" labelled pill. Used by ProjectList where the
   *  search input + a labelled pill would crowd the panel header. */
  iconOnly?: boolean;
  className?: string;
}

/**
 * Page-agnostic Advanced Filter popover. One trigger pill matches the
 * AskAi/Filtre topbar dialect (110px min-width, accent gradient,
 * rounded-full); inside, a stack of categorical sections in this
 * order:
 *
 *   1. ShipPlan toggle
 *   2. Sefer Durumu (chip — low cardinality)
 *   3. Durum (chip)
 *   4. Teslimat Koşulu (chip)
 *   5. Segment (combobox)
 *   6. Trader (combobox)
 *   7. Şirket (combobox)
 *   8. Gemi (combobox)
 *   9. Tedarikçi (combobox)
 *  10. Müşteri / Alıcı (combobox)
 *  11. Proje Grubu (combobox)
 *
 * Period + FY are *not* in here — those live in `PeriodFilter` which
 * sits at the top of the page above the bento/list. Keeping them
 * separate means the user can change the period without re-opening
 * the popover.
 */
export function AdvancedFilter({
  projects,
  filters,
  onChange,
  shipPlanDefault = true,
  resultCount,
  totalCount,
  iconOnly = false,
  className,
}: AdvancedFilterProps) {
  const accent = useThemeAccent();
  const activeCount = projectFilterCount(filters, shipPlanDefault);
  const hasFilters = activeCount > 0;

  const options = React.useMemo(
    () => extractAvailableOptions(projects),
    [projects]
  );

  function clearAll() {
    onChange({
      ...filters,
      statuses: new Set(),
      groups: new Set(),
      incoterms: new Set(),
      segments: new Set(),
      voyageStatuses: new Set(),
      traders: new Set(),
      companies: new Set(),
      suppliers: new Set(),
      buyers: new Set(),
      vessels: new Set(),
      includeWithoutShipPlan: shipPlanDefault,
    });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        {iconOnly ? (
          // Compact icon-only trigger — used by ProjectList where the
          // search input is already wide and a labelled pill crowds
          // the panel header. Square 36×36 with corner badge for the
          // active count.
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
            <HugeiconsIcon icon={FilterIcon} size={16} strokeWidth={2} />
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
        ) : (
          <button
            type="button"
            aria-label="Gelişmiş filtre"
            className={cn(
              // rounded-full + symmetric px-3.5 + min-w-[110px] mirrors
              // AskAiButton so the topbar pair reads as identical siblings.
              "h-9 rounded-full px-3.5 min-w-[110px] inline-flex items-center justify-center gap-2 shrink-0 shadow-sm relative transition-transform",
              "text-[13px] font-semibold tracking-tight",
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
            <HugeiconsIcon icon={FilterIcon} size={16} strokeWidth={2} />
            <span>Filtre</span>
            {activeCount > 0 && (
              <span
                className="ml-0.5 h-5 min-w-5 px-1.5 inline-flex items-center justify-center rounded-full text-[10.5px] font-bold tabular-nums"
                style={{
                  background: "white",
                  color: accent.solid,
                  boxShadow: `inset 0 0 0 1.5px ${accent.solid}, 0 2px 6px -1px ${accent.ring}`,
                }}
              >
                {activeCount}
              </span>
            )}
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        // ProjectList sits in the left column with the map on its
        // right — opening the popover to the right lets it land over
        // the map rather than the (clipped) viewport edge. Other
        // surfaces (Dashboard, Veri Yönetimi) keep the default
        // bottom-end placement.
        side={iconOnly ? "right" : "bottom"}
        align={iconOnly ? "start" : "end"}
        sideOffset={10}
        collisionPadding={12}
        className={cn(
          "w-[min(22rem,calc(100vw-1rem))] p-0 overflow-hidden flex flex-col",
          "max-h-[min(calc(100vh-120px),620px)]",
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
        {/* Header */}
        <div className="px-4 py-3 flex items-center gap-3 shrink-0 border-b border-border/40">
          <span
            className="size-9 rounded-xl grid place-items-center shrink-0 text-white shadow-sm"
            style={{
              background: accent.gradient,
              boxShadow: `0 4px 12px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
            }}
          >
            <HugeiconsIcon
              icon={FilterIcon}
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
                : "Çoklu seçim + arama"}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-3">
          {/* Dönem (period + financial year) — first section so it sets
              the time scope before the user dives into categorical
              filters. */}
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
                Varsayılan:{" "}
                {shipPlanDefault
                  ? "tüm projeler dahil"
                  : "yalnızca gemi planı olan projeler"}
              </div>
            </div>
          </label>

          {/* 1. Sefer Durumu — chip */}
          {options.voyageStatuses.length > 0 && (
            <ChipSection
              title="Sefer Durumu"
              count={filters.voyageStatuses.size}
              options={options.voyageStatuses}
              selected={filters.voyageStatuses}
              onToggle={(v) =>
                onChange({
                  ...filters,
                  voyageStatuses: toggleSet(filters.voyageStatuses, v),
                })
              }
            />
          )}

          {/* 2. Durum — chip */}
          {options.statuses.length > 0 && (
            <ChipSection
              title="Durum"
              count={filters.statuses.size}
              options={options.statuses}
              selected={filters.statuses}
              onToggle={(v) =>
                onChange({
                  ...filters,
                  statuses: toggleSet(filters.statuses, v),
                })
              }
            />
          )}

          {/* 3. Teslimat Koşulu — chip */}
          {options.incoterms.length > 0 && (
            <ChipSection
              title="Teslimat Koşulu"
              count={filters.incoterms.size}
              options={options.incoterms}
              selected={filters.incoterms}
              onToggle={(v) =>
                onChange({
                  ...filters,
                  incoterms: toggleSet(filters.incoterms, v),
                })
              }
            />
          )}

          {/* 4. Segment — combobox */}
          {options.segments.length > 0 && (
            <ComboboxSection
              title="Segment"
              count={filters.segments.size}
              options={options.segments}
              selected={filters.segments}
              onChange={(next) => onChange({ ...filters, segments: next })}
              placeholder="Tüm segmentler"
              accent={accent}
            />
          )}

          {/* 5. Trader — combobox */}
          {options.traders.length > 0 && (
            <ComboboxSection
              title="Trader"
              count={filters.traders.size}
              options={options.traders}
              selected={filters.traders}
              onChange={(next) => onChange({ ...filters, traders: next })}
              placeholder="Tüm trader'lar"
              accent={accent}
            />
          )}

          {/* 6. Şirket — combobox */}
          {options.companies.length > 0 && (
            <ComboboxSection
              title="Şirket"
              count={filters.companies.size}
              options={options.companies}
              selected={filters.companies}
              onChange={(next) => onChange({ ...filters, companies: next })}
              placeholder="Tüm şirketler"
              accent={accent}
            />
          )}

          {/* 7. Gemi — combobox */}
          {options.vessels.length > 0 && (
            <ComboboxSection
              title="Gemi"
              count={filters.vessels.size}
              options={options.vessels}
              selected={filters.vessels}
              onChange={(next) => onChange({ ...filters, vessels: next })}
              placeholder="Tüm gemiler"
              searchPlaceholder="Gemi ara…"
              accent={accent}
            />
          )}

          {/* 8. Tedarikçi — combobox */}
          {options.suppliers.length > 0 && (
            <ComboboxSection
              title="Tedarikçi"
              count={filters.suppliers.size}
              options={options.suppliers}
              selected={filters.suppliers}
              onChange={(next) => onChange({ ...filters, suppliers: next })}
              placeholder="Tüm tedarikçiler"
              searchPlaceholder="Tedarikçi ara…"
              accent={accent}
            />
          )}

          {/* 9. Müşteri / Alıcı — combobox */}
          {options.buyers.length > 0 && (
            <ComboboxSection
              title="Müşteri / Alıcı"
              count={filters.buyers.size}
              options={options.buyers}
              selected={filters.buyers}
              onChange={(next) => onChange({ ...filters, buyers: next })}
              placeholder="Tüm müşteriler"
              searchPlaceholder="Müşteri ara…"
              accent={accent}
            />
          )}

          {/* 10. Proje Grubu — combobox */}
          {options.groups.length > 0 && (
            <ComboboxSection
              title="Proje Grubu"
              count={filters.groups.size}
              options={options.groups}
              selected={filters.groups}
              onChange={(next) => onChange({ ...filters, groups: next })}
              placeholder="Tüm gruplar"
              accent={accent}
            />
          )}
        </div>

        {/* Sticky footer */}
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
            <HugeiconsIcon icon={FilterResetIcon} size={13} strokeWidth={2} />
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

/* ─────────── Helpers ─────────── */

function toggleSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

const CHIP_CLASS = cn(
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

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
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
  );
}

/* PeriodSection — period (Aylık · Çeyreklik · Yıllık · Finansal
 *  Dönem · Tüm Zamanlar) chip group + last-3-FY chip row when "fy"
 *  is active. Lives inside the AdvancedFilter popover so the time
 *  scope and categorical scope are managed in one surface. */
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
    <div className="flex flex-col gap-1.5">
      <SectionHeader
        title="Dönem"
        count={
          period === "fy" && (fyKey ?? getCurrentFyKey()) === getCurrentFyKey()
            ? 0
            : period !== "fy" || fyKey !== getCurrentFyKey()
              ? 1
              : 0
        }
      />
      <ToggleGroup
        type="single"
        value={period}
        onValueChange={(v) => {
          if (!v) return;
          const next = v as PeriodKey;
          const nextFy = next === "fy" ? fyKey ?? getCurrentFyKey() : null;
          onChange(next, nextFy);
        }}
        variant="outline"
        size="sm"
        spacing={4}
        className="flex-wrap"
      >
        {PERIODS.map((p) => (
          <ToggleGroupItem key={p.key} value={p.key} className={CHIP_CLASS}>
            {p.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {showFyOptions && (
        <div className="mt-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
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
                className={CHIP_CLASS}
              >
                {fy.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}
    </div>
  );
}

function ChipSection({
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
      <SectionHeader title={title} count={count} />
      <ToggleGroup
        type="multiple"
        value={[...selected]}
        onValueChange={(arr) => {
          // ToggleGroup multi mode replaces the entire array each
          // change — diff against `selected` to find what toggled.
          const arrSet = new Set(arr);
          for (const v of arrSet) if (!selected.has(v)) onToggle(v);
          for (const v of selected) if (!arrSet.has(v)) onToggle(v);
        }}
        variant="outline"
        size="sm"
        spacing={4}
        className="flex-wrap"
      >
        {options.map((v) => (
          <ToggleGroupItem key={v} value={v} className={CHIP_CLASS}>
            {v}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

function ComboboxSection({
  title,
  count,
  options,
  selected,
  onChange,
  placeholder,
  searchPlaceholder,
  accent,
}: {
  title: string;
  count: number;
  options: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  accent: { solid: string; ring: string; tint: string };
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <SectionHeader title={title} count={count} />
      <MultiSelectCombobox
        options={options}
        selected={selected}
        onChange={onChange}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        accent={accent}
      />
    </div>
  );
}
