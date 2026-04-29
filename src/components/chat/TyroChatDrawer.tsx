import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { BubbleChatIcon, Robot01Icon } from "@hugeicons/core-free-icons";
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

/** TYRO ticaret domain'ine özel hazır sorular — kullanıcının verdiği
 *  TYRO AI mock'undaki dile göre. Cross-origin iframe nedeniyle bu
 *  metinleri agent'a doğrudan gönderemediğimiz için chip click →
 *  panoya kopyala + toast şeklinde çalışıyor; kullanıcı aşağıdaki
 *  iframe input'una Ctrl+V ile yapıştırıp gönderiyor. */
const SUGGESTIONS: string[] = [
  "Şu an yolda olan gemiler",
  "Bu hafta milestone'u olan projeler",
  "En karlı 3 segment ve durumu",
  "Risk altındaki düşük marjlı projeler",
];

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

  // Welcome overlay shown ON TOP of the iframe until the user picks a
  // suggestion or explicitly dismisses it. Once dismissed it stays
  // hidden for the rest of the session (state persists while the
  // drawer is mounted). Cross-origin iframe → chip clicks copy the
  // text to clipboard so the user can paste it into the agent's own
  // input box; we can't postMessage into the iframe directly.
  const [overlayVisible, setOverlayVisible] = React.useState(true);

  async function handleSuggestionClick(text: string) {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (copied) {
      toast.success("Soru panoya kopyalandı", {
        description:
          "Aşağıdaki kutuya yapıştırıp gönder (Ctrl+V / ⌘V)",
      });
    } else {
      toast.message("Sorgu hazır", {
        description: text,
      });
    }
    setOverlayVisible(false);
  }

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
              Uluslararası ticaret asistanı
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

              {/* Welcome overlay — rendered ON TOP of the iframe with
                  the same dialect as TyroAiDrawer (robot icon, intro
                  copy, suggestion chips). Disappears once the user
                  picks a suggestion or hits the dismiss link. */}
              <AnimatePresence>
                {overlayVisible && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.18 } }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className={cn(
                      "absolute inset-0 z-10 flex flex-col items-center",
                      "px-5 pt-12 pb-4 gap-5",
                      "bg-white/97 backdrop-blur-sm"
                    )}
                  >
                    {/* Robot icon pill (indigo TYRO Chat tone) */}
                    <span
                      className="size-14 rounded-2xl grid place-items-center shadow-sm text-white"
                      style={{
                        background: TYRO_CHAT_TONE.gradient,
                        boxShadow: `0 6px 18px -4px ${TYRO_CHAT_TONE.ring}, inset 0 1px 0 0 rgba(255,255,255,0.30)`,
                      }}
                    >
                      <HugeiconsIcon
                        icon={Robot01Icon}
                        size={26}
                        strokeWidth={1.75}
                      />
                    </span>

                    {/* Title + intro */}
                    <div className="text-center">
                      <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">
                        Nasıl yardımcı olabilirim?
                      </h3>
                      <p className="text-[12px] text-muted-foreground mt-1 leading-snug max-w-[300px]">
                        Aşağıdaki örneklerden biriyle başla — soru
                        panoya kopyalanır, sohbet kutusuna yapıştırıp
                        gönderebilirsin.
                      </p>
                    </div>

                    {/* Suggestion chips */}
                    <div className="w-full flex flex-col gap-2 max-w-[360px]">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleSuggestionClick(s)}
                          className={cn(
                            "group w-full flex items-center justify-between gap-3",
                            "px-3.5 py-2.5 rounded-xl text-left",
                            "bg-white/85 hover:bg-white",
                            "border border-foreground/10 hover:border-indigo-300",
                            "transition-all hover:scale-[1.01] active:scale-[0.99]",
                            "shadow-[0_2px_6px_-2px_rgba(15,23,42,0.06)]"
                          )}
                        >
                          <span className="text-[12.5px] font-medium text-slate-800 leading-snug">
                            {s}
                          </span>
                          <ChevronRight className="size-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
                        </button>
                      ))}
                    </div>

                    {/* Dismiss link */}
                    <button
                      type="button"
                      onClick={() => setOverlayVisible(false)}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors mt-auto"
                    >
                      Atlayıp doğrudan kendim sorayım →
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
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
