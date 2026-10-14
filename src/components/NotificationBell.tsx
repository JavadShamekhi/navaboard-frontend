import {NavLink} from "react-router-dom";
import {useUnreadCount} from "@/lib/notifications";

export default function NotificationBell() {
	const {data} = useUnreadCount();
	const count = data?.count ?? 0;
	return (
			<NavLink
					to="/notifications"
					aria-label={count ? `اعلان‌ها (${count} خوانده‌نشده)` : "اعلان‌ها"}
					title="اعلان‌ها"
					className={({isActive}) =>
							`group relative grid h-9 w-9 place-items-center rounded-full outline-none transition duration-300 hover:-translate-y-px hover:bg-white hover:text-sky-700 hover:shadow-[0_0_18px_rgba(255,255,255,0.6)] focus-visible:ring-2 focus-visible:ring-white active:scale-95 ${
									isActive ? "bg-white text-sky-700 shadow-sm" : "bg-white/20 text-white"
							}`
					}
			>
				<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="origin-top transition-transform duration-300 group-hover:rotate-12"
				>
					<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
					<path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
				</svg>
				{count > 0 && (
						<span
								data-testid="unread-badge"
								className="absolute -end-1 -top-1 min-w-4 rounded-full bg-rose px-1 text-center text-[10px] leading-4 text-white shadow-[0_0_0_2px_rgb(14,165,233)]"
						>
          {count > 99 ? "99+" : count}
        </span>
				)}
			</NavLink>
	);
}