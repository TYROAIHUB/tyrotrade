import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

interface CommandPaletteTriggerProps {
  onOpen: () => void;
  className?: string;
}

/**
 * Header search trigger — collapsed circle icon by default, expands to a wide
 * pill ("Ara…" label) on hover/focus. Click opens the CommandPalette modal.
 *
 * Two interaction layers:
 *   - hover/focus → expands width, reveals label
 *   - click       → fires `onOpen` to mount the modal
 */
export function CommandPaletteTrigger({
  onOpen,
  className,
}: CommandPaletteTriggerProps) {
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const expanded = hovered || focused;

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      aria-label="Aramayı aç"
      className={cn(
        "group relative inline-flex items-center shrink-0 overflow-hidden",
        "h-9 rounded-xl text-[12.5px] font-medium text-muted-foreground",
        // Frosted glass surface
        "backdrop-blur-md backdrop-saturate-150",
        "bg-white/55 hover:bg-white/80",
        "ring-1 ring-foreground/10 hover:ring-foreground/20",
        "shadow-[0_1px_0_0_rgba(255,255,255,0.7)_inset,0_1px_2px_rgba(15,23,42,0.04)]",
        "transition-[width,background-color,box-shadow] duration-250 ease-out",
        "active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        expanded ? "w-44 pl-3 pr-3 gap-2" : "w-9 justify-center",
        className
      )}
    >
      <HugeiconsIcon
        icon={Search01Icon}
        size={15}
        strokeWidth={2.25}
        className={cn(
          "shrink-0 transition-colors",
          expanded ? "text-foreground/75" : "text-foreground/65"
        )}
      />
      <span
        className={cn(
          "tracking-tight whitespace-nowrap transition-[opacity,max-width] duration-200 ease-out",
          expanded
            ? "opacity-100 max-w-32 delay-75"
            : "opacity-0 max-w-0 pointer-events-none"
        )}
      >
        Ara…
      </span>
    </button>
  );
}
