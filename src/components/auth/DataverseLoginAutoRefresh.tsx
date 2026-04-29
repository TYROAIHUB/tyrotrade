import * as React from "react";
import { toast } from "sonner";
import { shouldUseMock } from "@/lib/dataverse";
import { refreshAllEntities } from "@/lib/dataverse/refreshAll";
import {
  RefreshErrorToast,
  RefreshLoadingToast,
  RefreshSuccessToast,
} from "@/components/ui/refresh-toast";

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
 * per browser session, then surfaces a premium custom toast describing
 * what happened.
 *
 * Same-toast progressive update via sonner's `id` mechanism: a single
 * top-right card transitions through loading → success/error in place
 * (no flicker, no stack of duplicates). Custom JSX bypasses sonner's
 * default styling so the brand language carries.
 */
export function DataverseLoginAutoRefresh() {
  React.useEffect(() => {
    if (shouldUseMock()) return;
    if (alreadyRefreshed()) return;

    // Mark immediately so a second mount during the in-flight request
    // (React StrictMode dev mode does this) doesn't trigger a duplicate.
    markRefreshed();

    const toastId = toast.custom(() => <RefreshLoadingToast />, {
      duration: Infinity,
      unstyled: true,
    });

    void (async () => {
      const result = await refreshAllEntities((p) => {
        toast.custom(
          () => (
            <RefreshLoadingToast
              stepLabel={p.label}
              current={p.step}
              total={p.totalSteps}
            />
          ),
          { id: toastId, duration: Infinity, unstyled: true }
        );
      });

      if (result.ok) {
        toast.custom(
          () => (
            <RefreshSuccessToast
              projectCount={result.projectCount}
              durationSec={result.durationMs / 1000}
              stepCount={result.completedSteps.length}
            />
          ),
          { id: toastId, duration: 5000, unstyled: true }
        );
      } else {
        toast.custom(
          () => (
            <RefreshErrorToast
              stepLabel={result.failedStep}
              message={result.errorMessage}
            />
          ),
          { id: toastId, duration: 8000, unstyled: true }
        );
      }
    })();
  }, []);

  return null;
}
