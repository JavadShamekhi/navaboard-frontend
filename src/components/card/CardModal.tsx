import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { boardsApi } from "@/api/boards";
import { cardsApi } from "@/api/cards";
import { describeError } from "@/lib/errors";

export default function CardModal({ boardId, cardId, onClose }: { boardId: string; cardId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: card } = useQuery({ queryKey: ["card", cardId], queryFn: () => boardsApi.getCard(boardId, cardId) });
  const { data: checklists } = useQuery({ queryKey: ["checklists", cardId], queryFn: () => cardsApi.checklists(cardId) });
  const { data: comments } = useQuery({ queryKey: ["comments", cardId], queryFn: () => cardsApi.comments(cardId) });

  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [newChecklist, setNewChecklist] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (card) { setDescription(card.description ?? ""); setTitle(card.title); } }, [card?.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function act(fn: () => Promise<unknown>, invalidate: unknown[][]) {
    setError(null);
    try { await fn(); invalidate.forEach((k) => qc.invalidateQueries({ queryKey: k })); } catch (e) { setError(describeError(e)); }
  }

  if (!card) return null;
  const board = ["board", boardId], cardKey = ["card", cardId];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-6" onClick={onClose}>
      <div role="dialog" aria-label={card.title} onClick={(e) => e.stopPropagation()} className="mt-10 w-full max-w-2xl rounded-card bg-paperRaised p-6 shadow-raised">
        <div className="mb-4 flex items-start justify-between gap-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="عنوان کارت"
            onBlur={() => title.trim() && title.trim() !== card.title && act(() => boardsApi.updateCard(boardId, cardId, { title: title.trim() }), [board, cardKey])}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
            className="w-full rounded-chip border border-transparent px-1 text-lg font-semibold outline-none hover:border-line focus:border-teal" />
          <button onClick={onClose} className="text-inkSoft hover:text-ink">بستن</button>
        </div>
        {error && <p className="mb-3 rounded-chip bg-rose-soft px-3 py-2 text-sm text-rose">{error}</p>}

        <section className="mb-6">
          <h3 className="mb-2 text-sm font-medium text-inkSoft">توضیحات</h3>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="توضیحی برای این کارت بنویسید…"
            onBlur={() => description !== (card.description ?? "") && act(() => boardsApi.updateCard(boardId, cardId, { description }), [board, cardKey])}
            className="w-full resize-none rounded-chip border border-line p-2 text-sm outline-none focus:border-teal" />
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-sm font-medium text-inkSoft">موعد انجام</h3>
          <div className="flex items-center gap-2">
            {/* The API wants a timezone-aware value: send ISO with Z; null clears the date. */}
            <input type="datetime-local" dir="ltr" value={toLocalInput(card.due_at)} aria-label="موعد انجام"
              onChange={(e) => e.target.value && act(() => boardsApi.updateCard(boardId, cardId, { due_at: new Date(e.target.value).toISOString() }), [board, cardKey])}
              className="rounded-chip border border-line px-2 py-1.5 text-sm outline-none focus:border-teal" />
            {card.due_at && <button onClick={() => act(() => boardsApi.updateCard(boardId, cardId, { due_at: null }), [board, cardKey])} className="text-sm text-inkSoft hover:underline">حذف موعد</button>}
          </div>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-sm font-medium text-inkSoft">چک‌لیست‌ها</h3>
          <div className="space-y-4">
            {checklists?.map((cl) => (
              <div key={cl.id}>
                <p className="mb-1 text-sm font-medium">{cl.title}</p>
                <ul className="space-y-1">
                  {cl.items.map((it) => (
                    <li key={it.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={it.is_completed} onChange={(e) => act(() => cardsApi.toggleChecklistItem(it.id, e.target.checked), [["checklists", cardId]])} />
                      <span className={it.is_completed ? "text-inkSoft line-through" : ""}>{it.title}</span>
                    </li>
                  ))}
                </ul>
                <form className="mt-1" onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.currentTarget.elements.namedItem("t") as HTMLInputElement;
                  if (!input.value.trim()) return;
                  const t = input.value.trim(); input.value = "";
                  act(() => cardsApi.addChecklistItem(cl.id, t), [["checklists", cardId]]);
                }}>
                  <input name="t" placeholder="+ آیتم جدید" className="w-full rounded-chip border border-transparent px-2 py-1 text-sm outline-none hover:border-line focus:border-teal" />
                </form>
              </div>
            ))}
          </div>
          <form className="mt-3 flex gap-2" onSubmit={(e) => {
            e.preventDefault();
            if (!newChecklist.trim()) return;
            act(() => cardsApi.addChecklist(cardId, newChecklist.trim()), [["checklists", cardId]]);
            setNewChecklist("");
          }}>
            <input value={newChecklist} onChange={(e) => setNewChecklist(e.target.value)} placeholder="عنوان چک‌لیست جدید" className="flex-1 rounded-chip border border-line px-3 py-1.5 text-sm outline-none focus:border-teal" />
            <button type="submit" className="rounded-chip bg-ink px-3 py-1.5 text-sm text-white">افزودن</button>
          </form>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-sm font-medium text-inkSoft">کامنت‌ها</h3>
          <div className="mb-3 space-y-2">
            {comments?.length === 0 && <p className="text-sm text-inkSoft">هنوز کامنتی نیست.</p>}
            {comments?.map((c) => (
              <div key={c.id} className="rounded-chip bg-paper p-2 text-sm">
                <span className="font-medium">{c.author.full_name ?? c.author.phone_number}</span>
                <p className="mt-0.5 whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
          </div>
          <form className="flex gap-2" onSubmit={(e) => {
            e.preventDefault();
            if (!comment.trim()) return;
            act(() => cardsApi.addComment(cardId, comment.trim()), [["comments", cardId]]);
            setComment("");
          }}>
            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="کامنت بنویسید…" className="flex-1 rounded-chip border border-line px-3 py-1.5 text-sm outline-none focus:border-teal" />
            <button type="submit" className="rounded-chip bg-ink px-3 py-1.5 text-sm text-white">ارسال</button>
          </form>
        </section>
        <div className="border-t border-line pt-4">
          <button className="text-sm text-rose hover:underline" onClick={async () => {
            if (!window.confirm("این کارت حذف شود؟")) return;
            setError(null);
            try { await boardsApi.deleteCard(boardId, cardId); qc.invalidateQueries({ queryKey: board }); onClose(); } catch (e) { setError(describeError(e)); }
          }}>حذف کارت</button>
        </div>
      </div>
    </div>
  );
}

/** ISO (UTC) -> value for <input type="datetime-local"> in the user's local time. */
function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
