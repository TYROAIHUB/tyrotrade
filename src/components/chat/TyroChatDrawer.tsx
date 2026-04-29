import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { BubbleChatIcon } from "@hugeicons/core-free-icons";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { TYRO_CHAT_TONE } from "@/components/layout/TyroChatButton";
import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_COPILOT_CHAT_URL } from "@/lib/settings/userSettings";
import { cn } from "@/lib/utils";

interface TyroChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Right-side drawer that hosts the Copilot Studio agent as an iframe.
 *
 * Same chrome dialect as `TyroAiDrawer` (rounded-l-3xl, top accent
 * strip, opaque white surface) so the two AI surfaces feel like
 * siblings — only the tone palette differs (indigo-violet here vs.
 * live theme accent for Gemini).
 *
 * Iframe takes the whole body (no padding) so the embedded webchat
 * can use every pixel; the drawer chrome handles framing.
 */
export function TyroChatDrawer({ open, onOpenChange }: TyroChatDrawerProps) {
  const { settings } = useSettings();
  // Defensive fallback: even if `readSettings` somehow returns an empty
  // override (e.g. malformed JSON), default to the bound TYRO agent so
  // the drawer never opens to a blank iframe.
  const url =
    (settings.copilotChatUrl ?? "").trim() || DEFAULT_COPILOT_CHAT_URL;

  // Lazy-mount the iframe — only renders after the user opens the
  // drawer the first time, then stays mounted so subsequent re-opens
  // skip the cold-start handshake. This avoids paying the Copilot
  // Studio bootstrap cost on every dashboard load.
  const [hasOpened, setHasOpened] = React.useState(false);
  React.useEffect(() => {
    if (open) setHasOpened(true);
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          // overflow-hidden so the top accent strip clips into the
          // rounded-l-3xl corner cleanly (same fix as KpiDetailDrawer
          // and TyroAiDrawer).
          "w-full sm:max-w-[460px] p-0 flex flex-col gap-0 overflow-hidden",
          "bg-white/95 backdrop-blur-2xl backdrop-saturate-150",
          "border-l border-border/60",
          "shadow-[0_30px_80px_-16px_rgba(15,23,42,0.45)]"
        )}
        aria-describedby={undefined}
      >
        {/* Top accent bar — instant visual ID (indigo-violet) */}
        <div
          aria-hidden
          className="h-1 w-full shrink-0"
          style={{ background: TYRO_CHAT_TONE.gradient }}
        />

        {/* Header */}
        <div className="px-5 py-4 flex items-center gap-3 shrink-0 border-b border-border/40">
          <span
            className="size-10 rounded-xl grid place-items-center shrink-0 shadow-sm text-white"
            style={{
              background: TYRO_CHAT_TONE.gradient,
              boxShadow: `0 4px 12px -4px ${TYRO_CHAT_TONE.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
            }}
          >
            <HugeiconsIcon icon={BubbleChatIcon} size={18} strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-[16px] font-semibold tracking-tight leading-tight">
              TYRO Chat
            </SheetTitle>
            <SheetDescription className="text-[12px] text-muted-foreground leading-tight mt-0.5">
              Copilot Studio asistanı
            </SheetDescription>
          </div>
        </div>

        {/* Iframe body — Copilot Studio renders its own dark teal
            "TYRO Project MCP Agent" banner at the top, which duplicates
            our drawer header. We can't touch its DOM (cross-origin),
            and shifting the iframe with negative offsets broke the
            internal flex layout (chat container stopped filling the
            extended height). Cleanest fix: keep the iframe at natural
            size and paint a matching-white overlay on top so the banner
            is visually masked while the chat layout below stays
            untouched. */}
        <div className="flex-1 min-h-0 bg-white relative">
          {hasOpened ? (
            <>
              <iframe
                // `key` ensures we re-mount when the user changes the URL
                // from Settings — otherwise the old src stays cached.
                key={url}
                src={url}
                title="TYRO Chat — Copilot Studio agent"
                className="w-full h-full border-0"
                allow="microphone; clipboard-read; clipboard-write"
                referrerPolicy="strict-origin-when-cross-origin"
              />
              {/* Mask over the agent's banner — same white bg as the
                  body so it disappears into the drawer chrome. Adjust
                  height if Microsoft changes the banner thickness. */}
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 bg-white pointer-events-none"
                style={{ height: 56 }}
              />
            </>
          ) : (
            <div className="h-full grid place-items-center text-[12px] text-muted-foreground">
              Yükleniyor…
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
