import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  BubbleChatIcon,
  Robot01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
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

/** Onboarding bullet points — one short value-prop per line so the
 *  user knows what kinds of questions the agent can handle before
 *  they hit "Sohbete başla". Kept domain-specific and crisp so the
 *  intro screen doesn't read like generic AI marketing copy. */
const FEATURES: string[] = [
  "Aktif sevkiyat ve milestone takibi",
  "Finansal analiz, marj ve K&Z sorguları",
  "Liman, koridor ve gemi durum sorguları",
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
 * On first open we lay an onboarding overlay with the robot icon,
 * a short value pitch, three feature bullets, and a single primary
 * CTA. The Copilot iframe loads underneath; once the user dismisses
 * the overlay (CTA click) the agent's chat surface is fully visible.
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
  // skip the cold-start handshake.
  const [hasOpened, setHasOpened] = React.useState(false);
  React.useEffect(() => {
    if (open) setHasOpened(true);
  }, [open]);

  // Onboarding overlay state — visible by default, dismissed by the
  // primary CTA. State persists while the drawer stays mounted, so
  // re-opening doesn't re-show the overlay (one-time onboarding).
  const [overlayVisible, setOverlayVisible] = React.useState(true);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
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

        {/* Body — iframe + masks + onboarding overlay */}
        <div className="flex-1 min-h-0 bg-white relative">
          {hasOpened ? (
            <>
              <iframe
                key={url}
                src={url}
                title="TYRO Chat — Copilot Studio agent"
                className="w-full h-full border-0"
                allow="microphone; clipboard-read; clipboard-write"
                referrerPolicy="strict-origin-when-cross-origin"
              />
              {/* Mask over the agent's own dark "TYRO Project MCP Agent"
                  banner — cross-origin so we paint white over it. */}
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 bg-white pointer-events-none"
                style={{ height: 56 }}
              />

              <AnimatePresence>
                {overlayVisible && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.22 } }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className={cn(
                      "absolute inset-0 z-10 flex flex-col items-center",
                      "px-6 py-10",
                      "bg-white/98 backdrop-blur-sm"
                    )}
                  >
                    {/* Robot pill — pulses gently to draw the eye to
                        the assistant identity at first glance. */}
                    <motion.span
                      initial={{ scale: 0.92, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        delay: 0.08,
                        duration: 0.45,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="size-16 rounded-2xl grid place-items-center shadow-sm text-white relative"
                      style={{
                        background: TYRO_CHAT_TONE.gradient,
                        boxShadow: `0 8px 22px -6px ${TYRO_CHAT_TONE.ring}, inset 0 1px 0 0 rgba(255,255,255,0.30)`,
                      }}
                    >
                      <HugeiconsIcon
                        icon={Robot01Icon}
                        size={30}
                        strokeWidth={1.75}
                      />
                      {/* Soft halo ring */}
                      <span
                        aria-hidden
                        className="absolute -inset-1.5 rounded-3xl pointer-events-none"
                        style={{
                          boxShadow: `0 0 0 1px ${TYRO_CHAT_TONE.ring}`,
                          opacity: 0.35,
                        }}
                      />
                    </motion.span>

                    {/* Title + value-prop copy */}
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.18, duration: 0.4 }}
                      className="text-center mt-5"
                    >
                      <h3 className="text-[18px] font-bold tracking-tight text-slate-900 leading-tight">
                        Yapay Zeka Asistanı
                      </h3>
                      <p className="text-[12.5px] text-muted-foreground mt-2 leading-relaxed max-w-[320px] mx-auto">
                        Proje, gemi ve finansal verilerinizi doğal dilde
                        sorgulayın. TYRO Chat sevkiyat takibinden marj
                        analizine kadar her sorunuza saniyeler içinde
                        yanıt verir.
                      </p>
                    </motion.div>

                    {/* Feature bullets — each lands in sequence */}
                    <motion.ul
                      initial="hidden"
                      animate="visible"
                      variants={{
                        visible: {
                          transition: { staggerChildren: 0.07, delayChildren: 0.28 },
                        },
                      }}
                      className="mt-6 w-full max-w-[320px] flex flex-col gap-2.5"
                    >
                      {FEATURES.map((feature) => (
                        <motion.li
                          key={feature}
                          variants={{
                            hidden: { opacity: 0, x: -8 },
                            visible: { opacity: 1, x: 0 },
                          }}
                          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                          className="flex items-start gap-2.5"
                        >
                          <span
                            className="size-5 rounded-full grid place-items-center shrink-0 mt-0.5"
                            style={{
                              background: "rgba(99,102,241,0.10)",
                              color: TYRO_CHAT_TONE.solid,
                            }}
                          >
                            <HugeiconsIcon
                              icon={Tick02Icon}
                              size={11}
                              strokeWidth={2.5}
                            />
                          </span>
                          <span className="text-[12.5px] text-slate-700 leading-snug">
                            {feature}
                          </span>
                        </motion.li>
                      ))}
                    </motion.ul>

                    {/* Spacer pushes the CTA toward the bottom */}
                    <div className="flex-1" />

                    {/* Primary CTA — the only action on this surface. */}
                    <motion.button
                      type="button"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5, duration: 0.4 }}
                      onClick={() => setOverlayVisible(false)}
                      className={cn(
                        "group relative inline-flex items-center justify-center gap-2",
                        "h-11 px-5 rounded-full text-[13.5px] font-semibold text-white",
                        "shadow-md hover:shadow-lg",
                        "ring-1 ring-white/15 hover:ring-white/30",
                        "transition-all duration-200",
                        "hover:scale-[1.02] active:scale-95",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                        "overflow-hidden w-full max-w-[320px]"
                      )}
                      style={{
                        background: TYRO_CHAT_TONE.gradient,
                        boxShadow: `0 8px 22px -6px ${TYRO_CHAT_TONE.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
                      }}
                    >
                      <span className="relative z-[1] tracking-tight">
                        Yapay zeka sohbetine başla
                      </span>
                      <ArrowRight className="relative z-[1] size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </motion.button>
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
