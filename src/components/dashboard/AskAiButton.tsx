import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChatEdit01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { useThemeAccent } from "@/components/layout/theme-accent";

interface AskAiButtonProps {
  onClick: () => void;
  className?: string;
}

/**
 * "TYRO AI" — opens the Gemini chatbot drawer. Painted with the live
 * sidebar accent so the button visually announces the active theme:
 *   - light theme  → sky/navy gradient
 *   - navy theme   → gold gradient
 *   - black theme  → bright sky gradient
 *
 * Same gradient powers the drawer header, send button, and message
 * avatars so the entire AI surface tracks the user's theme choice.
 */
export function AskAiButton({ onClick, className }: AskAiButtonProps) {
  const [hovered, setHovered] = React.useState(false);
  const accent = useThemeAccent();
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="TYRO AI sohbetini aç"
      className={cn(
        "group relative inline-flex items-center justify-center gap-2 shrink-0",
        // min-w-[110px] mirrors DashboardFilters trigger so both topbar
        // CTAs render at exactly the same width regardless of label
        // length ("Filtre" vs "TYRO AI"). Pill shape, padding, height,
        // and font-size all match so the pair reads as identical
        // siblings on the topbar.
        "rounded-full px-3.5 min-w-[110px] h-9 text-[13px] font-semibold text-white",
        "ring-1 ring-white/15 hover:ring-white/30",
        "transition-all duration-200",
        "hover:scale-[1.04]",
        "active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "overflow-hidden",
        className
      )}
      style={{
        background: accent.gradient,
        boxShadow: `0 4px 12px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.2)`,
      }}
    >
      {/* Animated shimmer overlay on hover */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-full pointer-events-none",
          "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent",
          "before:translate-x-[-120%] before:transition-transform before:duration-700",
          hovered && "before:translate-x-[120%]"
        )}
      />
      <HugeiconsIcon
        icon={ChatEdit01Icon}
        size={16}
        strokeWidth={2}
        className={cn(
          "shrink-0 transition-transform duration-300 relative z-[1]",
          hovered ? "rotate-6 scale-110" : "rotate-0"
        )}
      />
      <span className="relative z-[1] tracking-tight">TYRO AI</span>
    </button>
  );
}
