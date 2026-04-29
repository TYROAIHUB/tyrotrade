import * as React from "react";
import { toast } from "sonner";
import { shouldUseMock } from "@/lib/dataverse";
import { refreshAllEntities } from "@/lib/dataverse/refreshAll";

/** Once-per-session flag stored in sessionStorage so the auto-refresh
 *  fires exactly one time after MSAL login — not on every route change,
 *  not after a tab refocus, not when the user lands on a different page
 *  inside the same session. Cleared automatically when the browser
 *  closes the tab. */
const FLAG_KEY = "tyro:autoRefreshDone";

function alreadyRefreshed(): boolean {
  try {
    return sessionStorage.getItem(FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

function markRefreshed(): void {
  try {
    sessionStorage.setItem(FLAG_KEY, "1");
  } catch {
    // sessionStorage disabled in this context — accept the consequence
    // (refresh might fire again on the next render). Better than failing
    // outright.
  }
}

/**
 * Mounted once inside `AppShell` after MSAL has resolved the user.
 * Triggers a background `refreshAllEntities()` call exactly one time
 * per browser session, then surfaces a toast describing what
 * happened. Subsequent renders/routes are no-ops thanks to the
 * sessionStorage flag.
 *
 * Skips entirely when `VITE_USE_MOCK=true` (mock data needs no
 * refresh) or when MSAL hasn't supplied an account yet.
 */
export function DataverseLoginAutoRefresh() {
  // Run on mount; sessionStorage flag prevents the loop. The empty
  // dep array is intentional — re-mounts that happen mid-session
  // (e.g. AppShell unmount/mount during navigation) are gated by the
  // flag, not the dep array.
  React.useEffect(() => {
    if (shouldUseMock()) return;
    if (alreadyRefreshed()) return;

    // Mark immediately so a second mount during the in-flight request
    // (React StrictMode dev mode does this) doesn't trigger a duplicate.
    markRefreshed();

    // Loading toast that swaps to success/error when the promise settles.
    // Sonner's toast.promise covers all three states with a single call.
    const promise = refreshAllEntities();
    toast.promise(promise, {
      loading: "Veriler güncelleniyor…",
      success: (result) => {
        if (result.ok) {
          const seconds = (result.durationMs / 1000).toFixed(1);
          return {
            message: "Veriler güncellendi",
            description: `${result.completedSteps.length} adım · ${seconds} sn`,
          };
        }
        // refreshAllEntities returned without throwing, but flagged a step
        // as failed — surface as error toast.
        throw new Error(result.errorMessage ?? "Bilinmeyen hata");
      },
      error: (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          message: "Veri güncelleme başarısız",
          description: msg.slice(0, 140),
        };
      },
    });
  }, []);

  return null;
}
