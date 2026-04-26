import * as React from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "@/lib/auth/msal";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { Wordmark } from "@/components/brand/Wordmark";

interface AuthGateProps {
  children: React.ReactNode;
}

/**
 * Show login UI when no signed-in account; otherwise render children.
 *
 * Used only when real Dataverse is enabled (`VITE_USE_MOCK=false`). With mock
 * data the app skips this gate entirely (see App.tsx routing).
 *
 * Login flow: redirect (Microsoft's recommended PKCE flow for SPAs).
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

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <GlassPanel tone="strong" className="rounded-2xl px-8 py-6">
          <div className="text-sm text-muted-foreground">Yükleniyor…</div>
        </GlassPanel>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen grid place-items-center px-4 bg-gradient-to-br from-sky-50 via-white to-slate-100">
        <GlassPanel
          tone="strong"
          className="rounded-3xl w-full max-w-md p-8 flex flex-col items-center text-center gap-5"
        >
          <Wordmark variant="default" />
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight">
              TYRO International Trade
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Devam etmek için kurumsal Microsoft hesabınla giriş yap.
              <br />
              Veriler salt-okunur olarak Dataverse'ten çekilir.
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => instance.loginRedirect(loginRequest)}
            className="w-full"
          >
            Microsoft ile giriş yap
          </Button>
          <p className="text-[10.5px] text-muted-foreground">
            Tiryaki dizininden bir hesap seçeceksin · oturum kapanınca
            verileriniz tamamen temizlenir
          </p>
        </GlassPanel>
      </div>
    );
  }

  return <>{children}</>;
}
