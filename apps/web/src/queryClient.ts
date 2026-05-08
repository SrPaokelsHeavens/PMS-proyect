import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5_000,
      refetchOnWindowFocus: true
    }
  }
});

export const queryKeys = {
  rooms: ["rooms"] as const,
  products: ["products"] as const,
  config: ["config"] as const,
  shiftLedger: ["shift-ledger"] as const,
  availableRates: (roomId: string) => ["available-rates", roomId] as const
};
