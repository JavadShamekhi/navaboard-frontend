import {Link, NavLink, Outlet, useNavigate} from "react-router-dom";
import {useQueryClient} from "@tanstack/react-query";
import {logout} from "@/api/client";
import {useAuthStore} from "@/store/auth";
import {useState} from "react";
import Avatar from "./Avatar";
import NotificationBell from "./NotificationBell";
import SearchToggle from "@/components/SearchToggle.tsx";

export default function AppShell() {
	const user = useAuthStore((s) => s.user);
	const setUser = useAuthStore((s) => s.setUser);
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	async function handleLogout() {
		try {
			await logout();
		} finally {
			queryClient.clear(); // drop private cached data
			setUser(null);
			navigate("/login");
		}
	}

	return (
			<div className="flex h-full flex-col">
				<header
						className="relative z-20 flex items-center justify-between gap-4 border-b border-white/40 bg-gradient-to-l from-sky-300 via-sky-200 to-sky-100 px-6 py-3 shadow-[0_6px_24px_-8px_rgba(56,189,248,0.55)]">
					{/* لوگو */}
					<Link
							to="/workspaces"
							className="group flex items-center gap-2 rounded-chip px-2 py-1 text-lg font-bold tracking-tight text-sky-950 transition duration-300 hover:bg-white/60 hover:shadow-[0_0_18px_rgba(255,255,255,0.9)]"
					>
          <span
		          className="grid h-8 w-8 place-items-center rounded-lg bg-white text-sky-500 shadow-sm transition duration-300 group-hover:rotate-6 group-hover:scale-105">
            ن
          </span>
						نوابرد
					</Link>

					{/* سمت راست */}
					<div className="flex items-center gap-2 text-sm">
						<SearchToggle/>
						<NotificationBell/>

						{user && (
								// Name when set, otherwise the phone number. Click opens the profile page.
								<NavLink
										to="/profile"
										title="مشاهده و ویرایش پروفایل"
										className={({isActive}) =>
												`flex items-center gap-2 rounded-full py-1 ps-1 pe-3 transition duration-300 hover:-translate-y-px hover:bg-white hover:shadow-[0_0_18px_rgba(255,255,255,0.95)] ${
														isActive
																? "bg-white font-medium text-sky-900 shadow-sm"
																: "bg-white/40 text-sky-900"
												}`
										}
								>
									<Avatar user={user}/>
									<span dir={user.full_name ? "rtl" : "ltr"}>
                {user.full_name || user.phone_number}
              </span>
								</NavLink>
						)}

						<button
								onClick={handleLogout}
								className="relative overflow-hidden rounded-full bg-white/70 px-4 py-1.5 font-medium text-rose shadow-sm transition duration-300 hover:-translate-y-px hover:bg-white hover:shadow-[0_0_18px_rgba(255,255,255,0.95),0_6px_16px_-4px_rgba(244,63,94,0.35)] active:translate-y-0 active:scale-95"
						>
							خروج
						</button>
					</div>
				</header>

				<main className="min-h-0 flex-1 overflow-auto bg-paper">
					<Outlet/>
				</main>
			</div>
	);
}