import { LogOut, Settings } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useThemeAccent } from "./theme-accent";

interface ProfileMenuProps {
  /** When true, render the full row with name + email beside the avatar.
   *  When false, render only the avatar circle (sidebar collapsed). */
  expanded: boolean;
}

const NAME = "Cenk Saylı";
const EMAIL = "cenk.sayli@tiryaki.com.tr";
const INITIALS = "CS";

export function ProfileMenu({ expanded }: ProfileMenuProps) {
  const accent = useThemeAccent();

  const avatar = (
    <span
      className="size-8 rounded-full grid place-items-center text-white text-[10.5px] font-semibold shrink-0 shadow-sm"
      style={{
        background: accent.gradient,
        boxShadow: `0 0 0 1.5px ${accent.ring}, 0 1px 2px rgba(0,0,0,0.18)`,
      }}
      aria-hidden
    >
      {INITIALS}
    </span>
  );

  const trigger = (
    <button
      type="button"
      aria-label="Profil menüsünü aç"
      className={cn(
        "group flex items-center rounded-xl transition-all relative shrink-0 outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--sb-active-ring)]",
        expanded
          ? "h-12 w-full px-2 gap-2.5 hover:bg-[var(--sb-hover-bg)]"
          : "h-10 w-10 justify-center px-0"
      )}
    >
      {avatar}
      {expanded && (
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-[12px] font-semibold leading-tight truncate text-[var(--sb-text)]">
            {NAME}
          </span>
          <span className="block text-[10px] leading-tight truncate text-[var(--sb-text-faint)]">
            {EMAIL}
          </span>
        </span>
      )}
    </button>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        {expanded ? (
          trigger
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent side="right">{NAME}</TooltipContent>
          </Tooltip>
        )}
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        sideOffset={12}
        className={cn(
          "w-72 p-0 overflow-hidden",
          "ring-1 ring-white/55",
          "shadow-[0_28px_70px_-14px_rgba(15,23,42,0.45)]"
        )}
      >
        <div className="relative px-4 py-3 border-b border-white/30 flex items-center gap-3">
          <span
            className="size-11 rounded-full grid place-items-center text-white text-sm font-semibold shrink-0 shadow-sm"
            style={{
              background: accent.gradient,
              boxShadow: `0 0 0 2px ${accent.ring}, 0 1px 2px rgba(0,0,0,0.08)`,
            }}
          >
            {INITIALS}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{NAME}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {EMAIL}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              TYRO International Trade
            </div>
          </div>
        </div>
        <div className="p-1.5">
          <button
            type="button"
            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-foreground/80 hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
          >
            <Settings className="size-4" />
            Hesap Ayarları
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-rose-700 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="size-4" />
            Çıkış Yap
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
