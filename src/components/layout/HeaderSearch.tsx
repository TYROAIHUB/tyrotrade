import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderSearchProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  shortcut?: string;
  /** Expanded width when open. */
  expandedWidth?: string;
}

/**
 * Expanding search — collapsed state is a small circular icon button. Click
 * (or Cmd/Ctrl+K) expands it into a full input with focus. Blur on empty or
 * Escape collapses it back. Inspired by Stripe/Linear/Vercel header search.
 */
export function HeaderSearch({
  placeholder = "Proje, gemi, liman ara...",
  value: controlledValue,
  onChange,
  className,
  shortcut,
  expandedWidth = "w-72",
}: HeaderSearchProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState("");
  const value = controlledValue ?? internalValue;
  const isControlled = controlledValue !== undefined;

  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const isMac = React.useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /mac|iphone|ipod|ipad/i.test(navigator.platform);
  }, []);
  const shortcutLabel = shortcut ?? (isMac ? "⌘K" : "Ctrl K");

  const setValue = React.useCallback(
    (v: string) => {
      if (!isControlled) setInternalValue(v);
      onChange?.(v);
    },
    [isControlled, onChange]
  );

  const expand = React.useCallback(() => {
    setExpanded(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  const collapse = React.useCallback(() => {
    setExpanded(false);
    inputRef.current?.blur();
  }, []);

  // Cmd/Ctrl+K → expand + focus
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        expand();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isMac, expand]);

  // Click outside collapses (only if empty)
  React.useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        !value
      ) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expanded, value]);

  return (
    <div
      ref={containerRef}
      onClick={() => !expanded && expand()}
      className={cn(
        "group relative flex items-center shrink-0 overflow-hidden",
        "transition-[width,border-radius,background-color,box-shadow] duration-250 ease-out",
        "ring-1 ring-inset ring-border/70 bg-card/70 backdrop-blur-sm shadow-xs",
        expanded
          ? cn(expandedWidth, "rounded-xl focus-within:ring-2 focus-within:ring-ring/80 focus-within:bg-card/85")
          : "size-9 rounded-full cursor-pointer hover:bg-card/95 hover:ring-border",
        className
      )}
      role={expanded ? undefined : "button"}
      aria-label={expanded ? undefined : "Aramayı aç"}
      tabIndex={expanded ? -1 : 0}
      onKeyDown={(e) => {
        if (!expanded && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          expand();
        }
      }}
    >
      <Search
        className={cn(
          "shrink-0 size-4 text-muted-foreground/85 stroke-[2.25px] transition-all duration-200",
          expanded ? "ml-3" : "mx-auto"
        )}
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            setValue("");
            collapse();
          }
        }}
        onBlur={() => {
          if (!value) setExpanded(false);
        }}
        tabIndex={expanded ? 0 : -1}
        aria-hidden={!expanded}
        className={cn(
          "h-9 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/80",
          "transition-[opacity,padding] duration-200 ease-out",
          expanded
            ? "opacity-100 pl-2 pr-16 flex-1 min-w-0"
            : "opacity-0 w-0 p-0 pointer-events-none"
        )}
      />
      {/* Shortcut hint with gradient fade — only when expanded */}
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0.5 right-0.5 hidden md:flex items-center pl-8 pr-1.5 rounded-r-[inherit]",
          "bg-gradient-to-r from-transparent via-card/60 to-card to-50%",
          "transition-opacity duration-200",
          expanded ? "opacity-100 delay-150" : "opacity-0"
        )}
      >
        <kbd
          aria-hidden
          className={cn(
            "select-none rounded-md px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground",
            "ring-1 ring-inset ring-border/70 bg-background/80 tracking-tight"
          )}
        >
          {shortcutLabel}
        </kbd>
      </div>
    </div>
  );
}
