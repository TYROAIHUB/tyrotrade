import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYRO_AI_SUGGESTIONS } from "@/lib/ai/systemPrompt";

interface ChatSuggestionsProps {
  onPick: (prompt: string, label: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Welcome-state quick prompts. Each chip is a full-width button that
 * fires a pre-canned Turkish prompt from `TYRO_AI_SUGGESTIONS` when
 * tapped — so the user can kick the tyres without typing anything.
 */
export function ChatSuggestions({
  onPick,
  disabled,
  className,
}: ChatSuggestionsProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {TYRO_AI_SUGGESTIONS.map((s) => (
        <button
          key={s.label}
          type="button"
          disabled={disabled}
          onClick={() => onPick(s.prompt, s.label)}
          className={cn(
            "group w-full text-left rounded-2xl px-4 py-3",
            "border border-border/50 bg-white/80 hover:bg-white/95",
            "text-[13px] text-foreground/85 hover:text-foreground",
            "shadow-[0_1px_2px_0_rgba(15,23,42,0.04),0_4px_14px_-8px_rgba(15,23,42,0.12)]",
            "transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
            "flex items-center justify-between gap-2"
          )}
        >
          <span className="truncate">{s.label}</span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </button>
      ))}
    </div>
  );
}
