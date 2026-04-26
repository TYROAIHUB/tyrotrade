import type { DataverseClient } from "./client";
import { mockDataverseClient } from "./mockClient";
import { realDataverseClient } from "./realClient";

/**
 * Factory: returns the active Dataverse client based on env.
 *
 * `VITE_USE_MOCK=true` (default) → mock client wrapping `mockProjects`.
 * `VITE_USE_MOCK=false` → real client hitting Dataverse Web API (requires
 *                          MSAL login — see AuthGate).
 *
 * 🔒 Both implementations are read-only — `list()` + `get()` only.
 */
export function getDataverseClient(): DataverseClient {
  return shouldUseMock() ? mockDataverseClient : realDataverseClient;
}

/** True when the app should use mock data instead of real Dataverse. */
export function shouldUseMock(): boolean {
  const flag = import.meta.env.VITE_USE_MOCK;
  // Default to mock when unset, so first-time devs don't hit auth instantly.
  return flag === undefined || flag === "true";
}

export { mockDataverseClient, realDataverseClient };
export type {
  DataverseClient,
  DataverseListResponse,
} from "./client";
export { DataverseError, DataverseNotFoundError } from "./client";
export { OData, odataQueryString, type ODataQuery } from "./odata";
