import * as React from "react";
import {
  DEFAULT_SETTINGS,
  readSettings,
  resetSettings as resetSettingsStore,
  SETTINGS_EVENT,
  writeSettings,
  type UserSettings,
} from "@/lib/settings/userSettings";

/**
 * Subscribe to localStorage-backed user settings. Uses
 * `useSyncExternalStore` so multiple components stay in sync after a
 * write — Settings page saves a new API key and the chat drawer
 * picks it up on the next render without prop drilling.
 */
export function useSettings(): {
  settings: UserSettings;
  setSettings: (next: UserSettings) => void;
  resetToDefaults: () => void;
} {
  const settings = React.useSyncExternalStore(
    subscribe,
    readSettings,
    () => DEFAULT_SETTINGS // SSR fallback — we don't SSR but keeps types happy
  );

  const setSettings = React.useCallback((next: UserSettings) => {
    writeSettings(next);
  }, []);

  const resetToDefaults = React.useCallback(() => {
    resetSettingsStore();
  }, []);

  return { settings, setSettings, resetToDefaults };
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  // Same-tab updates fire the custom event; cross-tab updates use the
  // native `storage` event so the chatbot picks up changes from a
  // settings tab opened in another window.
  window.addEventListener(SETTINGS_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(SETTINGS_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
