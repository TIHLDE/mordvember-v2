"use client";

import { queryOptions, QueryClient } from "@tanstack/react-query";
import { IFetch } from "./fetch";
import { getCookie, setCookie, removeCookie } from "./cookie";
import { ACCESS_TOKEN } from "./constants";
import {
  Auth,
  AuthSchema,
  LoginCredentials,
  LoginResponse,
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
  authenticate: (username: string, password: string) =>
    IFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
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
  const token = getCookie(ACCESS_TOKEN);

  if (!token) {
    return undefined;
  }

  try {
    const client = getQueryClient();
    const auth = await client.ensureQueryData(authQueryOptions);
    return auth;
  } catch (error) {
    console.error("Auth check failed:", error);
    // Invalidate auth cache on error
    getQueryClient().invalidateQueries({ queryKey: ["auth"] });
    return null;
  }
};

/**
 * Login user with username and password
 * Sets token in cookie and fetches auth data
 */
export const loginUser = async (
  username: string,
  password: string
): Promise<Auth> => {
  try {
    // Authenticate and get token
    const response = await API.authenticate(username, password);

    // Store token in cookie (30 days)
    setCookie(ACCESS_TOKEN, response.token);

    // Clear all caches
    getQueryClient().removeQueries();

    // Fetch and return auth data
    const auth = await authClient();

    if (!auth) {
      throw new Error("Failed to fetch user data after login");
    }

    return auth;
  } catch (error) {
    console.error("Login failed:", error);
    throw error;
  }
};

/**
 * Logout user by removing token and clearing caches
 */
export const logoutUser = async () => {
  removeCookie(ACCESS_TOKEN);
  getQueryClient().removeQueries();
};

/**
 * Invalidate auth cache to force refetch
 */
export const invalidateAuth = () => {
  getQueryClient().invalidateQueries({ queryKey: ["auth"] });
};

/**
 * Check if user has write permission for given app(s)
 * @param permissions - User's permissions object
 * @param app - App name or array of app names
 * @param some - If true, user needs permission for at least one app; if false, needs all
 */
export const userHasWritePermission = (
  permissions: Permission,
  app: string | string[],
  some = false
): boolean => {
  const apps = Array.isArray(app) ? app : [app];

  const checkPermission = (appName: string): boolean => {
    const perm = permissions[appName];
    if (!perm) return false;
    return perm.write || perm.write_all || false;
  };

  return some ? apps.some(checkPermission) : apps.every(checkPermission);
};

/**
 * Create login redirect URL with current path as redirectTo param
 */
export const createLoginRedirectUrl = (currentPath: string): string => {
  const params = new URLSearchParams();
  params.set("redirectTo", currentPath);
  return `/login?${params.toString()}`;
};
