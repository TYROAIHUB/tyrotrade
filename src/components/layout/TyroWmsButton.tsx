import * as React from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";

interface TyroWmsButtonProps {
  className?: string;
}

/**
 * Sister-app shortcut — opens TYROWMS (warehouse management) in a new
 * tab. Mirrors `AskAiButton`'s pill proportions but wears the official
 * tyrowms.github.io aurora gradient (sky-blue → violet → cyan) so the
 * two AI/WMS buttons read as a colour pair on the topbar.
 *
 *   - Background: aurora gradient (vibrant identity)
 *   - Logo: same origami T mark, white-on-color so it pops
 *   - Wordmark: "tyrowms" in solid white, font-bold tracks tighter
 */

const AURORA_GRADIENT =
  "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #06b6d4 100%)";
const AURORA_RING = "rgba(99, 102, 241, 0.55)";

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
        "rounded-full pl-2 pr-3.5 h-9 text-[13px] font-semibold lowercase text-white",
        "ring-1 ring-white/20 hover:ring-white/40",
        "transition-all duration-200 hover:scale-[1.04] active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "overflow-hidden",
        className
      )}
      style={{
        background: AURORA_GRADIENT,
        boxShadow: `0 4px 14px -4px ${AURORA_RING}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
      }}
      aria-label="TYROWMS uygulamasını aç"
    >
      {/* Animated shimmer overlay on hover */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-full pointer-events-none",
          "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/35 before:to-transparent",
          "before:translate-x-[-120%] before:transition-transform before:duration-700",
          hovered && "before:translate-x-[120%]"
        )}
      />
      {/* Origami T sits inside a white badge so it stays legible against
          the aurora — the Logo's own palettes can't outpunch the
          background gradient otherwise. */}
      <span className="relative z-[1] size-6 rounded-full grid place-items-center bg-white/95 shrink-0 shadow-sm">
        <Logo size={16} palette="aurora" />
      </span>
      <span className="relative z-[1] tracking-tight">
        <span className="text-white">tyro</span>
        <span className="text-white font-bold">wms</span>
      </span>
    </a>
  );
}
