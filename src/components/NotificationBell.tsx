import { NavLink } from "react-router-dom";
import { useUnreadCount } from "@/lib/notifications";

export default function NotificationBell() {
  const { data } = useUnreadCount();
  const count = data?.count ?? 0;
  return (
    <NavLink to="/notifications" aria-label={count ? `اعلان‌ها (${count} خوانده‌نشده)` : "اعلان‌ها"} title="اعلان‌ها"
      className={({ isActive }) => `relative rounded-chip p-2 hover:bg-paper ${isActive ? "bg-paper" : ""}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {count > 0 && (
        <span data-testid="unread-badge" className="absolute -end-0.5 -top-0.5 min-w-4 rounded-full bg-rose px-1 text-center text-[10px] leading-4 text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </NavLink>
  );
}
