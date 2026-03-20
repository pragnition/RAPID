import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
      refetchOnWindowFocus: true,
      retry: 1,
      retryDelay: (attemptIndex) =>
        Math.min(1000 * 2 ** attemptIndex, 10000),
    },
    mutations: {
      retry: 0,
    },
  },
});
