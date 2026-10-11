import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cardsApi } from "@/api/cards";
import { describeError } from "@/lib/errors";
import { Status, useAction } from "@/components/ui";
import Block from "./Block";
import type { Checklist } from "@/types";

const byPos = <T extends { position: number }>(a: T, b: T) => a.position - b.position;
const smallInput = "w-full rounded-chip border border-transparent px-2 py-1 text-sm outline-none hover:border-line focus:border-teal";

export default function ChecklistsSection({ cardId }: { cardId: string }) {
  const qc = useQueryClient();
  const key = ["checklists", cardId];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => cardsApi.checklists(cardId) });
  const lists = [...(data ?? [])].sort(byPos);
  const [title, setTitle] = useState("");
  const act = useAction();
  // Every mutation re-reads the checklists: the server owns the order (positions are 0-based).
  const run = (fn: () => Promise<unknown>) => act.run(async () => { await fn(); await qc.invalidateQueries({ queryKey: key }); });
  // Ticking is optimistic: show it at once, roll back if the server refuses, then re-read the truth.
  const toggle = (itemId: string, checked: boolean) => act.run(async () => {
    const prev = qc.getQueryData<Checklist[]>(key);
    qc.setQueryData<Checklist[]>(key, (old) => old?.map((c) => ({ ...c, items: (c.items ?? []).map((i) => (i.id === itemId ? { ...i, is_completed: checked } : i)) })));
    try { await cardsApi.toggleChecklistItem(itemId, checked); }
    catch (e) { qc.setQueryData(key, prev); throw e; }
    finally { qc.invalidateQueries({ queryKey: key }); }
  });

  return (
    <Block title="چک‌لیست‌ها">
      {isLoading && <p className="text-sm text-inkSoft">در حال بارگذاری…</p>}
      {error && <p className="text-sm text-rose">{describeError(error)}</p>}
      {data?.length === 0 && <p className="text-sm text-inkSoft">هنوز چک‌لیستی اضافه نشده.</p>}
      {lists.map((cl, i) => <ChecklistView key={cl.id} cl={cl} index={i} count={lists.length} busy={act.pending} run={run} onToggle={toggle} />)}
      <Status error={act.error} ok={null} />
      <form className="flex gap-2" onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        run(() => cardsApi.addChecklist(cardId, title.trim())).then(() => setTitle(""));
      }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان چک‌لیست جدید" className="flex-1 rounded-chip border border-line px-3 py-1.5 text-sm outline-none focus:border-teal" />
        <button className="rounded-chip bg-ink px-3 py-1.5 text-sm text-white">افزودن</button>
      </form>
    </Block>
  );
}

function Arrows({ index, count, busy, onMove }: { index: number; count: number; busy: boolean; onMove: (pos: number) => void }) {
  return (
    <span className="flex flex-col leading-none">
      <button aria-label="بالا" disabled={busy || index === 0} onClick={() => onMove(index - 1)} className="text-[10px] text-inkSoft disabled:opacity-30">▲</button>
      <button aria-label="پایین" disabled={busy || index === count - 1} onClick={() => onMove(index + 1)} className="text-[10px] text-inkSoft disabled:opacity-30">▼</button>
    </span>
  );
}

function ChecklistView({ cl, index, count, busy, run, onToggle }: { cl: Checklist; index: number; count: number; busy: boolean; run: (fn: () => Promise<unknown>) => Promise<void>; onToggle: (itemId: string, checked: boolean) => void }) {
  const [title, setTitle] = useState(cl.title);
  const [newItem, setNewItem] = useState("");
  useEffect(() => setTitle(cl.title), [cl.title]);
  const items = [...(cl.items ?? [])].sort(byPos);
  const done = items.filter((i) => i.is_completed).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <div className="rounded-chip border border-line p-3" data-testid="checklist">
      <div className="mb-2 flex items-center gap-2">
        <Arrows index={index} count={count} busy={busy} onMove={(pos) => run(() => cardsApi.moveChecklist(cl.id, pos))} />
        <input value={title} aria-label="عنوان چک‌لیست" onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title.trim() !== cl.title && run(() => cardsApi.updateChecklist(cl.id, title.trim()))}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          className={smallInput + " font-medium"} />
        <span className="shrink-0 text-xs text-inkSoft" data-testid="progress">{done}/{items.length}</span>
        <button disabled={busy} className="shrink-0 text-xs text-rose hover:underline" onClick={() => {
          if (window.confirm(`چک‌لیست «${cl.title}» حذف شود؟`)) run(() => cardsApi.deleteChecklist(cl.id));
        }}>حذف چک‌لیست</button>
      </div>
      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-paper"><div className="h-full bg-teal transition-all" style={{ width: `${pct}%` }} /></div>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={it.id} className="flex items-center gap-2 text-sm">
            <Arrows index={i} count={items.length} busy={busy} onMove={(pos) => run(() => cardsApi.moveChecklistItem(it.id, pos))} />
            <input type="checkbox" checked={it.is_completed} onChange={(e) => onToggle(it.id, e.target.checked)} />
            <span className={`flex-1 ${it.is_completed ? "text-inkSoft line-through" : ""}`}>{it.title}</span>
            <button disabled={busy} className="text-xs text-inkSoft hover:text-rose" aria-label="حذف آیتم" onClick={() => run(() => cardsApi.deleteChecklistItem(it.id))}>✕</button>
          </li>
        ))}
      </ul>
      <form className="mt-2" onSubmit={(e) => {
        e.preventDefault();
        if (!newItem.trim()) return;
        run(() => cardsApi.addChecklistItem(cl.id, newItem.trim())).then(() => setNewItem(""));
      }}>
        <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="+ آیتم جدید" className={smallInput} />
      </form>
    </div>
  );
}
