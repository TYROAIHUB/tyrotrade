import * as React from "react";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { cn } from "@/lib/utils";

/** Single icon-pill color — gradient + matching shadow ring tint. */
export interface IconBadgeTone {
  /** CSS background gradient (e.g. `linear-gradient(...)`). */
  gradient: string;
  /** rgba color for outer drop-shadow. */
  ring: string;
}

interface AccentIconBadgeProps {
  /** Icon node — HugeIcon or lucide icon. The badge sets `color: white`
   *  so stroke icons render white automatically. */
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  /** Optional fixed-color override. When omitted, the badge follows the
   *  live sidebar theme via `useThemeAccent` (used by AppShell page
   *  headers, project list filter pill, etc). When provided, the colors
   *  stay locked to that tone — use this for content-semantic icons
   *  like cargo (amber), expense (rose), or vessel (sea/road). */
  tone?: IconBadgeTone;
  className?: string;
}

const SIZE_TOKENS = {
  sm: "size-7 rounded-lg", // 28px
  md: "size-9 rounded-xl", // 36px — matches AppShell PageTitleSlot
  lg: "size-10 rounded-xl", // 40px — hero overlays
} as const;

/**
 * Stroke-icon pill with gradient background. Shared visual language with
 * `AppShell.PageTitleSlot`. Defaults to the active sidebar accent; pass
 * `tone` to lock the colors to a content-semantic palette.
 */
export function AccentIconBadge({
  children,
  size = "md",
  tone,
  className,
}: AccentIconBadgeProps) {
  const accent = useThemeAccent();
  const effectiveTone = tone ?? {
    gradient: accent.gradient,
    ring: accent.ring,
  };
  return (
    <span
      className={cn(
        "grid place-items-center shrink-0 shadow-sm text-white",
        SIZE_TOKENS[size],
        className
      )}
      style={{
        background: effectiveTone.gradient,
        boxShadow: `0 4px 12px -4px ${effectiveTone.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
      }}
    >
      {children}
    </span>
  );
}

/* ─────────── Shared content-semantic tones ─────────── */

/** Wheat / cargo — amber gold. */
export const TONE_CARGO: IconBadgeTone = {
  gradient: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 55%, #b45309 100%)",
  ring: "rgba(217, 119, 6, 0.55)",
};

/** Estimated expense — rose / muted red. */
export const TONE_EXPENSE: IconBadgeTone = {
  gradient: "linear-gradient(135deg, #fb7185 0%, #f43f5e 55%, #be123c 100%)",
  ring: "rgba(244, 63, 94, 0.55)",
};

/** Sea voyage — ocean blue. */
export const TONE_SEA: IconBadgeTone = {
  gradient: "linear-gradient(135deg, #38bdf8 0%, #0284c7 55%, #075985 100%)",
  ring: "rgba(2, 132, 199, 0.55)",
};

/** Road / truck — warm amber-orange. */
export const TONE_ROAD: IconBadgeTone = {
  gradient: "linear-gradient(135deg, #fb923c 0%, #ea580c 55%, #9a3412 100%)",
  ring: "rgba(234, 88, 12, 0.55)",
};

/** Profit & loss — emerald → teal, signals financial gain/loss. */
export const TONE_PL: IconBadgeTone = {
  gradient: "linear-gradient(135deg, #34d399 0%, #10b981 55%, #047857 100%)",
  ring: "rgba(16, 185, 129, 0.55)",
};
