import {useQuery, useMutation, useQueryClient} from "@tanstack/react-query";
import {notificationsApi} from "@/api/notifications";

/** Base polling period (the backend has no websocket / push). Overridable for tests. */
export const POLL_MS = Number(import.meta.env.VITE_NOTIF_POLL_MS) || 30_000;

/** Back off exponentially (x2, up to x16) after consecutive failures; react-query already pauses polling while the tab is hidden. */
export const backoff = (errorCount: number) => POLL_MS * 2 ** Math.min(errorCount, 4);

export const notifKeys = {
	all: ["notifications"] as const,
	unreadCount: ["notifications", "unread-count"] as const,
	unreadList: (limit: number) => ["notifications", "unread-list", limit] as const,
};

export function useUnreadCount() {
	return useQuery({
		queryKey: notifKeys.unreadCount,
		queryFn: notificationsApi.unreadCount,
		refetchInterval: (query) => backoff(query.state.errorUpdateCount),
	});
}

export function useUnreadNotifications({limit = 5, enabled = true} = {}) {
	return useQuery({
		queryKey: notifKeys.unreadList(limit),
		queryFn: () => notificationsApi.list({unread: true, page: 1, page_size: limit}),
		enabled,
	});
}

export function useMarkRead() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => notificationsApi.markRead(id),
		onMutate: () => {
			qc.setQueryData<{ count: number }>(notifKeys.unreadCount, (old) =>
					old ? {count: Math.max(0, old.count - 1)} : old,
			);
		},
		onSettled: () => qc.invalidateQueries({queryKey: notifKeys.all}),
	});
}

export function useMarkAllRead() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: notificationsApi.markAllRead,
		onSuccess: () => qc.invalidateQueries({queryKey: notifKeys.all}),
	});
}
