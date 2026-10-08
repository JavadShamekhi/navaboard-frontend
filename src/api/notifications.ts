import { api } from "./client";
import type { ActivityItem, NotificationItem, Paginated } from "@/types";

export const notificationsApi = {
  list: (p: { unread?: boolean; page?: number; page_size?: number } = {}) => {
    const qs = new URLSearchParams();
    if (p.unread) qs.set("unread", "true");
    if (p.page) qs.set("page", String(p.page));
    if (p.page_size) qs.set("page_size", String(p.page_size));
    const q = qs.toString();
    return api<Paginated<NotificationItem>>(`notifications/${q ? `?${q}` : ""}`);
  },
  unreadCount: () => api<{ count: number }>("notifications/unread-count/"),
  markRead: (id: string) => api<unknown>(`notifications/${id}/read/`, { method: "POST" }),
  markAllRead: () => api<{ updated: number }>("notifications/read-all/", { method: "POST" }),
};

export const activityApi = {
  workspace: (id: string, page = 1) => api<Paginated<ActivityItem>>(`workspaces/${id}/activity/?page=${page}`),
  board: (id: string, page = 1) => api<Paginated<ActivityItem>>(`boards/${id}/activity/?page=${page}`),
  card: (id: string, page = 1) => api<Paginated<ActivityItem>>(`cards/${id}/activity/?page=${page}`),
};
