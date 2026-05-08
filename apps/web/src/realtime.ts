import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import type { DomainEvent } from "@hotel-os/shared";
import { API_URL, type Session } from "./api.js";
import { queryKeys } from "./queryClient.js";

function invalidateForEvent(queryClient: ReturnType<typeof useQueryClient>, event: DomainEvent) {
  if (event.type.startsWith("room.") || event.type.startsWith("stay.")) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.rooms });
    void queryClient.invalidateQueries({ queryKey: queryKeys.config });
    void queryClient.invalidateQueries({ queryKey: queryKeys.shiftLedger });
    return;
  }

  if (event.type === "charge.created" || event.type === "shift.changed") {
    void queryClient.invalidateQueries({ queryKey: queryKeys.rooms });
    void queryClient.invalidateQueries({ queryKey: queryKeys.shiftLedger });
    return;
  }

  if (event.type === "config.changed") {
    void queryClient.invalidateQueries({ queryKey: queryKeys.config });
    if (["rooms", "roomTypes", "rates", "overtimeRules"].includes(event.scope)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.rooms });
      void queryClient.invalidateQueries({ queryKey: ["available-rates"] });
    }
  }
}

export function useRealtimeSync(session: Session | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!session) return;

    const socket = io(API_URL, {
      transports: ["websocket", "polling"],
      auth: { token: session.token }
    });

    socket.on("domain:event", (event: DomainEvent) => invalidateForEvent(queryClient, event));

    return () => {
      socket.disconnect();
    };
  }, [queryClient, session]);
}
