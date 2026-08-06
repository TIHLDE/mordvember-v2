"use client";

import { queryOptions, QueryClient } from "@tanstack/react-query";
import { IFetch } from "./fetch";
import {
  Auth,
  AuthSchema,
  LoginCredentials,
  User,
  Permission,
} from "@/types/auth";

// Singleton query client for client-side use
let queryClient: QueryClient | null = null;

export const getQueryClient = () => {
  if (!queryClient) {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000, // 5 min
          gcTime: Infinity,
        },
      },
    });
  }
  return queryClient;
};

/**
 * API functions to fetch auth data
 */
const API = {
  getUserData: () => IFetch<User>("/auth/me"),
  getUserPermissions: () => IFetch<Permission>("/auth/permissions"),
};

/**
 * Query options for auth state
 */
export const authQueryOptions = queryOptions({
  queryKey: ["auth"],
  queryFn: async (): Promise<Auth | null> => {
    try {
      const [userData, permissions] = await Promise.all([
        API.getUserData(),
        API.getUserPermissions(),
      ]);

      const auth: Auth = {
        user: userData,
        permissions,
      };

      // Validate with Zod schema
      return AuthSchema.parse(auth);
    } catch (error) {
      console.error("Failed to fetch auth data:", error);
      return null;
    }
  },
  staleTime: 2 * 60 * 1000, // 2 minutes - more frequent checking for auth
  retry: false,
});

/**
 * Check if user is authenticated and return auth object
 * Returns undefined if no token exists
 * Returns null if token exists but auth fetch fails
 */
export const authClient = async (): Promise<Auth | null | undefined> => {
  // Cookien er httpOnly og usynlig for JS, så det finnes ingen billig
  // forhåndssjekk lenger. /auth/me svarer 401 når den mangler, og det er
  // signalet «ikke innlogget».
  try {
    const client = getQueryClient();
    const auth = await client.ensureQueryData(authQueryOptions);
    return auth ?? undefined;
  } catch {
    return undefined;
  }
};

/**
 * Logout user by removing token and clearing caches
 */
export const logoutUser = async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  getQueryClient().removeQueries();
};

/**
 * Invalidate auth cache to force refetch
 */
export const invalidateAuth = () => {
  getQueryClient().invalidateQueries({ queryKey: ["auth"] });
};

/**
 * Create login redirect URL with current path as redirectTo param
 */
export const createLoginRedirectUrl = (currentPath: string): string => {
  const params = new URLSearchParams();
  params.set("redirectTo", currentPath);
  return `/login?${params.toString()}`;
};
