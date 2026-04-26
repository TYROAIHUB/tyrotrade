import * as React from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { cn } from "@/lib/utils";
import { useThemeAccent } from "@/components/layout/theme-accent";

type Tone = "default" | "strong" | "subtle";

export interface BentoTileSpan {
  /** Tailwind col-span className fragment, e.g. `col-span-12 md:col-span-6 lg:col-span-3` */
  span?: string;
  /** Tailwind row-span className fragment, e.g. `row-span-2` */
  rowSpan?: string;
}

export interface BentoTileProps extends BentoTileSpan {
  /** Section eyebrow / heading shown at top */
  title?: string;
  /** Optional secondary line under title */
  subtitle?: string;
  /** HugeIcon glyph — passed straight to <HugeiconsIcon icon={...}> */
  icon?: IconSvgElement;
  /** CSS color for the icon stroke. If omitted, falls back to current theme accent. */
  iconColor?: string;
  /** Glass density for this tile */
  tone?: Tone;
  /** Override hover behavior — when false, no lift/scale */
  interactive?: boolean;
  /** Click handler */
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}

/** Stagger child variants — used by BentoGrid parent. Exported so individual
 *  tiles can be dropped into other motion contexts. */
export const tileVariants: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

/**
 * BentoTile — premium liquid-glass dashboard tile.
 *
 * Composes:
 * - `GlassPanel` for the frosted surface
 * - framer-motion `motion.div` wrapper for stagger / hover lift
 * - HugeIcon header (no background square — stroke-only, accent-tinted)
 *
 * Children render inside a relative content area below the header.
 * Use `span` and `rowSpan` to control bento placement.
 */
export function BentoTile({
  span,
  rowSpan,
  title,
  subtitle,
  icon,
  iconColor,
  tone = "default",
  interactive = true,
  onClick,
  className,
  children,
}: BentoTileProps) {
  const accent = useThemeAccent();
  const reduceMotion = useReducedMotion();
  const color = iconColor ?? accent.solid;

  const hover =
    interactive && !reduceMotion
      ? { y: -2, scale: 1.005 }
      : undefined;

  return (
    <motion.div
      variants={tileVariants}
      whileHover={hover}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      onClick={onClick}
      className={cn(
        "min-w-0 min-h-0",
        span,
        rowSpan,
        onClick && "cursor-pointer"
      )}
    >
      <GlassPanel
        tone={tone}
        className={cn(
          "h-full rounded-2xl overflow-hidden group",
          "transition-shadow duration-200",
          interactive &&
            "hover:shadow-[inset_0_0_0_1px_var(--bento-ring),var(--shadow-glass)]",
          className
        )}
        style={
          {
            // CSS var so the hover inset ring tracks theme accent live
            "--bento-ring": accent.ringStrong,
          } as React.CSSProperties
        }
      >
        <div className="p-4 flex flex-col gap-2 h-full min-w-0">
          {(title || icon) && (
            <header className="flex items-center justify-between gap-2 min-w-0">
              <div className="min-w-0 flex-1">
                {title && (
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground truncate">
                    {title}
                  </div>
                )}
                {subtitle && (
                  <div className="text-[10.5px] text-muted-foreground/80 truncate">
                    {subtitle}
                  </div>
                )}
              </div>
              {icon && (
                <HugeiconsIcon
                  icon={icon}
                  size={18}
                  strokeWidth={1.75}
                  style={{ color }}
                  className="shrink-0"
                />
              )}
            </header>
          )}
          <div className="relative flex-1 min-w-0">{children}</div>
        </div>
      </GlassPanel>
    </motion.div>
  );
}
