import {useEffect, useRef, useState} from "react";
import {Link, useLocation} from "react-router-dom";
import {
	useUnreadCount,
	useUnreadNotifications,
	useMarkRead,
	useMarkAllRead,
} from "@/lib/notifications";
import type {NotificationItem} from "@/types";

const fmt = new Intl.DateTimeFormat("fa-IR", {dateStyle: "short", timeStyle: "short"});

const str = (v: unknown): string | undefined =>
		typeof v === "string" && v ? v : undefined;

const act = (n: NotificationItem) => (n.activity ?? {}) as Record<string, unknown>;

// عنوان نوتیف: اسم فیلدها را با ActivityItem واقعی‌تان تطبیق بدهید
const getTitle = (n: NotificationItem) =>
		str(act(n).message) ?? str(act(n).description) ?? str(act(n).verb) ?? "اعلان جدید";

// مقصد کلیک: اگر activity شناسه‌ی برد/کارت دارد، مستقیم به آن برود
const getHref = (n: NotificationItem) => {
	const a = act(n);
	const board = str(a.board_id) ?? str(a.board);
	const card = str(a.card_id) ?? str(a.card);
	if (board && card) return `/boards/${board}?card=${card}`;
	if (board) return `/boards/${board}`;
	return "/notifications";
};

const formatCount = (n: number) => (n > 99 ? "+99" : String(n));

export default function NotificationBell() {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	const location = useLocation();

	const {data} = useUnreadCount();
	const count = data?.count ?? 0;

	// فقط وقتی dropdown باز است، لیست خوانده‌نشده‌ها را بگیر
	const {data: list, isLoading} = useUnreadNotifications({limit: 5, enabled: open});
	const markRead = useMarkRead();
	const markAllRead = useMarkAllRead();
	const items = list?.results ?? [];

	// بستن با کلیک بیرون و Escape
	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => {
			if (!ref.current?.contains(e.target as Node)) setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	// بستن با تغییر مسیر
	useEffect(() => {
		setOpen(false);
	}, [location.pathname]);

	return (
			<div ref={ref} className="relative">
				<button
						type="button"
						onClick={() => setOpen((o) => !o)}
						aria-haspopup="menu"
						aria-expanded={open}
						aria-label={count ? `اعلان‌ها (${count} خوانده‌نشده)` : "اعلان‌ها"}
						title="اعلان‌ها"
						className={`group relative grid h-9 w-9 place-items-center rounded-full outline-none transition duration-300 hover:-translate-y-px hover:bg-white hover:text-sky-700 hover:shadow-[0_0_18px_rgba(255,255,255,0.6)] focus-visible:ring-2 focus-visible:ring-white active:scale-95 ${
								open ? "bg-white text-sky-700 shadow-sm" : "bg-white/20 text-white"
						}`}
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
									dir="ltr"
									className="absolute -end-1 -top-1 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] leading-4 text-white shadow-[0_0_0_2px_rgb(14,165,233)]"
							>
            {formatCount(count)}
          </span>
					)}
				</button>

				{open && (
						<div
								role="menu"
								className="absolute left-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl bg-white text-slate-800 shadow-xl ring-1 ring-black/5"
						>
							<div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
								<div className="flex items-center gap-2">
									<span className="text-sm font-semibold">اعلان‌های خوانده‌نشده</span>
									{count > 0 && (
											<span
													dir="ltr"
													className="rounded-full bg-red-600 px-2 text-[11px] leading-5 text-white"
											>
                  {formatCount(count)}
                </span>
									)}
								</div>
								{count > 0 && (
										<button
												type="button"
												onClick={() => markAllRead.mutate()}
												disabled={markAllRead.isPending}
												className="text-xs text-sky-700 outline-none hover:underline focus-visible:underline disabled:opacity-50"
										>
											خواندن همه
										</button>
								)}
							</div>

							<div className="max-h-80 overflow-y-auto">
								{isLoading ? (
										<p className="px-4 py-6 text-center text-sm text-slate-500">در حال بارگذاری…</p>
								) : items.length === 0 ? (
										<p className="px-4 py-6 text-center text-sm text-slate-500">اعلان جدیدی ندارید</p>
								) : (
										<ul>
											{items.map((n) => (
													<li key={n.id}>
														<Link
																role="menuitem"
																to={getHref(n)}
																onClick={() => {
																	markRead.mutate(n.id);
																	setOpen(false);
																}}
																className="flex gap-3 border-b border-slate-50 px-4 py-3 outline-none transition hover:bg-sky-50 focus-visible:bg-sky-50"
														>
															<span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-600"/>
															<span className="min-w-0 flex-1">
                                <span className="line-clamp-2 block text-sm font-medium">{getTitle(n)}</span>
																	<span className="mt-1 block text-[11px] text-slate-400">
                                    {fmt.format(new Date(n.created_at))}
                                  </span>
															</span>
														</Link>
													</li>
											))}
										</ul>
								)}
							</div>

							<Link
									role="menuitem"
									to="/notifications"
									onClick={() => setOpen(false)}
									className="block bg-slate-50 px-4 py-3 text-center text-sm font-medium text-sky-700 outline-none transition hover:bg-sky-50 focus-visible:bg-sky-50"
							>
								مشاهده همه اعلان‌ها
								{count > items.length ? ` (${formatCount(count)})` : ""}
							</Link>
						</div>
				)}
			</div>
	);
}