import * as React from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "@/lib/auth/msal";
import { LoginPage } from "@/pages/LoginPage";

interface AuthGateProps {
  children: React.ReactNode;
}

/**
 * Show login UI when no signed-in account; otherwise render children.
 *
 * Used only when real Dataverse is enabled (`VITE_USE_MOCK=false`). With
 * mock data the app skips this gate entirely (see App.tsx routing).
 *
 * Renders the shared `LoginPage` with `onLogin` wired to the MSAL
 * redirect flow so the unauthenticated state shows the same cinematic
 * origami-vessel scene as the standalone `/login` route.
 */
export function AuthGate({ children }: AuthGateProps) {
  const { instance, accounts, inProgress } = useMsal();

  const isAuthenticated = accounts.length > 0;
  const isLoading =
    inProgress !== InteractionStatus.None &&
    inProgress !== InteractionStatus.HandleRedirect;

  React.useEffect(() => {
    if (isAuthenticated && !instance.getActiveAccount()) {
      instance.setActiveAccount(accounts[0]);
    }
  }, [accounts, isAuthenticated, instance]);

  // While unauthenticated OR while MSAL is mid-flow, render LoginPage —
  // its built-in `ConnectionOverlay` already covers the "yükleniyor"
  // state via the `isLoading` prop. Showing a separate white card here
  // would interrupt the cinematic "tyroverse bağlanıyor" handoff.
  if (!isAuthenticated || isLoading) {
    return (
      <LoginPage
        onLogin={() => instance.loginRedirect(loginRequest)}
        isLoading={isLoading}
      />
    );
  }

  return <>{children}</>;
}
