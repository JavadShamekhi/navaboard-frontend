import {useEffect, useRef, useState} from "react";
import {useNavigate} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";
import {searchApi} from "@/api/search";
import type {Card} from "@/types";

function useDebounced<T>(value: T, ms = 250) {
	const [v, setV] = useState(value);
	useEffect(() => {
		const t = setTimeout(() => setV(value), ms);
		return () => clearTimeout(t);
	}, [value, ms]);
	return v;
}

// فیلدهای Card را با تایپ واقعی خودت چک کن. این دو تابع عمداً شل نوشته شده‌اند
// تا اگر اسم فیلدها فرق داشت، خطای تایپ ندهند.
type Loose = Record<string, unknown>;

function cardHref(c: Card) {
	const board = (c as unknown as Loose).board_id ?? (c as unknown as Loose).board;
	return board ? `/boards/${board}?card=${c.id}` : `/search?q=${encodeURIComponent(c.title)}`;
}

function cardMeta(c: Card) {
	const x = c as unknown as Loose;
	return [x.board_name, x.list_name ?? x.list_title]
			.filter((s): s is string => typeof s === "string" && s.length > 0)
			.join(" › ");
}

export default function SearchToggle() {
	const [open, setOpen] = useState(false);
	const [quick, setQuick] = useState("");
	const [active, setActive] = useState(-1);
	const navigate = useNavigate();
	const wrapRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const q = useDebounced(quick.trim());
	const enabled = open && q.length >= 2;

	const {data, isFetching} = useQuery({
		queryKey: ["quick-search", q],
		queryFn: () => searchApi.cards({q, page_size: 6}),
		enabled,
		staleTime: 30_000,
	});
	const hits: Card[] = (enabled ? data?.results : undefined) ?? [];

	useEffect(() => setActive(-1), [q]);

	// بستن با کلیک بیرون یا Escape
	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => {
			if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	function close() {
		setOpen(false);
		setQuick("");
	}

	function openHit(c: Card) {
		navigate(cardHref(c));
		close();
	}

	function goToSearchPage() {
		const t = quick.trim();
		if (!t) return;
		navigate(`/search?q=${encodeURIComponent(t)}`);
		close();
	}

	function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (active >= 0 && hits[active]) openHit(hits[active]);
		else goToSearchPage();
	}

	function onKeyDown(e: React.KeyboardEvent) {
		if (!hits.length) return;
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActive((i) => (i + 1) % hits.length);
		}
		if (e.key === "ArrowUp") {
			e.preventDefault();
			setActive((i) => (i <= 0 ? hits.length - 1 : i - 1));
		}
	}

	function toggle() {
		if (!open) {
			setOpen(true);
			setTimeout(() => inputRef.current?.focus(), 50);
		} else {
			close();
		}
	}

	const showPanel = open && q.length >= 2;

	return (
			<div ref={wrapRef} className="relative">
				<form
						onSubmit={onSubmit}
						role="search"
						className={`flex items-center rounded-full transition duration-300 ${
								open
										? "bg-white shadow-[0_8px_24px_-8px_rgba(2,132,199,0.6)]"
										: "bg-white/20 hover:bg-white/30 hover:shadow-[0_0_18px_rgba(255,255,255,0.45)]"
						}`}
				>
					{/* در RTL اولین فرزند سمت راست است، پس فیلد به سمت راست باز می‌شود */}
					<input
							ref={inputRef}
							value={quick}
							onChange={(e) => setQuick(e.target.value)}
							onKeyDown={onKeyDown}
							placeholder="جست‌وجوی کارت…"
							aria-label="جست‌وجوی سریع"
							autoComplete="off"
							tabIndex={open ? 0 : -1}
							className={`appearance-none border-0 bg-transparent text-sm text-sky-950 shadow-none outline-none ring-0 transition-all duration-300 ease-out placeholder:text-sky-700/50 focus:border-0 focus:shadow-none focus:outline-none focus:ring-0 ${
									open ? "w-44 ps-4 opacity-100 sm:w-64" : "w-0 opacity-0"
							}`}
					/>
					<button
							type="button"
							onClick={toggle}
							aria-label={open ? "بستن جست‌وجو" : "باز کردن جست‌وجو"}
							title="جست‌وجو"
							className={`group grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-white hover:text-sky-700 hover:shadow-[0_0_18px_rgba(255,255,255,0.6)] outline-none transition duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 active:scale-95 ${
									open ? "text-sky-700" : "text-white"
							}`}
					>
						<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								className="transition-transform duration-300 group-hover:scale-110"
						>
							<circle cx="11" cy="11" r="7"/>
							<path d="m20 20-3.5-3.5"/>
						</svg>
					</button>
				</form>

				{/* نتایج زنده */}
				{showPanel && (
						<div
								className="absolute end-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-sky-100 bg-white p-1.5 shadow-[0_16px_40px_-12px_rgba(2,132,199,0.55)]">
							{isFetching && !hits.length ? (
									<p className="px-3 py-3 text-sm text-sky-700/70">در حال جست‌وجو…</p>
							) : hits.length === 0 ? (
									<p className="px-3 py-3 text-sm text-sky-700/70">نتیجه‌ای پیدا نشد.</p>
							) : (
									<ul role="listbox">
										{hits.map((c, i) => {
											const meta = cardMeta(c);
											return (
													<li key={c.id} role="option" aria-selected={i === active}>
														<button
																type="button"
																onMouseEnter={() => setActive(i)}
																onClick={() => openHit(c)}
																className={`flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-start transition duration-200 ${
																		i === active
																				? "bg-sky-50 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.7)]"
																				: "hover:bg-sky-50"
																}`}
														>
                      <span className="w-full truncate text-sm font-medium text-sky-950">
                        {c.title}
                      </span>
															{meta && (
																	<span className="w-full truncate text-xs text-sky-700/70">{meta}</span>
															)}
														</button>
													</li>
											);
										})}
									</ul>
							)}

							<button
									type="button"
									onClick={goToSearchPage}
									className="mt-1 w-full rounded-xl px-3 py-2 text-start text-xs font-medium text-sky-700 transition duration-200 hover:bg-sky-50"
							>
								مشاهدهٔ همهٔ نتایج برای «{quick.trim()}»
							</button>
						</div>
				)}
			</div>
	);
}