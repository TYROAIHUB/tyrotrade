import * as React from "react";
import { Eye, EyeOff, RotateCcw, ExternalLink } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { FlashIcon, AiBrain02Icon } from "@hugeicons/core-free-icons";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TONE_AI } from "@/components/details/AccentIconBadge";
import { useSettings } from "@/hooks/useSettings";
import {
  isUsingDefaultKey,
  type GeminiModel,
} from "@/lib/settings/userSettings";
import { generateAnswer, GeminiError } from "@/lib/ai/gemini";
import { cn } from "@/lib/utils";

/**
 * /settings — application preferences. First card is the Gemini AI
 * chatbot key + model selection (the primary surface). Future cards
 * (theme persistence, sync, language) can stack underneath.
 *
 * Mirrors the TYROwms Settings reference layout: card with header
 * pill icon, plain-language description, the field, a Test button,
 * a status row, and a footer help link.
 */
export function SettingsPage() {
  return (
    <ScrollArea className="h-full">
      <div className="max-w-3xl mx-auto py-3 px-1 space-y-3">
        <AiChatbotCard />
        <PlaceholderCard
          title="Tema & Görünüm"
          tagline="Sidebar tema seçimi"
          body="Açık / Lacivert / Siyah tema arasında geçişi sidebar'ın altındaki tema değiştiriciden yapabilirsin."
        />
        <PlaceholderCard
          title="Veri Senkronizasyonu"
          tagline="Dataverse cache'i"
          body="Tüm Dataverse entity'lerini Veri Yönetimi sayfasındaki Güncelle butonu ile yenileyebilirsin. Cache localStorage'da tutulur ve oturumlar arası saklanır."
        />
      </div>
    </ScrollArea>
  );
}

/* ─────────── AI Chatbot Card ─────────── */

function AiChatbotCard() {
  const { settings, setSettings, resetToDefaults } = useSettings();
  const [draftKey, setDraftKey] = React.useState(settings.geminiApiKey);
  const [show, setShow] = React.useState(false);
  const [testStatus, setTestStatus] = React.useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ok"; message: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  // Keep the local draft synced when settings change externally (e.g.
  // user resets to defaults in another tab).
  React.useEffect(() => {
    setDraftKey(settings.geminiApiKey);
  }, [settings.geminiApiKey]);

  const isDirty = draftKey.trim() !== settings.geminiApiKey.trim();
  const usingDefault = isUsingDefaultKey({ geminiApiKey: settings.geminiApiKey });

  function handleSaveKey() {
    setSettings({ ...settings, geminiApiKey: draftKey.trim() });
    setTestStatus({ kind: "idle" });
  }

  function handleResetKey() {
    resetToDefaults();
    setTestStatus({ kind: "idle" });
  }

  function handleModelChange(value: string) {
    setSettings({ ...settings, geminiModel: value as GeminiModel });
  }

  async function handleTest() {
    setTestStatus({ kind: "loading" });
    try {
      const answer = await generateAnswer({
        apiKey: draftKey.trim() || settings.geminiApiKey,
        model: settings.geminiModel,
        systemInstruction:
          "Tek kelimeyle yanıt ver: 'merhaba' geldiğinde 'merhaba' yaz.",
        history: [],
        userPrompt: "merhaba",
      });
      setTestStatus({
        kind: "ok",
        message: `Bağlantı başarılı — yanıt geldi (${answer.slice(0, 40).trim()}…)`,
      });
    } catch (err) {
      const message =
        err instanceof GeminiError
          ? err.userMessage
          : "Bilinmeyen bir hata oluştu.";
      setTestStatus({ kind: "error", message });
    }
  }

  return (
    <GlassPanel tone="default" className="rounded-2xl">
      <div className="px-5 py-4 flex items-start gap-3 border-b border-border/40">
        <span
          className="size-9 rounded-xl grid place-items-center shrink-0 shadow-sm text-white"
          style={{
            background: TONE_AI.gradient,
            boxShadow: `0 4px 12px -4px ${TONE_AI.ring}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
          }}
        >
          <HugeiconsIcon icon={FlashIcon} size={18} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-tight leading-tight">
            AI Chatbot (Gemini)
          </h2>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
            Google Gemini AI ile dashboard, projeler ve veri yönetimi
            içeriğinizi doğal dilde sorgulayın. Ücretsiz API key gereklidir.
          </p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* API key row */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <label className="text-[11.5px] font-semibold uppercase tracking-wider text-foreground/70">
              Gemini API Key
            </label>
            <StatusDot usingDefault={usingDefault} />
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={show ? "text" : "password"}
                value={draftKey}
                onChange={(e) => setDraftKey(e.target.value)}
                placeholder="AQ.Ab8RN6I-..."
                className="pr-10 font-mono text-[12.5px]"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 size-7 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
                aria-label={show ? "Key'i gizle" : "Key'i göster"}
              >
                {show ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </button>
            </div>
            <Button
              type="button"
              onClick={handleTest}
              disabled={testStatus.kind === "loading"}
              className="shrink-0"
              style={{
                background: TONE_AI.gradient,
                color: "white",
                boxShadow: `0 4px 12px -4px ${TONE_AI.ring}`,
              }}
            >
              {testStatus.kind === "loading" ? "Test ediliyor…" : "Test Et"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveKey}
              disabled={!isDirty}
            >
              Kaydet
            </Button>
          </div>
          {testStatus.kind === "ok" && (
            <p className="text-[11.5px] text-emerald-700">
              ✓ {testStatus.message}
            </p>
          )}
          {testStatus.kind === "error" && (
            <p className="text-[11.5px] text-rose-600">
              ⚠ {testStatus.message}
            </p>
          )}
        </div>

        {/* Model selector */}
        <div className="space-y-2">
          <label className="text-[11.5px] font-semibold uppercase tracking-wider text-foreground/70 flex items-center gap-1.5">
            <HugeiconsIcon icon={AiBrain02Icon} size={12} strokeWidth={2} />
            Model
          </label>
          <Select value={settings.geminiModel} onValueChange={handleModelChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini-2.5-flash">
                Gemini 2.5 Flash · hızlı, ücretsiz tier
              </SelectItem>
              <SelectItem value="gemini-2.5-pro">
                Gemini 2.5 Pro · daha güçlü, kotalı
              </SelectItem>
              <SelectItem value="gemini-1.5-flash">
                Gemini 1.5 Flash · klasik
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Footer link + reset */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-1.5 text-[11.5px] text-foreground/70 hover:text-foreground"
            )}
          >
            <ExternalLink className="size-3" />
            Google AI Studio'dan ücretsiz key alın · Key sadece bu tarayıcıda saklanır
          </a>
          {!usingDefault && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetKey}
              className="h-7 px-2 gap-1.5 text-[11px]"
            >
              <RotateCcw className="size-3" />
              Varsayılana sıfırla
            </Button>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}

function StatusDot({ usingDefault }: { usingDefault: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[10.5px] font-semibold",
        usingDefault ? "text-foreground/55" : "text-emerald-700"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          usingDefault ? "bg-foreground/35" : "bg-emerald-500"
        )}
      />
      {usingDefault ? "Varsayılan key kullanılıyor" : "Özel key girildi"}
    </span>
  );
}

/* ─────────── Placeholder card ─────────── */

function PlaceholderCard({
  title,
  tagline,
  body,
}: {
  title: string;
  tagline: string;
  body: string;
}) {
  return (
    <GlassPanel tone="subtle" className="rounded-2xl">
      <div className="px-5 py-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[14px] font-semibold tracking-tight">{title}</h2>
          <span className="text-[11px] text-muted-foreground">{tagline}</span>
        </div>
        <p className="text-[12px] text-muted-foreground mt-1.5 leading-snug">
          {body}
        </p>
      </div>
    </GlassPanel>
  );
}
