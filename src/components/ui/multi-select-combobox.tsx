import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface MultiSelectComboboxProps {
  /** Plain string options. The component handles its own search. */
  options: string[];
  /** Currently-selected values (Set for O(1) toggle). */
  selected: Set<string>;
  /** Callback receives the next Set when toggled. */
  onChange: (next: Set<string>) => void;
  /** Placeholder shown when nothing is selected. */
  placeholder?: string;
  /** Search input placeholder. */
  searchPlaceholder?: string;
  /** Empty state copy when search returns nothing. */
  emptyText?: string;
  /** Theme accent for the active-state colours. */
  accent: { solid: string; ring: string; tint: string };
  className?: string;
  triggerClassName?: string;
  /** Optional max-height override on the list (default 240px). */
  maxListHeight?: number;
}

/**
 * Searchable multi-select combobox built on cmdk + Popover. Matches the
 * Advanced Filter visual language: chip-style trigger that shows the
 * selection count, popover content with a search input, scrollable
 * checklist of options, and a "Clear" affordance when items are
 * selected. Selected items render as removable mini-chips inside the
 * trigger up to 2 rows so the user can see what they picked without
 * opening the popover.
 */
export function MultiSelectCombobox({
  options,
  selected,
  onChange,
  placeholder = "Hepsi",
  searchPlaceholder = "Ara…",
  emptyText = "Sonuç bulunamadı",
  accent,
  className,
  triggerClassName,
  maxListHeight = 240,
}: MultiSelectComboboxProps) {
  const [open, setOpen] = React.useState(false);

  function toggle(value: string) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  }

  function clearAll() {
    onChange(new Set());
  }

  const count = selected.size;
  const hasSelection = count > 0;

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            className={cn(
              "w-full min-h-9 rounded-lg border bg-background/80",
              "px-2.5 py-1.5 text-left text-[12px]",
              "flex flex-wrap items-center gap-1.5",
              "transition-colors hover:bg-foreground/[0.03]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              hasSelection
                ? "border-foreground/20"
                : "border-input border-dashed",
              triggerClassName
            )}
            style={
              hasSelection
                ? { borderColor: accent.ring, boxShadow: `0 0 0 1px ${accent.ring}` }
                : undefined
            }
          >
            {hasSelection ? (
              <>
                {/* Up to 3 chips inline; +N more when overflow */}
                {[...selected].slice(0, 3).map((v) => (
                  <span
                    key={v}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold max-w-[160px]"
                    style={{
                      backgroundColor: accent.tint,
                      color: accent.solid,
                      boxShadow: `inset 0 0 0 1px ${accent.ring}`,
                    }}
                  >
                    <span className="truncate">{v}</span>
                    <X
                      className="size-2.5 shrink-0 opacity-70 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(v);
                      }}
                    />
                  </span>
                ))}
                {selected.size > 3 && (
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-bold tabular-nums"
                    style={{
                      backgroundColor: accent.solid,
                      color: "white",
                    }}
                  >
                    +{selected.size - 3}
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground/85 truncate">
                {placeholder}
              </span>
            )}
            <ChevronsUpDown className="ml-auto size-3.5 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={4}
          className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[240px]"
        >
          <Command shouldFilter>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList style={{ maxHeight: maxListHeight }}>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => {
                  const isSelected = selected.has(opt);
                  return (
                    <CommandItem
                      key={opt}
                      value={opt}
                      onSelect={() => toggle(opt)}
                      className="cursor-pointer"
                    >
                      <span
                        className="size-4 rounded-[5px] grid place-items-center shrink-0 transition-colors"
                        style={{
                          backgroundColor: isSelected ? accent.solid : "transparent",
                          boxShadow: `inset 0 0 0 1.5px ${
                            isSelected ? accent.solid : "rgba(15,23,42,0.25)"
                          }`,
                        }}
                      >
                        {isSelected && (
                          <Check className="size-3 text-white" strokeWidth={3} />
                        )}
                      </span>
                      <span className="truncate text-foreground/90">{opt}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {hasSelection && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={clearAll}
                      className="cursor-pointer text-rose-600 hover:text-rose-700"
                    >
                      <X className="size-3.5 mr-1.5" />
                      <span>Tümünü temizle ({count})</span>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
