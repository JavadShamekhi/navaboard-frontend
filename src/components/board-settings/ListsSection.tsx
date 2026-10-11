import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { boardsApi } from "@/api/boards";
import { describeError } from "@/lib/errors";
import { Section, Status, btnCls, inputCls, useAction } from "@/components/ui";
import type { List } from "@/types";

export default function ListsSection({ boardId }: { boardId: string }) {
  const qc = useQueryClient();
  const key = ["lists", boardId];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => boardsApi.lists(boardId) });
  const lists = [...(data ?? [])].sort((a, b) => a.position - b.position);
  const [title, setTitle] = useState("");
  const add = useAction();
  const row = useAction();
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["board", boardId] }); };

  return (
    <Section title="ستون‌ها" hint="نام ستون را تغییر دهید، ترتیب را با فلش‌ها عوض کنید یا ستون را حذف کنید. حذف ستون، کارت‌هایش را هم از دسترس خارج می‌کند.">
      {isLoading && <p className="text-sm text-inkSoft">در حال بارگذاری…</p>}
      {error && <p className="text-sm text-rose">{describeError(error)}</p>}
      <ul className="divide-y divide-line">
        {lists.map((l, i) => (
          <ListRow key={l.id + l.title} list={l} index={i} count={lists.length} busy={row.pending}
            onRename={(t) => row.run(async () => { await boardsApi.updateList(boardId, l.id, { title: t }); refresh(); })}
            // Positions are 0-based; moving up/down means index -/+ 1 (valid range 0..count-1).
            onMove={(pos) => row.run(async () => { await boardsApi.moveList(boardId, l.id, pos); refresh(); })}
            onDelete={() => {
              if (!window.confirm(`ستون «${l.title}» و کارت‌هایش حذف شود؟`)) return;
              row.run(async () => { await boardsApi.deleteList(boardId, l.id); refresh(); });
            }} />
        ))}
      </ul>
      <Status error={row.error} ok={null} />
      <form className="flex gap-2 border-t border-line pt-3" onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        add.run(async () => { await boardsApi.createList(boardId, title.trim()); setTitle(""); refresh(); }, "ستون اضافه شد.");
      }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ستون جدید" className={inputCls} />
        <button disabled={add.pending} className={btnCls}>افزودن</button>
      </form>
      <Status error={add.error} ok={add.ok} />
    </Section>
  );
}

function ListRow({ list, index, count, busy, onRename, onMove, onDelete }: {
  list: List; index: number; count: number; busy: boolean;
  onRename: (title: string) => void; onMove: (position: number) => void; onDelete: () => void;
}) {
  const [title, setTitle] = useState(list.title);
  return (
    <li className="flex items-center gap-2 py-2">
      <div className="flex flex-col">
        <button aria-label="بالا" disabled={busy || index === 0} onClick={() => onMove(index - 1)} className="text-xs text-inkSoft disabled:opacity-30">▲</button>
        <button aria-label="پایین" disabled={busy || index === count - 1} onClick={() => onMove(index + 1)} className="text-xs text-inkSoft disabled:opacity-30">▼</button>
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls}
        onBlur={() => title.trim() && title.trim() !== list.title && onRename(title.trim())}
        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} />
      <button disabled={busy} onClick={onDelete} className="text-sm text-rose hover:underline">حذف</button>
    </li>
  );
}
