"use client";

import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { authQueryOptions } from "@/api/auth";
import { Auth } from "@/types/auth";

/**
 * Hook to get optional auth state (doesn't throw if not authenticated)
 * Uses Suspense for loading state
 */
export const useOptionalAuth = (): Auth | null => {
  const { data } = useSuspenseQuery(authQueryOptions);
  return data;
};

/**
 * Hook to get auth state (throws if not authenticated)
 * Use this when component requires authentication
 */
export const useAuth = (): Auth => {
  const auth = useOptionalAuth();

  if (!auth) {
    throw new Error("Authentication required");
  }

  return auth;
};

/**
 * Hook to get auth state with loading/error states (non-suspense)
 * More flexible for conditional auth
 */
export const useAuthQuery = () => {
  return useQuery(authQueryOptions);
};
