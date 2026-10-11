import { useQuery } from "@tanstack/react-query";
import { notificationsApi } from "@/api/notifications";

/** Base polling period (the backend has no websocket / push). Overridable for tests. */
export const POLL_MS = Number(import.meta.env.VITE_NOTIF_POLL_MS) || 30_000;

/** Back off exponentially (x2, up to x16) after consecutive failures; react-query already pauses polling while the tab is hidden. */
export const backoff = (errorCount: number) => POLL_MS * 2 ** Math.min(errorCount, 4);

export function useUnreadCount() {
  return useQuery({
    queryKey: ["unread-count"],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: (query) => backoff(query.state.errorUpdateCount),
    refetchIntervalInBackground: false,
  });
}
