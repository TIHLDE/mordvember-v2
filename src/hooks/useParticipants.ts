"use client";

import { useQuery } from "@tanstack/react-query";
import { Participant } from "@/types/participant";

/**
 * Hook to fetch and auto-refresh participants
 * @param refetchInterval - How often to refetch in milliseconds (default: 5000ms)
 */
export function useParticipants(refetchInterval: number = 5000) {
  return useQuery({
    queryKey: ["participants"],
    queryFn: async (): Promise<Participant[]> => {
      const response = await fetch("/api/participants");
      if (!response.ok) {
        throw new Error("Failed to fetch participants");
      }
      return response.json();
    },
    refetchInterval, // Auto-refetch every X milliseconds
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    staleTime: 3000, // Data is fresh for 3 seconds
  });
}
