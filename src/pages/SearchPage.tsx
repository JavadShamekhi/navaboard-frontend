import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { searchApi, type CardSearchParams } from "@/api/search";
import { workspacesApi } from "@/api/workspaces";
import { boardsApi } from "@/api/boards";
import { describeError } from "@/lib/errors";
import type { Board, Card } from "@/types";

const sel = "rounded-chip border border-line bg-white px-2 py-1.5 text-sm";
const toIso = (local: string) => new Date(local).toISOString(); // the API requires timezone-aware dates

function cardBoardId(c: Card, fallback: string) {
  const r = c as unknown as { board_id?: string; board?: string | { id?: string } };
  return r.board_id ?? (typeof r.board === "string" ? r.board : r.board?.id) ?? (fallback || undefined);
}

export default function SearchPage() {
  const [sp, setSp] = useSearchParams();
  // The URL is the source of truth: results are shareable and the navbar search can link here.
  const q = sp.get("q") ?? "", ws = sp.get("ws") ?? "", board = sp.get("board") ?? "";
  const mine = sp.get("mine") === "1", before = sp.get("before") ?? "", after = sp.get("after") ?? "";
  const page = Number(sp.get("page") ?? 1) || 1;
  const set = (patch: Record<string, string | null>, keepPage = false) => {
    const n = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    if (!keepPage) n.delete("page");
    setSp(n, { replace: true });
  };

  // Debounce typing so every keystroke is not a request.
  const [text, setText] = useState(q);
  useEffect(() => setText(q), [q]);
  useEffect(() => {
    const t = setTimeout(() => { if (text !== q) set({ q: text.trim() || null }); }, 350);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasFilters = !!(q.trim() || ws || board || mine || before || after);
  const params: CardSearchParams = {
    q: q.trim() || undefined, workspace_id: ws || undefined, board_id: board || undefined, assigned_to_me: mine || undefined,
    due_before: before ? toIso(before) : undefined, due_after: after ? toIso(after) : undefined, page: page > 1 ? page : undefined,
  };
  // A changed phrase changes the query key: a late answer for an old phrase can never replace the current results.
  const cards = useQuery({ queryKey: ["search-cards", params], queryFn: () => searchApi.cards(params), enabled: hasFilters, placeholderData: keepPreviousData });
  const boards = useQuery({
    queryKey: ["search-boards", q.trim()],
    queryFn: async () => { const d = await searchApi.boards(q.trim()); return Array.isArray(d) ? d : d.results; },
    enabled: !!q.trim(),
  });
  // Board search parameters are not confirmed by the schema: also filter by name here so the list is right either way.
  const boardHits = (boards.data ?? []).filter((b: Board) => b.name.toLowerCase().includes(q.trim().toLowerCase()) && (!ws || b.workspace_id === ws));

  const { data: workspaces } = useQuery({ queryKey: ["workspaces"], queryFn: workspacesApi.list });
  const { data: wsBoards } = useQuery({ queryKey: ["boards", ws], queryFn: () => boardsApi.inWorkspace(ws), enabled: !!ws });

  const results = cards.data?.results ?? [];
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-6 py-10">
      <h1 className="text-2xl font-semibold">جست‌وجو</h1>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="عنوان یا توضیح کارت…" aria-label="عبارت جست‌وجو" autoFocus
        className="w-full rounded-card border border-line bg-paperRaised px-4 py-2.5 outline-none focus:border-teal" />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <select aria-label="فضای کاری" value={ws} onChange={(e) => set({ ws: e.target.value || null, board: null })} className={sel}>
          <option value="">همه‌ی فضاهای کاری</option>
          {workspaces?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select aria-label="برد" value={board} disabled={!ws} onChange={(e) => set({ board: e.target.value || null })} className={sel + " disabled:opacity-50"}>
          <option value="">همه‌ی بردها</option>
          {wsBoards?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <label className="flex items-center gap-1"><input type="checkbox" checked={mine} onChange={(e) => set({ mine: e.target.checked ? "1" : null })} /> فقط مسئولیت‌های من</label>
        <label className="flex items-center gap-1">موعد بعد از <input type="datetime-local" dir="ltr" value={after} onChange={(e) => set({ after: e.target.value || null })} className={sel} /></label>
        <label className="flex items-center gap-1">موعد قبل از <input type="datetime-local" dir="ltr" value={before} onChange={(e) => set({ before: e.target.value || null })} className={sel} /></label>
        {hasFilters && <button onClick={() => { setText(""); setSp({}, { replace: true }); }} className="text-inkSoft hover:underline">پاک‌کردن فیلترها</button>}
      </div>

      {!hasFilters && <p className="text-inkSoft">یک عبارت بنویسید یا فیلتری انتخاب کنید.</p>}
      {cards.error && <p className="text-rose">{describeError(cards.error)}</p>}

      {boardHits.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-inkSoft">بردها</h2>
          <div className="flex flex-wrap gap-2">
            {boardHits.map((b) => <Link key={b.id} to={`/boards/${b.id}`} data-testid="board-hit" className="rounded-chip border border-line bg-paperRaised px-3 py-1.5 text-sm hover:border-teal">{b.name}</Link>)}
          </div>
        </section>
      )}

      {hasFilters && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-inkSoft">کارت‌ها{cards.data ? ` (${cards.data.count})` : ""}</h2>
          {cards.isLoading && <p className="text-inkSoft">در حال جست‌وجو…</p>}
          {!cards.isLoading && !cards.error && results.length === 0 && <p className="text-inkSoft">نتیجه‌ای پیدا نشد.</p>}
          <ul className="space-y-2">
            {results.map((c) => {
              const bid = cardBoardId(c, board);
              const due = c.due_at ? new Date(c.due_at) : null;
              const body = (
                <>
                  <p className="font-medium">{c.title}</p>
                  {c.description && <p className="mt-0.5 line-clamp-2 text-xs text-inkSoft">{c.description}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-inkSoft">
                    {c.labels?.map((l) => <span key={l.id} className="rounded-chip px-1.5 py-0.5 text-white" style={{ backgroundColor: l.color }}>{l.name}</span>)}
                    {due && !Number.isNaN(due.getTime()) && <span>موعد: {due.toLocaleDateString("fa-IR")}</span>}
                    {!!c.assignees?.length && <span>{c.assignees.length} مسئول</span>}
                  </div>
                </>
              );
              return (
                <li key={c.id} data-testid="search-hit">
                  {bid ? <Link to={`/boards/${bid}?card=${c.id}`} className="block rounded-card border border-line bg-paperRaised p-3 shadow-card hover:border-teal">{body}</Link>
                       : <div className="rounded-card border border-line bg-paperRaised p-3 shadow-card">{body}</div>}
                </li>
              );
            })}
          </ul>
          {(cards.data?.next || cards.data?.previous) && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <button disabled={!cards.data?.previous} onClick={() => set({ page: page > 2 ? String(page - 1) : null }, true)} className="text-teal disabled:opacity-40">قبلی</button>
              <span className="text-xs text-inkSoft">صفحه {page}</span>
              <button disabled={!cards.data?.next} onClick={() => set({ page: String(page + 1) }, true)} className="text-teal disabled:opacity-40">بعدی</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
