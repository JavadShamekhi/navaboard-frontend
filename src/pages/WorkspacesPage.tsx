import {useState} from "react";
import {Link} from "react-router-dom";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {workspacesApi} from "@/api/workspaces";
import {boardsApi} from "@/api/boards";
import type {Workspace} from "@/types";
import {describeError} from "@/lib/errors";

/* ───────── رنگ‌های متنوع، پایدار برای هر workspace/برد ───────── */
const PALETTE = [
	{grad: "from-sky-400 to-cyan-300", soft: "bg-sky-400/15 text-sky-200"},
	{grad: "from-violet-400 to-fuchsia-300", soft: "bg-violet-400/15 text-violet-200"},
	{grad: "from-emerald-400 to-teal-300", soft: "bg-emerald-400/15 text-emerald-200"},
	{grad: "from-amber-400 to-orange-300", soft: "bg-amber-400/15 text-amber-200"},
	{grad: "from-rose-400 to-pink-300", soft: "bg-rose-400/15 text-rose-200"},
	{grad: "from-indigo-400 to-blue-300", soft: "bg-indigo-400/15 text-indigo-200"},
];

function paletteFor(key: string | number) {
	let h = 0;
	for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
	return PALETTE[h % PALETTE.length];
}

function Avatar({ws, size = "h-9 w-9 text-sm"}: { ws: Workspace; size?: string }) {
	const p = paletteFor(ws.id);
	return (
			<span
					className={`grid shrink-0 place-items-center rounded-xl bg-gradient-to-br font-bold text-white shadow-md ${p.grad} ${size}`}>
      {ws.name.trim().charAt(0).toUpperCase() || "؟"}
    </span>
	);
}

/* ───────── کارت ساخت workspace جدید (وسط صفحه) ───────── */
function CreateWorkspaceCard({onCreate}: { onCreate: (name: string) => Promise<unknown> }) {
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
				<button
						onClick={() => setOpen(true)}
						className="group flex w-full items-center gap-4 rounded-2xl border border-dashed border-sky-300/50 bg-white/10 p-5 text-start outline-none transition duration-300 hover:-translate-y-px hover:border-sky-300 hover:bg-white/15 hover:shadow-[0_0_24px_rgba(255,255,255,0.12),0_12px_28px_-14px_rgba(14,165,233,0.6)] focus-visible:ring-2 focus-visible:ring-sky-400"
				>
        <span
		        className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-cyan-300 text-2xl font-light text-white shadow-md transition duration-300 group-hover:rotate-90 group-hover:scale-105">
          +
        </span>
					<span>
          <span className="block font-semibold text-white">فضای کاری جدید</span>
          <span className="block text-sm text-sky-200/70">برای تیم یا پروژهٔ تازه یک فضا بسازید</span>
        </span>
				</button>
		);
	}

	return (
			<form
					className="rounded-2xl border border-white/15 bg-slate-700 p-5 shadow-[0_12px_32px_-14px_rgba(0,0,0,0.5)]"
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
				<p className="mb-3 font-semibold text-white">نام فضای کاری جدید</p>
				<input
						autoFocus
						value={name}
						onChange={(e) => setName(e.target.value)}
						onKeyDown={(e) => e.key === "Escape" && cancel()}
						placeholder="مثلاً: تیم طراحی"
						className="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm text-white outline-none transition duration-300 placeholder:text-sky-200/40 focus:border-sky-400 focus:shadow-[0_0_0_4px_rgba(56,189,248,0.25)]"
				/>
				{error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
				<div className="mt-4 flex items-center gap-2 text-sm">
					<button
							type="submit"
							disabled={pending}
							className="rounded-full bg-sky-500 px-5 py-1.5 font-medium text-white transition duration-300 hover:-translate-y-px hover:bg-sky-400 hover:shadow-[0_0_0_3px_rgba(255,255,255,0.15),0_8px_20px_-6px_rgba(14,165,233,0.7)] active:scale-95 disabled:opacity-50"
					>
						{pending ? "در حال ساخت…" : "ساخت"}
					</button>
					<button
							type="button"
							onClick={cancel}
							className="rounded-full px-4 py-1.5 text-sky-200 transition duration-200 hover:bg-white/10"
					>
						انصراف
					</button>
				</div>
			</form>
	);
}

/* ───────── سایدبار: لیست workspace ───────── */
function Sidebar({
	                 workspaces,
	                 selectedId,
	                 onSelect,
                 }: {
	workspaces: Workspace[];
	selectedId: Workspace["id"] | undefined;
	onSelect: (id: Workspace["id"]) => void;
}) {
	return (
			<aside
					className="order-first flex shrink-0 gap-2 overflow-x-auto border-b border-white/10 bg-sky-200 p-3 md:w-64 md:flex-col md:gap-1 md:overflow-y-auto md:border-b-0 md:border-r md:rtl:order-none md:ltr:order-first">
				<p className="hidden px-2 pb-2 pt-1 text-xs font-semibold tracking-wide text-sky-900 md:block">
					فضاهای کاری
				</p>
				{workspaces.length === 0 && (
						<p className="hidden px-2 text-sm text-sky-900/60 md:block">هنوز چیزی نساخته‌اید.</p>
				)}
				{workspaces.map((ws) => {
					const active = ws.id === selectedId;
					return (
							<button
									key={ws.id}
									onClick={() => onSelect(ws.id)}
									aria-current={active}
									className={`flex shrink-0 items-center gap-3 rounded-xl px-2 py-2 text-start text-sm outline-none transition duration-300 focus-visible:ring-2 focus-visible:ring-sky-400 ${
											active
													? "bg-sky-800 font-medium text-white shadow-[inset_0_0_0_1px_rgba(125,211,252,0.45),0_0_18px_rgba(56,189,248,0.2)]"
													: "text-slate-600/90 hover:bg-sky-700 hover:text-white hover:shadow-[0_0_16px_rgba(255,255,255,0.08)]"
									}`}
							>
								<Avatar ws={ws}/>
								<span className="max-w-[10rem] truncate md:max-w-none">{ws.name}</span>
							</button>
					);
				})}
			</aside>
	);
}

/* ───────── بردهای workspace انتخاب‌شده ───────── */
function WorkspaceBoards({workspace}: { workspace: Workspace }) {
	const {data: boards, isLoading} = useQuery({
		queryKey: ["boards", workspace.id],
		queryFn: () => boardsApi.inWorkspace(workspace.id),
	});

	return (
			<section>
				<div className="mb-5 flex flex-wrap items-center gap-3">
					<Avatar ws={workspace} size="h-11 w-11 text-lg"/>
					<div>
						<h2 className="text-lg font-semibold text-white">{workspace.name}</h2>
						<p className="text-xs text-sky-200/60">{boards ? `${boards.length} برد` : "بردها"}</p>
					</div>
					<Link
							to={`/workspaces/${workspace.id}`}
							className="ms-auto rounded-full bg-white/15 px-4 py-1.5 text-sm text-sky-100 transition duration-300 hover:-translate-y-px hover:bg-white/25 hover:text-white hover:shadow-[0_0_18px_rgba(255,255,255,0.15)]"
					>
						مدیریت اعضا و تنظیمات
					</Link>
				</div>

				{isLoading && <p className="text-sm text-sky-200/60">در حال بارگذاری…</p>}

				{boards?.length === 0 && (
						<p className="rounded-2xl border border-dashed border-white/20 bg-white/10 p-6 text-center text-sm text-sky-200/70">
							هنوز بردی نیست؛ از صفحهٔ مدیریت یک برد بسازید.
						</p>
				)}

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{boards?.map((b) => {
						const p = paletteFor(b.id);
						return (
								<Link
										key={b.id}
										to={`/boards/${b.id}`}
										className="group overflow-hidden rounded-2xl border border-white/15 bg-slate-700 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] outline-none transition duration-300 hover:-translate-y-1 hover:border-white/30 hover:shadow-[0_0_24px_rgba(255,255,255,0.14),0_14px_30px_-12px_rgba(0,0,0,0.6)] focus-visible:ring-2 focus-visible:ring-sky-400"
								>
									<div
											className={`h-16 bg-gradient-to-br transition duration-500 group-hover:brightness-110 ${p.grad}`}/>
									<div className="p-4">
										<p className="truncate font-semibold text-white">{b.name}</p>
										<span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs ${p.soft}`}>
                  {b.visibility === "private" ? "خصوصی" : "قابل‌مشاهده برای فضای کاری"}
                </span>
									</div>
								</Link>
						);
					})}
				</div>
			</section>
	);
}

/* ───────── صفحهٔ اصلی ───────── */
export default function WorkspacesPage() {
	const queryClient = useQueryClient();
	const [selectedId, setSelectedId] = useState<Workspace["id"] | undefined>();

	const {data: workspaces, isLoading, error} = useQuery({
		queryKey: ["workspaces"],
		queryFn: workspacesApi.list,
	});
	const create = useMutation({
		mutationFn: workspacesApi.create,
		onSuccess: () => queryClient.invalidateQueries({queryKey: ["workspaces"]}),
	});

	if (isLoading) return <div className="h-full bg-slate-800 p-8 text-sky-200/70">در حال بارگذاری…</div>;
	if (error) return <div className="h-full bg-slate-800 p-8 text-rose-300">{describeError(error)}</div>;

	const list = workspaces ?? [];
	const selected = list.find((w) => w.id === selectedId) ?? list[0];

	async function handleCreate(name: string) {
		const created = (await create.mutateAsync(name)) as Partial<Workspace> | undefined;
		// بعد از ساخت، workspace جدید انتخاب شود
		if (created && created.id !== undefined) setSelectedId(created.id);
	}

	return (
			<div className="flex h-full min-h-0 flex-col md:flex-row">
				{/* در RTL چون آخرین فرزند است، سمت چپ قرار می‌گیرد */}
				<main
						className="min-h-0 flex-1 overflow-y-auto bg-slate-800 [background-image:radial-gradient(rgba(125,211,252,0.15)_1px,transparent_1px)] [background-size:22px_22px]">
					<div className="mx-auto max-w-4xl space-y-8 px-6 py-8">
						<div>
							<h1 className="text-2xl font-bold text-white">فضاهای کاری</h1>
							{list.length === 0 && (
									<p className="mt-1 text-sm text-sky-200/70">
										هنوز فضای کاری ندارید. اولین فضای کاری را بسازید.
									</p>
							)}
						</div>

						<CreateWorkspaceCard onCreate={handleCreate}/>

						{selected && <WorkspaceBoards key={selected.id} workspace={selected}/>}
					</div>
				</main>

				<Sidebar workspaces={list} selectedId={selected?.id} onSelect={setSelectedId}/>
			</div>
	);
}