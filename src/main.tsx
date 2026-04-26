import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MsalProvider } from "@azure/msal-react";
import "@fontsource-variable/inter/index.css";
import App from "./App";
import "./globals.css";
import { getMsalInstance, isAuthConfigured } from "./lib/auth/msal";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Only mount MSAL when the env config is complete. In dev with VITE_USE_MOCK=true
// and no auth env vars yet, the app boots without auth — handy for early
// development before the Azure AD app registration is wired.
const tree = (
  <QueryClientProvider client={queryClient}>
    <HashRouter>
      <App />
    </HashRouter>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isAuthConfigured ? (
      <MsalProvider instance={getMsalInstance()}>{tree}</MsalProvider>
    ) : (
      tree
    )}
  </StrictMode>
);
