/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_MOCK?: string;
  readonly VITE_AAD_CLIENT_ID?: string;
  readonly VITE_AAD_TENANT_ID?: string;
  readonly VITE_AAD_REDIRECT_URI?: string;
  readonly VITE_DATAVERSE_URL?: string;
  readonly VITE_DATAVERSE_SCOPE?: string;
  readonly VITE_PROJECT_TRADER_FILTER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
