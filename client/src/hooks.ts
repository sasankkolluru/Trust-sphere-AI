import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useEffect } from "react";
import { api } from "./api";
import { connectRealtime, joinRealtimeRoom, type RealtimeEvent } from "./realtime";

export function useAnalyses(query = "?limit=50&sort=-createdAt") {
  return useQuery({ queryKey: ["analyses", query], queryFn: () => api.analyses(query) });
}

export function useEntities(query = "?limit=50&sort=-createdAt") {
  return useQuery({ queryKey: ["entities", query], queryFn: () => api.entities(query) });
}

export function useNotifications(query = "?limit=50&sort=-createdAt") {
  return useQuery({ queryKey: ["notifications", query], queryFn: () => api.notifications(query) });
}

export function useCreateAnalysis() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const result = await api.createAnalysis(body);
      joinRealtimeRoom(`analysis:${result.data._id}`);
      return result;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["analyses"] }),
  });
}

export function useRealtimeEvents(): RealtimeEvent[] {
  const client = useQueryClient();
  const [events, setEvents] = useState<RealtimeEvent[]>([]);

  useEffect(
    () =>
      connectRealtime((event) => {
        setEvents((current) => [event, ...current].slice(0, 30));
        if (
          event.name.startsWith("analysis:") ||
          event.name === "risk:changed" ||
          event.name === "dashboard:update"
        ) {
          void client.invalidateQueries({ queryKey: ["analyses"] });
          void client.invalidateQueries({ queryKey: ["entities"] });
        }
        if (event.name === "notification:new")
          void client.invalidateQueries({ queryKey: ["notifications"] });
      }),
    [client],
  );

  return events;
}
