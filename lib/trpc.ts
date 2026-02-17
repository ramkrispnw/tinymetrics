import { createTRPCReact } from "@trpc/react-query";
import { createTRPCClient as createVanillaClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@/server/routers";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";

/**
 * tRPC React client for type-safe API calls.
 *
 * IMPORTANT (tRPC v11): The `transformer` must be inside `httpBatchLink`,
 * NOT at the root createClient level. This ensures client and server
 * use the same serialization format (superjson).
 */
export const trpc = createTRPCReact<AppRouter>();

/** Shared link config used by both React and vanilla clients */
function createBatchLink() {
  return httpBatchLink({
    url: `${getApiBaseUrl()}/api/trpc`,
    transformer: superjson,
    async headers() {
      const token = await Auth.getSessionToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    },
    fetch(url, options) {
      return fetch(url, {
        ...options,
        credentials: "include",
      });
    },
  });
}

/**
 * Creates the tRPC React client with proper configuration.
 * Call this once in your app's root layout.
 */
export function createTRPCClient() {
  return trpc.createClient({
    links: [createBatchLink()],
  });
}

/**
 * Vanilla (non-React) tRPC client for imperative calls outside of components.
 * Uses the same superjson transformer and auth headers as the React client.
 * Use this for cloud sync operations in callbacks/effects.
 */
let _vanillaClient: ReturnType<typeof createVanillaClient<AppRouter>> | null = null;

export function getVanillaClient() {
  if (!_vanillaClient) {
    _vanillaClient = createVanillaClient<AppRouter>({
      links: [createBatchLink()],
    });
  }
  return _vanillaClient;
}
