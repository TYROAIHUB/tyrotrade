import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { dataverseTokenRequest, getMsalInstance } from "./msal";

/**
 * Acquire an access token for the Dataverse environment.
 *
 * Flow:
 *   1. Try silent (cached / refresh-token).
 *   2. If `InteractionRequiredAuthError` → fall back to popup. Popup is more
 *      robust than redirect when the user is already in the app.
 *   3. Throw on any other error so the caller decides what to do.
 *
 * Returns the raw access token string (no "Bearer " prefix).
 */
export async function acquireDataverseToken(): Promise<string> {
  const msal = getMsalInstance();
  const accounts = msal.getAllAccounts();
  if (accounts.length === 0) {
    throw new Error("[auth] No signed-in account; trigger login first.");
  }
  const account = msal.getActiveAccount() ?? accounts[0];

  try {
    const result = await msal.acquireTokenSilent({
      ...dataverseTokenRequest,
      account,
    });
    return result.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      const result = await msal.acquireTokenPopup({
        ...dataverseTokenRequest,
        account,
      });
      return result.accessToken;
    }
    throw err;
  }
}

/**
 * Force-refresh the token (used after a 401 from the API). Issues a silent
 * call with `forceRefresh: true` to bypass the cache.
 */
export async function refreshDataverseToken(): Promise<string> {
  const msal = getMsalInstance();
  const account = msal.getActiveAccount() ?? msal.getAllAccounts()[0];
  if (!account) {
    throw new Error("[auth] No active account to refresh");
  }
  const result = await msal.acquireTokenSilent({
    ...dataverseTokenRequest,
    account,
    forceRefresh: true,
  });
  return result.accessToken;
}
