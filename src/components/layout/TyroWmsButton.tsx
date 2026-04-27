import * as React from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";

interface TyroWmsButtonProps {
  className?: string;
}

/**
 * Sister-app shortcut — opens TYROWMS (warehouse management) in a new
 * tab. Mirrors the visual proportions of `AskAiButton` so the topbar
 * stays balanced, but with a white pill background so the
 * aurora-coloured "wms" text + origami logo pop.
 *
 *   - Logo: same origami T mark, aurora palette (blue→purple→cyan)
 *   - Wordmark: "tyro" black + "wms" aurora gradient (matches the
 *     official tyrowms.github.io brand)
 */
export function TyroWmsButton({ className }: TyroWmsButtonProps) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <a
      href="https://tyrowms.github.io/"
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group relative inline-flex items-center gap-2 shrink-0",
        "rounded-full pl-2 pr-3.5 h-9 text-[13px] font-semibold lowercase",
        "ring-1 ring-foreground/10 hover:ring-foreground/20",
        "transition-all duration-200 hover:scale-[1.04] active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "overflow-hidden",
        className
      )}
      // Triple-layer shadow + 1px border keeps the white pill legible on every
      // sidebar tone (light/navy/black). Without the hard 1px under-shadow the
      // edges dissolve on white topbars; without the inset highlight the pill
      // looks flat. Border is a slate hairline at 8% opacity — visible but
      // never harsh.
      style={{
        background: "white",
        color: "#0f172a",
        border: "1px solid rgba(15,23,42,0.08)",
        boxShadow:
          "0 1px 2px 0 rgba(15,23,42,0.08), 0 4px 14px -4px rgba(15,23,42,0.22), inset 0 1px 0 0 rgba(255,255,255,0.85)",
      }}
      aria-label="TYROWMS uygulamasını aç"
    >
      {/* Animated shimmer overlay on hover */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-full pointer-events-none",
          "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-sky-200/40 before:to-transparent",
          "before:translate-x-[-120%] before:transition-transform before:duration-700",
          hovered && "before:translate-x-[120%]"
        )}
      />
      <Logo size={20} palette="aurora" className="relative z-[1]" />
      <span className="relative z-[1] tracking-tight">
        <span className="text-slate-900">tyro</span>
        <span
          style={{
            background:
              "linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #06b6d4 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            fontWeight: 700,
          }}
        >
          wms
        </span>
      </span>
    </a>
  );
}
