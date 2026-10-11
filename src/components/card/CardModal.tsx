import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { boardsApi } from "@/api/boards";
import { useAuthStore } from "@/store/auth";
import { describeError } from "@/lib/errors";
import { useCanManageBoard } from "@/lib/roles";
import Block from "./Block";
import CardLabels from "./CardLabels";
import AssigneesSection from "./AssigneesSection";
import ChecklistsSection from "./ChecklistsSection";
import AttachmentsSection from "./AttachmentsSection";
import CommentsSection from "./CommentsSection";
import type { Board } from "@/types";

export default function CardModal({ boardId, cardId, onClose }: { boardId: string; cardId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user)!;
  // Read (not observe) the board the page already loaded: only the workspace id is needed for permissions.
  const workspaceId = qc.getQueryData<Board>(["board", boardId])?.workspace_id;
  const { canManage } = useCanManageBoard(boardId, workspaceId, me);
  const { data: card } = useQuery({ queryKey: ["card", cardId], queryFn: () => boardsApi.getCard(boardId, cardId) });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (card) { setTitle(card.title); setDescription(card.description ?? ""); } }, [card?.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const board = ["board", boardId], cardKey = ["card", cardId];
  async function patch(p: Parameters<typeof boardsApi.updateCard>[2]) {
    setError(null);
    try { await boardsApi.updateCard(boardId, cardId, p); qc.invalidateQueries({ queryKey: board }); qc.invalidateQueries({ queryKey: cardKey }); } catch (e) { setError(describeError(e)); }
  }

  if (!card) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-6" onClick={onClose}>
      <div role="dialog" aria-label={card.title} onClick={(e) => e.stopPropagation()} className="mt-10 w-full max-w-2xl rounded-card bg-paperRaised p-6 shadow-raised">
        <div className="mb-4 flex items-start justify-between gap-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="عنوان کارت"
            onBlur={() => title.trim() && title.trim() !== card.title && patch({ title: title.trim() })}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
            className="w-full rounded-chip border border-transparent px-1 text-lg font-semibold outline-none hover:border-line focus:border-teal" />
          <button onClick={onClose} className="shrink-0 text-inkSoft hover:text-ink">بستن</button>
        </div>
        {error && <p className="mb-3 rounded-chip bg-rose-soft px-3 py-2 text-sm text-rose">{error}</p>}

        <CardLabels cardId={cardId} boardId={boardId} />
        <AssigneesSection cardId={cardId} boardId={boardId} canManage={canManage} />

        <Block title="موعد انجام">
          <div className="flex items-center gap-2">
            {/* The API wants a timezone-aware value: send ISO with Z; null clears the date. */}
            <input type="datetime-local" dir="ltr" value={toLocalInput(card.due_at)} aria-label="موعد انجام"
              onChange={(e) => e.target.value && patch({ due_at: new Date(e.target.value).toISOString() })}
              className="rounded-chip border border-line px-2 py-1.5 text-sm outline-none focus:border-teal" />
            {card.due_at && <button onClick={() => patch({ due_at: null })} className="text-sm text-inkSoft hover:underline">حذف موعد</button>}
          </div>
        </Block>

        <Block title="توضیحات">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="توضیحی برای این کارت بنویسید…"
            onBlur={() => description !== (card.description ?? "") && patch({ description })}
            className="w-full resize-none rounded-chip border border-line p-2 text-sm outline-none focus:border-teal" />
        </Block>

        <ChecklistsSection cardId={cardId} />
        <AttachmentsSection cardId={cardId} />
        <CommentsSection cardId={cardId} me={me} canManage={canManage} />

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
