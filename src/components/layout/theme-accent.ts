import { useSidebar, type SidebarTheme } from "./sidebar-context";

/**
 * Resolved accent palette for the currently selected sidebar theme.
 * Drives accent-colored UI elements outside the sidebar (header avatar,
 * selected project card stripe, "TYRO AI" button gradient, etc.) so the
 * brand color follows the user's chosen sidebar theme dynamically.
 */
export interface ThemeAccent {
  /** Single-color accent — best for left stripes / 1px borders / dots. */
  solid: string;
  /** Avatar / button gradient (3-stop, light → mid → deep). */
  gradient: string;
  /** Border / ring color around avatar (semi-transparent). */
  ring: string;
  /** Soft tinted bg for "selected" rows / pills. */
  tint: string;
  /** Stronger ring for keyboard-focus / hover. */
  ringStrong: string;
}

const ACCENT_BY_THEME: Record<SidebarTheme, ThemeAccent> = {
  light: {
    solid: "#1e3a8a",
    gradient: "linear-gradient(135deg, #38bdf8 0%, #2563eb 55%, #1e3a8a 100%)",
    ring: "rgba(30, 58, 138, 0.55)",
    ringStrong: "rgba(30, 58, 138, 0.85)",
    tint: "rgba(30, 58, 138, 0.08)",
  },
  navy: {
    // Tiryaki Navy + Gold — gold accents match the "trade" wordmark exactly
    // (e0ad3e → c8922a → e0ad3e). No pale yellow stop, deeper warm gold.
    solid: "#c8922a",
    gradient: "linear-gradient(135deg, #e0ad3e 0%, #c8922a 55%, #a87a1f 100%)",
    ring: "rgba(200, 146, 42, 0.6)",
    ringStrong: "rgba(200, 146, 42, 0.9)",
    tint: "rgba(200, 146, 42, 0.12)",
  },
  black: {
    solid: "#38bdf8",
    gradient: "linear-gradient(135deg, #7dd3fc 0%, #38bdf8 55%, #0284c7 100%)",
    ring: "rgba(56, 189, 248, 0.6)",
    ringStrong: "rgba(56, 189, 248, 0.95)",
    tint: "rgba(56, 189, 248, 0.12)",
  },
};

/** Read the live theme accent palette from sidebar context. */
export function useThemeAccent(): ThemeAccent {
  const { theme } = useSidebar();
  return ACCENT_BY_THEME[theme];
}
