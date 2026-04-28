import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  type IconBadgeTone,
} from "@/components/details/AccentIconBadge";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { cn } from "@/lib/utils";

/* ─────────── KPI identifier union ─────────── */

export type KpiId =
  | "period"
  | "pl"
  | "quantity"
  | "expense"
  | "pipeline"
  | "currency"
  | "corridor"
  | "velocity"
  | "counterparty";

/* ─────────── Drawer chrome ─────────── */

interface KpiDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Header label (e.g. "Tahmini Gider"). */
  title: string;
  /** Optional subtitle (e.g. "USD · 95 proje"). */
  subtitle?: string;
  /** Icon glyph for the header pill. */
  icon?: IconSvgElement;
  /** Header pill colour — usually the same tone the source tile uses. */
  iconTone?: IconBadgeTone;
  children?: React.ReactNode;
}

/**
 * Right-side detail drawer for the dashboard KPI tiles. Shares the
 * floating-glass dialect with TyroAiDrawer (rounded-l-3xl, opaque
 * white, theme accent strip on top). Body is a ScrollArea — each
 * KPI's own breakdown component renders into `children`.
 */
export function KpiDetailDrawer({
  open,
  onOpenChange,
  title,
  subtitle,
  icon,
  iconTone,
  children,
}: KpiDetailDrawerProps) {
  const accent = useThemeAccent();
  // Header tone defaults to the live sidebar accent so each drawer's
  // chrome syncs with the tile that opened it (each tile passes its
  // own tone here when it has a fixed semantic colour).
  const tone = iconTone ?? {
    gradient: accent.gradient,
    ring: accent.ring,
    solid: accent.solid,
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "w-full sm:max-w-[480px] p-0 flex flex-col gap-0",
          "bg-white/95 backdrop-blur-2xl backdrop-saturate-150",
          "border-l border-border/60",
          "shadow-[0_30px_80px_-16px_rgba(15,23,42,0.45)]"
        )}
        aria-describedby={undefined}
      >
        {/* Top accent bar — instantly identifies which KPI the drawer
            is showing through its tone colour. */}
        <div
          aria-hidden
          className="h-1 w-full shrink-0"
          style={{ background: tone.gradient }}
        />

        {/* Header */}
        <div className="px-5 py-4 flex items-center gap-3 shrink-0 border-b border-border/40">
          {icon && (
            <span
              className="size-10 rounded-xl grid place-items-center shrink-0 shadow-sm text-white"
              style={{
                background: tone.gradient,
                boxShadow: `0 4px 12px -4px ${tone.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
              }}
            >
              <HugeiconsIcon icon={icon} size={18} strokeWidth={1.75} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-[16px] font-semibold tracking-tight leading-tight">
              {title}
            </SheetTitle>
            {subtitle && (
              <SheetDescription className="text-[12px] text-muted-foreground leading-tight mt-0.5">
                {subtitle}
              </SheetDescription>
            )}
          </div>
        </div>

        {/* Body */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-3 py-3">{children}</div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

/* ─────────── Reusable group / row primitives ─────────── */

/**
 * Header for a group of project rows (e.g. "Commenced · 11" inside the
 * Pipeline drawer). Optional value chip on the right for the group's
 * total metric.
 */
export function KpiGroupHeader({
  label,
  count,
  valueChip,
  toneColor,
}: {
  label: string;
  count: number;
  valueChip?: React.ReactNode;
  /** Optional dot colour to make the group identifiable. */
  toneColor?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-1.5 mt-3 first:mt-0 px-2">
      {toneColor && (
        <span
          className="size-2 rounded-full shrink-0"
          style={{ backgroundColor: toneColor }}
        />
      )}
      <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-foreground/75">
        {label}
      </span>
      <span className="text-[10px] tabular-nums text-muted-foreground">
        {count}
      </span>
      <div className="flex-1" />
      {valueChip}
    </div>
  );
}

/**
 * Single project row inside the drawer body. Click → close drawer +
 * navigate to the Vessel Projects page with that project filtered
 * down to a single-project list AND selected. The `state` payload is
 * read by `ProjectsPage` once on mount/transition.
 */
export function KpiProjectRow({
  projectNo,
  projectName,
  vesselName,
  metric,
  metricColor,
  onClose,
}: {
  projectNo: string;
  projectName?: string;
  vesselName?: string;
  /** Right-aligned headline metric (e.g. "$1.2M", "+%8.4", "12 gün"). */
  metric?: string;
  /** Optional metric tint (semantic colour for positive/negative). */
  metricColor?: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => {
        onClose();
        navigate(`/projects/${projectNo}`, {
          state: { focusProjectNo: projectNo },
        });
      }}
      className={cn(
        "w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left",
        "hover:bg-foreground/[0.04] transition-colors group"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="font-mono text-[11px] tabular-nums text-foreground/65 shrink-0">
            {projectNo}
          </span>
          {projectName && (
            <span className="text-[12px] font-medium text-foreground truncate">
              {projectName}
            </span>
          )}
        </div>
        {vesselName && (
          <div className="text-[10.5px] text-muted-foreground truncate mt-0.5">
            Gemi: {vesselName}
          </div>
        )}
      </div>
      {metric && (
        <span
          className="shrink-0 text-[12px] font-semibold tabular-nums"
          style={metricColor ? { color: metricColor } : undefined}
        >
          {metric}
        </span>
      )}
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
    </button>
  );
}

/** Empty-state placeholder for KPI views with no rows. */
export function KpiEmptyState({ message }: { message: string }) {
  return (
    <div className="text-center text-[12px] text-muted-foreground/70 py-8 px-4">
      {message}
    </div>
  );
}
