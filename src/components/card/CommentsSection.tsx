import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cardsApi } from "@/api/cards";
import { describeError } from "@/lib/errors";
import { isMe, personLabel } from "@/lib/roles";
import { Status, useAction } from "@/components/ui";
import Block from "./Block";
import type { Comment, User } from "@/types";

const when = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" }); };

export default function CommentsSection({ cardId, me, canManage }: { cardId: string; me: User; canManage: boolean }) {
  const qc = useQueryClient();
  const key = ["comments", cardId];
  const { data: comments, isLoading, error } = useQuery({ queryKey: key, queryFn: () => cardsApi.comments(cardId) });
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const act = useAction();
  const run = (fn: () => Promise<unknown>) => act.run(async () => { await fn(); await qc.invalidateQueries({ queryKey: key }); });

  return (
    <Block title="کامنت‌ها">
      {isLoading && <p className="text-sm text-inkSoft">در حال بارگذاری…</p>}
      {error && <p className="text-sm text-rose">{describeError(error)}</p>}
      {comments?.length === 0 && <p className="text-sm text-inkSoft">هنوز کامنتی نیست.</p>}
      {comments?.map((c: Comment) => {
        const author = c.author ?? (c as unknown as { user?: User }).user;
        // Only the author, or a board manager, may edit/delete (guide, section 9). The server decides for real.
        const allowed = (!!author && isMe(author, me)) || canManage;
        const edited = c.updated_at && c.created_at && c.updated_at !== c.created_at;
        return (
          <div key={c.id} className="rounded-chip bg-paper p-2 text-sm" data-testid="comment">
            <div className="flex items-center gap-2 text-xs text-inkSoft">
              <span className="font-medium text-ink">{author ? personLabel(author) : "؟"}</span>
              <span>{when(c.created_at)}</span>
              {edited && <span>(ویرایش‌شده)</span>}
              {allowed && editing !== c.id && (
                <span className="ms-auto flex gap-3">
                  <button className="hover:underline" onClick={() => { setEditing(c.id); setDraft(c.body); }}>ویرایش</button>
                  <button className="text-rose hover:underline" disabled={act.pending} onClick={() => { if (window.confirm("این کامنت حذف شود؟")) run(() => cardsApi.deleteComment(c.id)); }}>حذف</button>
                </span>
              )}
            </div>
            {editing === c.id ? (
              <form className="mt-1 space-y-1" onSubmit={(e) => { e.preventDefault(); run(() => cardsApi.updateComment(c.id, draft.trim())).then(() => setEditing(null)); }}>
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} className="w-full resize-none rounded-chip border border-line p-2 text-sm outline-none focus:border-teal" />
                <div className="flex gap-2 text-xs"><button disabled={!draft.trim()} className="rounded-chip bg-ink px-3 py-1 text-white">ذخیره</button><button type="button" onClick={() => setEditing(null)} className="text-inkSoft">انصراف</button></div>
              </form>
            ) : (
              <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
            )}
          </div>
        );
      })}
      <Status error={act.error} ok={null} />
      <form className="flex gap-2" onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        run(() => cardsApi.addComment(cardId, text.trim())).then(() => setText(""));
      }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="کامنت بنویسید…" className="flex-1 rounded-chip border border-line px-3 py-1.5 text-sm outline-none focus:border-teal" />
        <button className="rounded-chip bg-ink px-3 py-1.5 text-sm text-white">ارسال</button>
      </form>
    </Block>
  );
}
