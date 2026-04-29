import * as React from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { useThemeAccent } from "@/components/layout/theme-accent";

interface RefreshAllButtonProps {
  /** Async functions to invoke sequentially. Each one returns when its fetch
   *  + cache write are complete. */
  steps: Array<{ label: string; refetch: () => Promise<void> }>;
  className?: string;
}

/**
 * Premium gradient refresh button — visually mirrors `AskAiButton` so the two
 * primary call-to-actions feel like a coherent pair (one pulls fresh data,
 * the other talks to the AI). Sky-navy theme accent gradient, animated
 * shimmer on hover, icon spins while busy.
 *
 * Idle label: "Güncelle". While running: "<currentEntity>… X/N".
 */
export function RefreshAllButton({
  steps,
  className,
}: RefreshAllButtonProps) {
  const accent = useThemeAccent();
  const [hovered, setHovered] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [currentLabel, setCurrentLabel] = React.useState("");
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });

  async function refreshAll() {
    if (busy) return;
    setBusy(true);
    setProgress({ done: 0, total: steps.length });
    const startedAt = Date.now();
    let failedStep: string | null = null;
    let failureMessage: string | null = null;
    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        setCurrentLabel(step.label);
        try {
          await step.refetch();
        } catch (err) {
          failedStep = step.label;
          failureMessage = err instanceof Error ? err.message : String(err);
          break;
        }
        setProgress({ done: i + 1, total: steps.length });
      }
    } finally {
      setBusy(false);
      setCurrentLabel("");
    }
    // Toast surfaces the final outcome — same dialect as the post-login
    // auto-refresh so users get a consistent signal regardless of which
    // path triggered the update.
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    if (failedStep) {
      toast.error("Veri güncelleme başarısız", {
        description: `${failedStep} adımında hata${failureMessage ? `: ${failureMessage.slice(0, 120)}` : ""}`,
      });
    } else {
      toast.success("Veriler güncellendi", {
        description: `${steps.length} adım · ${seconds} sn`,
      });
    }
  }

  const label = busy
    ? `${currentLabel}… ${progress.done}/${progress.total}`
    : "Güncelle";

  return (
    <button
      type="button"
      onClick={refreshAll}
      disabled={busy}
      data-testid="refresh-all-button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group relative inline-flex items-center gap-2 shrink-0 self-center",
        "rounded-full px-3.5 h-9 text-[13px] font-semibold text-white",
        "ring-1 ring-white/15 hover:ring-white/30",
        "transition-all duration-200",
        "hover:scale-[1.04]",
        "active:scale-95",
        "disabled:opacity-85 disabled:cursor-wait disabled:hover:scale-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "overflow-hidden whitespace-nowrap min-w-[120px] justify-center",
        className
      )}
      style={{
        background: accent.gradient,
        boxShadow: `0 4px 12px -4px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.2)`,
      }}
    >
      {/* Animated shimmer overlay on hover (skipped while busy) */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-full pointer-events-none",
          "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent",
          "before:translate-x-[-120%] before:transition-transform before:duration-700",
          hovered && !busy && "before:translate-x-[120%]"
        )}
      />
      <HugeiconsIcon
        icon={RefreshIcon}
        size={16}
        strokeWidth={2}
        className={cn(
          "shrink-0 relative z-[1] transition-transform duration-300",
          busy
            ? "animate-spin"
            : hovered
              ? "rotate-[120deg] scale-110"
              : "rotate-0"
        )}
      />
      <span className="relative z-[1] tracking-tight">{label}</span>
    </button>
  );
}
