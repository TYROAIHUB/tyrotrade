import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChatEdit01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { TONE_AI } from "@/components/details/AccentIconBadge";

interface AskAiButtonProps {
  onClick: () => void;
  className?: string;
}

/**
 * "TYRO AI" — opens the Gemini chatbot drawer. Painted with the shared
 * `TONE_AI` emerald-teal gradient so the topbar button, the Settings
 * card icon, and the drawer avatar all read as the same product
 * surface. Theme-stable: the AI gradient stays put across light/navy/
 * black sidebar themes (reads consistently as a "premium AI" CTA).
 */
export function AskAiButton({ onClick, className }: AskAiButtonProps) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="TYRO AI sohbetini aç"
      className={cn(
        "group relative inline-flex items-center gap-2 shrink-0",
        "rounded-full px-3.5 h-9 text-[13px] font-semibold text-white",
        "ring-1 ring-white/15 hover:ring-white/30",
        "transition-all duration-200",
        "hover:scale-[1.04]",
        "active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "overflow-hidden",
        className
      )}
      style={{
        background: TONE_AI.gradient,
        boxShadow: `0 4px 12px -4px ${TONE_AI.ring}, inset 0 1px 0 0 rgba(255,255,255,0.2)`,
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
