/**
 * User-level application settings — small typed wrapper around
 * `localStorage` so multiple components (Settings page, AI drawer,
 * future extensions) can read/write the same keys without
 * duplicating parsing logic.
 *
 * Currently scoped to the AI chatbot, but the shape is intentionally
 * future-proofed so theme persistence / language / experimental flags
 * can land here without a schema migration.
 */

export type GeminiModel =
  | "gemini-2.5-flash"
  | "gemini-2.5-pro"
  | "gemini-1.5-flash";

export interface UserSettings {
  /** Google AI Studio API key. Hardcoded default for dev — user can
   *  override from the Settings page; override is stored locally. */
  geminiApiKey: string;
  geminiModel: GeminiModel;
}

/** Default Gemini key is read from a Vite env var (`VITE_GEMINI_API_KEY`)
 *  injected at build time. The repo never carries the literal key —
 *  GitHub's secret scanning blocks pushes that contain GCP-shaped tokens.
 *  Set the value in `.env.local` (gitignored) for local dev and as a
 *  GitHub Action secret for production builds. When the env var is
 *  missing, the chatbot prompts the user to paste a key in Settings. */
const DEFAULT_KEY: string =
  (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ?? "";

const STORAGE_KEY = "tyro:settings";

export const DEFAULT_SETTINGS: UserSettings = {
  geminiApiKey: DEFAULT_KEY,
  geminiModel: "gemini-2.5-flash",
};

/** True when the active key is the env-provided default (UI badge cue).
 *  When the env var is unset, every non-empty key counts as "custom". */
export function isUsingDefaultKey(s: Pick<UserSettings, "geminiApiKey">): boolean {
  if (!DEFAULT_KEY) return false;
  return (s.geminiApiKey ?? "").trim() === DEFAULT_KEY;
}

/** True when no key is configured at all — env unset AND no override. */
export function hasNoKey(s: Pick<UserSettings, "geminiApiKey">): boolean {
  return !(s.geminiApiKey ?? "").trim();
}

/** Read settings from localStorage. Always returns a complete object —
 *  unknown / corrupted entries fall back to defaults so the app never
 *  boots into an undefined state. */
export function readSettings(): UserSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return {
      geminiApiKey:
        typeof parsed.geminiApiKey === "string"
          ? parsed.geminiApiKey
          : DEFAULT_SETTINGS.geminiApiKey,
      geminiModel:
        parsed.geminiModel === "gemini-2.5-pro" ||
        parsed.geminiModel === "gemini-2.5-flash" ||
        parsed.geminiModel === "gemini-1.5-flash"
          ? parsed.geminiModel
          : DEFAULT_SETTINGS.geminiModel,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Persist settings + dispatch a browser event so other tabs and
 *  the in-page `useSettings` hook can react. */
export function writeSettings(next: UserSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

/** Wipe overrides → back to defaults. */
export function resetSettings(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

/** Custom event name dispatched on any settings mutation so React
 *  hooks can subscribe via `addEventListener`. */
export const SETTINGS_EVENT = "tyro:settings:changed";
