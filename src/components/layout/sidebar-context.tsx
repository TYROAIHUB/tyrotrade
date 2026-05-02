import * as React from "react";

export type SidebarTheme = "navy" | "light" | "black";

const THEME_VALUES: SidebarTheme[] = ["navy", "light", "black"];

interface SidebarContextValue {
  /** Persistent: when true, sidebar stays expanded regardless of hover */
  pinned: boolean;
  /** Ephemeral: true while mouse is over the sidebar trigger area */
  hovering: boolean;
  /** Derived: pinned || hovering — drives the visible expanded/collapsed state */
  expanded: boolean;
  togglePin: () => void;
  setPinned: (v: boolean) => void;
  setHovering: (v: boolean) => void;
  /** Mobile sheet drawer */
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  /** Sidebar color theme (only affects the sidebar itself) */
  theme: SidebarTheme;
  setTheme: (t: SidebarTheme) => void;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

const STORAGE_KEY = "tyro:sidebar:pinned";
const THEME_STORAGE_KEY = "tyro:sidebar:theme";

function readTheme(): SidebarTheme {
  // Default to "light" for first-time visitors and anyone who has
  // cleared localStorage. Returning users keep whatever they last
  // picked (persisted under THEME_STORAGE_KEY).
  if (typeof window === "undefined") return "light";
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  const v = raw === "sky-navy" ? "navy" : raw;
  return (THEME_VALUES as readonly string[]).includes(v ?? "")
    ? (v as SidebarTheme)
    : "light";
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [pinned, setPinnedState] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  });
  const [hovering, setHovering] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [theme, setThemeState] = React.useState<SidebarTheme>(() => readTheme());

  const setPinned = React.useCallback((v: boolean) => {
    setPinnedState(v);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    }
  }, []);

  const setTheme = React.useCallback((t: SidebarTheme) => {
    setThemeState(t);
    if (typeof window !== "undefined") {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    }
  }, []);

  const togglePin = React.useCallback(() => {
    setPinned(!pinned);
  }, [pinned, setPinned]);

  const expanded = pinned || hovering;

  const value = React.useMemo<SidebarContextValue>(
    () => ({
      pinned,
      hovering,
      expanded,
      togglePin,
      setPinned,
      setHovering,
      mobileOpen,
      setMobileOpen,
      theme,
      setTheme,
    }),
    [pinned, hovering, expanded, togglePin, setPinned, mobileOpen, theme, setTheme]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used inside SidebarProvider");
  return ctx;
}
