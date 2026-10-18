import {useMemo, useState} from "react";
import {Link} from "react-router-dom";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {workspacesApi} from "@/api/workspaces";
import {boardsApi} from "@/api/boards";
import type {Workspace} from "@/types";
import {describeError} from "@/lib/errors";
import {sortByRecent, touchBoard, touchWorkspace, useRecent} from "@/lib/recent";

const WS_PER_PAGE = 7;
const BOARDS_PER_PAGE = 6;

/*
  پالت پروژه:
  #FFDA78 زرد  |  #FF7F3E نارنجی  |  #2A629A آبی میانی  |  #003285 آبی تیره  |  سفید
  آواتار فضاهای کاری: #CA4E79 → #7A4069   |   سایدبار: #FBF8F1 (شیری)
*/

const fa = (n: number) => n.toLocaleString("fa-IR");

/* ───────── آیکون‌ها ───────── */
function Icon({d, size = 16}: {d: string; size?: number}) {
	return (
			<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
			     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
				<path d={d}/>
			</svg>
	);
}
const I = {
	chevron: "m9 6 6 6-6 6", // به سمت راست
	plus: "M12 5v14M5 12h14",
	lock: "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z",
	users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
	arrow: "M5 12h14m-6-6 6 6-6 6",
};

/* ───────── Avatar: رنگ ثابت برای همه‌ی فضاهای کاری ───────── */
function Avatar({ws, size = "h-8 w-8 text-sm"}: {ws: Workspace; size?: string}) {
	return (
			<span className={`grid shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#3F979B] to-[#205E61] font-semibold text-white shadow-sm ${size}`}>
      {ws.name.trim().charAt(0).toUpperCase() || "؟"}
    </span>
	);
}

/* ───────── Pagination ───────── */
function pageWindow(page: number, pages: number): (number | "…")[] {
	const set = new Set([1, pages, page - 1, page, page + 1]);
	const nums = [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
	const out: (number | "…")[] = [];
	nums.forEach((n, i) => {
		if (i && n - nums[i - 1] > 1) out.push("…");
		out.push(n);
	});
	return out;
}

const pgBtn =
		"grid h-8 min-w-8 place-items-center rounded-lg px-2 text-xs font-medium outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-[#FF7F3E] disabled:pointer-events-none disabled:opacity-30";
const pgIdle = "text-[#2A629A] hover:bg-[#FFDA78]/30 hover:text-[#003285]";

function Pager({page, pages, onChange, compact = false, className = ""}: {
	page: number; pages: number; onChange: (p: number) => void; compact?: boolean; className?: string;
}) {
	if (pages <= 1) return null;
	return (
			<nav aria-label="صفحه‌بندی" className={`flex items-center justify-center gap-1 ${className}`}>
				<button type="button" aria-label="صفحه‌ی قبل" disabled={page <= 1} onClick={() => onChange(page - 1)}
				        className={`${pgBtn} ${pgIdle}`}>
					<span className="ltr:rotate-180"><Icon d={I.chevron}/></span>
				</button>

				{compact ? (
						<span className="px-2 text-xs text-[#2A629A]">{fa(page)} / {fa(pages)}</span>
				) : (
						pageWindow(page, pages).map((n, i) =>
								n === "…" ? (
										<span key={`e${i}`} className="px-1 text-xs text-[#2A629A]/50">…</span>
								) : (
										<button key={n} type="button" aria-current={n === page ? "page" : undefined} onClick={() => onChange(n)}
										        className={`${pgBtn} ${
												        n === page
														        ? "bg-[#003285] font-semibold text-white shadow-[0_4px_12px_-4px_rgba(0,50,133,0.6)]"
														        : pgIdle
										        }`}>
											{fa(n)}
										</button>
								),
						)
				)}

				<button type="button" aria-label="صفحه‌ی بعد" disabled={page >= pages} onClick={() => onChange(page + 1)}
				        className={`${pgBtn} ${pgIdle}`}>
					<span className="rtl:rotate-180"><Icon d={I.chevron}/></span>
				</button>
			</nav>
	);
}

/* ───────── ساخت workspace (کنار عنوان صفحه) ───────── */
function CreateWorkspace({onCreate}: {onCreate: (name: string) => Promise<unknown>}) {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	function cancel() {
		setOpen(false);
		setName("");
		setError(null);
	}

	if (!open) {
		return (
				<button type="button" onClick={() => setOpen(true)}
				        className="inline-flex items-center gap-1.5 rounded-lg bg-[#FF7F3E] px-3.5 py-2 text-sm font-semibold text-white outline-none transition duration-200 hover:-translate-y-px hover:bg-[#f26f2d] hover:shadow-[0_8px_20px_-6px_rgba(255,127,62,0.7)] focus-visible:ring-2 focus-visible:ring-[#FFDA78] focus-visible:ring-offset-2 active:scale-95">
					<Icon d={I.plus}/>
					فضای کاری جدید
				</button>
		);
	}

	return (
			<form
					className="w-full sm:w-auto"
					onSubmit={async (e) => {
						e.preventDefault();
						if (!name.trim() || pending) return;
						setPending(true);
						try {
							await onCreate(name.trim());
							cancel();
						} catch (err) {
							setError(describeError(err));
						} finally {
							setPending(false);
						}
					}}
			>
				<div className="flex items-center gap-2">
					<input
							autoFocus
							value={name}
							onChange={(e) => setName(e.target.value)}
							onKeyDown={(e) => e.key === "Escape" && cancel()}
							placeholder="نام فضای کاری، مثلاً تیم طراحی"
							className="min-w-0 flex-1 rounded-lg border border-[#2A629A]/40 bg-white px-3 py-2 text-sm text-[#003285] outline-none transition placeholder:text-[#2A629A]/50 focus:border-[#FF7F3E] focus:ring-4 focus:ring-[#FFDA78]/40 sm:w-64"
					/>
					<button type="submit" disabled={pending || !name.trim()}
					        className="rounded-lg bg-[#FF7F3E] px-3.5 py-2 text-sm font-semibold text-white outline-none transition hover:bg-[#f26f2d] focus-visible:ring-2 focus-visible:ring-[#FFDA78] active:scale-95 disabled:opacity-40">
						{pending ? "…" : "ساخت"}
					</button>
					<button type="button" onClick={cancel}
					        className="rounded-lg px-3 py-2 text-sm text-[#2A629A] outline-none transition hover:bg-[#2A629A]/10 hover:text-[#003285] focus-visible:ring-2 focus-visible:ring-[#FF7F3E]">
						انصراف
					</button>
				</div>
				{error && <p className="mt-1.5 text-xs text-[#d9480f]">{error}</p>}
			</form>
	);
}

/* ───────── سایدبار (شیری با سایه‌ی نرم) ───────── */
function Sidebar({workspaces, selectedId, onSelect}: {
	workspaces: Workspace[];
	selectedId: Workspace["id"] | undefined;
	onSelect: (id: Workspace["id"]) => void;
}) {
	const [page, setPage] = useState(1);
	const pages = Math.max(1, Math.ceil(workspaces.length / WS_PER_PAGE));
	const safePage = Math.min(page, pages);
	const start = (safePage - 1) * WS_PER_PAGE;

	return (
			<aside className="order-first z-10 flex shrink-0 gap-1.5 overflow-x-auto border-b border-[#003285]/10 bg-[#FBF8F1] p-3 shadow-[0_4px_16px_-8px_rgba(0,50,133,0.25)] md:w-64 md:flex-col md:gap-0.5 md:overflow-y-auto md:border-b-0 md:border-r md:shadow-[0_0_28px_-10px_rgba(0,50,133,0.3)] md:rtl:order-none md:ltr:order-first">
				<p className="hidden px-2 pb-2 pt-1 text-[11px] font-semibold tracking-wide text-[#2A629A] md:block">
					فضاهای کاری
				</p>
				{workspaces.length === 0 && (
						<p className="hidden px-2 text-sm text-[#2A629A]/70 md:block">هنوز چیزی نساخته‌اید.</p>
				)}

				{workspaces.map((ws, i) => {
					const active = ws.id === selectedId;
					const inPage = i >= start && i < start + WS_PER_PAGE;
					return (
							<button
									key={ws.id}
									type="button"
									onClick={() => onSelect(ws.id)}
									aria-current={active}
									className={`group relative flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-[#FF7F3E] ${
											inPage ? "" : "md:hidden"
									} ${
											active
													? "bg-[#FFDA78]/40 font-semibold text-[#003285]"
													: "text-[#2A629A] hover:bg-white hover:text-[#003285] hover:shadow-sm"
									}`}
							>
								{active && (
										<span className="absolute inset-y-2 start-0 hidden w-0.5 rounded-full bg-[#FF7F3E] md:block"/>
								)}
								<span className="transition duration-200 group-hover:scale-105"><Avatar ws={ws}/></span>
								<span className="max-w-[10rem] truncate md:max-w-none">{ws.name}</span>
							</button>
					);
				})}

				<Pager page={safePage} pages={pages} onChange={setPage} compact className="mt-2 hidden md:flex"/>
			</aside>
	);
}

/* ───────── بردهای workspace انتخاب‌شده ───────── */
function WorkspaceBoards({workspace}: {workspace: Workspace}) {
	const [page, setPage] = useState(1);
	const {store} = useRecent();
	const {data: boards, isLoading} = useQuery({
		queryKey: ["boards", workspace.id],
		queryFn: () => boardsApi.inWorkspace(workspace.id),
	});

	// بردهای اخیر اول، بقیه با ترتیب اصلی
	const list = useMemo(
			() => sortByRecent(boards ?? [], store.boards[String(workspace.id)] ?? []),
			[boards, store, workspace.id],
	);
	const pages = Math.max(1, Math.ceil(list.length / BOARDS_PER_PAGE));
	const safePage = Math.min(page, pages);
	const visible = list.slice((safePage - 1) * BOARDS_PER_PAGE, safePage * BOARDS_PER_PAGE);
	const isLast = safePage === pages;

	return (
			<section>
				<div className="mb-4 flex flex-wrap items-center gap-3">
					<Avatar ws={workspace} size="h-10 w-10 text-base"/>
					<div className="min-w-0">
						<h2 className="truncate text-base font-semibold text-[#003285]">{workspace.name}</h2>
						<p className="text-xs text-[#2A629A]">{boards ? `${fa(list.length)} برد` : "بردها"}</p>
					</div>
					<Link
							to={`/workspaces/${workspace.id}`}
							onClick={() => touchWorkspace(workspace.id)}
							className="ms-auto inline-flex items-center gap-1.5 rounded-lg border border-[#2A629A]/30 bg-white px-3 py-1.5 text-sm text-[#2A629A] outline-none transition duration-200 hover:border-[#FF7F3E] hover:bg-[#FFDA78]/20 hover:text-[#003285] focus-visible:ring-2 focus-visible:ring-[#FF7F3E]"
					>
						<Icon d={I.users} size={15}/>
						مدیریت اعضا و تنظیمات
					</Link>
				</div>

				{isLoading && (
						<div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
							{Array.from({length: 3}).map((_, i) => (
									<div key={i} className="h-[104px] animate-pulse rounded-xl bg-[#2A629A]/10"/>
							))}
						</div>
				)}

				{!isLoading && (
						<div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
							{visible.map((b) => (
									<Link
											key={b.id}
											to={`/boards/${b.id}`}
											onClick={() => touchBoard(workspace.id, b.id)}
											className="group relative overflow-hidden rounded-xl border border-[#2A629A]/20 bg-white shadow-[0_2px_8px_-4px_rgba(0,50,133,0.25)] outline-none transition duration-200 hover:-translate-y-0.5 hover:border-[#FF7F3E]/70 hover:shadow-[0_14px_28px_-12px_rgba(255,127,62,0.55)] focus-visible:ring-2 focus-visible:ring-[#FF7F3E]"
									>
										{/* سربرگ تخت، بدون گرادیان */}
										<div className="h-12 bg-[#FFDA78] transition duration-300 group-hover:bg-[#CA4E79]"/>
										<div className="p-3">
											<p className="truncate text-sm font-medium text-[#003285]">{b.name}</p>
											<p className="mt-1 flex items-center gap-1 text-[11px] text-[#2A629A]">
												{b.visibility === "private" && <Icon d={I.lock} size={12}/>}
												{b.visibility === "private" ? "خصوصی" : "قابل‌مشاهده برای فضای کاری"}
											</p>
										</div>
										<span className="absolute end-2.5 top-[3.4rem] text-[#FF7F3E] opacity-0 transition duration-200 group-hover:opacity-100 rtl:-scale-x-100">
                <Icon d={I.arrow} size={15}/>
              </span>
									</Link>
							))}

							{isLast && (
									<Link
											to={`/workspaces/${workspace.id}`}
											onClick={() => touchWorkspace(workspace.id)}
											className="group flex min-h-[104px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#2A629A]/40 text-sm text-[#2A629A] outline-none transition duration-200 hover:border-[#FF7F3E] hover:bg-[#FFDA78]/20 hover:text-[#003285] focus-visible:ring-2 focus-visible:ring-[#FF7F3E]"
									>
										<span className="transition duration-300 group-hover:rotate-90"><Icon d={I.plus} size={18}/></span>
										ساخت برد جدید
									</Link>
							)}
						</div>
				)}

				<Pager page={safePage} pages={pages} onChange={setPage} className="mt-6"/>
			</section>
	);
}

/* ───────── صفحه‌ی اصلی ───────── */
export default function WorkspacesPage() {
	const queryClient = useQueryClient();
	const [selectedId, setSelectedId] = useState<Workspace["id"] | undefined>();
	const {store, refresh} = useRecent();

	const {data: workspaces, isLoading, error} = useQuery({
		queryKey: ["workspaces"],
		queryFn: workspacesApi.list,
	});
	const create = useMutation({
		mutationFn: workspacesApi.create,
		onSuccess: () => queryClient.invalidateQueries({queryKey: ["workspaces"]}),
	});

	// workspace های اخیر اول. این هوک باید قبل از return های شرطی باشد.
	const list = useMemo(() => sortByRecent(workspaces ?? [], store.ws), [workspaces, store.ws]);

	if (isLoading) return <div className="h-full bg-white p-8 text-sm text-[#2A629A]">در حال بارگذاری…</div>;
	if (error) return <div className="h-full bg-white p-8 text-sm text-[#d9480f]">{describeError(error)}</div>;

	// اگر کاربر دستی چیزی انتخاب نکرده، اولین مورد (آخرین workspace استفاده‌شده)
	const selected = list.find((w) => w.id === selectedId) ?? list[0];

	async function handleCreate(name: string) {
		const created = (await create.mutateAsync(name)) as Partial<Workspace> | undefined;
		// بعد از ساخت، workspace جدید انتخاب شود
		if (created && created.id !== undefined) {
			setSelectedId(created.id);
			touchWorkspace(created.id);
			refresh();
		}
	}

	return (
			<div className="flex h-full min-h-0 flex-col md:flex-row">
				{/* در RTL چون آخرین فرزند است، سمت چپ قرار می‌گیرد */}
				<main className="min-h-0 flex-1 overflow-y-auto bg-white [background-image:radial-gradient(rgba(42,98,154,0.09)_1px,transparent_1px)] [background-size:24px_24px]">
					<div className="mx-auto max-w-4xl space-y-7 px-5 py-7 sm:px-8">
						<div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2A629A]/15 pb-5">
							<div>
								<h1 className="text-xl font-semibold text-[#003285]">فضاهای کاری</h1>
								<p className="mt-0.5 text-sm text-[#2A629A]">
									{list.length === 0 ? "هنوز فضای کاری ندارید. اولین فضای کاری را بسازید." : `${fa(list.length)} فضای کاری`}
								</p>
							</div>
							<CreateWorkspace onCreate={handleCreate}/>
						</div>

						{selected && <WorkspaceBoards key={selected.id} workspace={selected}/>}
					</div>
				</main>

				<Sidebar
						workspaces={list}
						selectedId={selected?.id}
						onSelect={(id) => {
							setSelectedId(id);
							touchWorkspace(id); // ترتیب لیست بعد از برگشتن به صفحه عوض می‌شود
						}}
				/>
			</div>
	);
}