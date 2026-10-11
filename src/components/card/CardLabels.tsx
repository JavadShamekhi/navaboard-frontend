import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { boardsApi } from "@/api/boards";
import { cardsApi } from "@/api/cards";
import { describeError } from "@/lib/errors";
import { Status, useAction } from "@/components/ui";
import Block from "./Block";

export default function CardLabels({ cardId, boardId }: { cardId: string; boardId: string }) {
  const qc = useQueryClient();
  const key = ["card-labels", cardId];
  const { data: attached, isLoading, error } = useQuery({ queryKey: key, queryFn: () => cardsApi.labels(cardId) });
  const { data: boardLabels } = useQuery({ queryKey: ["labels", boardId], queryFn: () => boardsApi.labels(boardId) });
  const [open, setOpen] = useState(false);
  const act = useAction();
  // Re-read the card labels and the board (its tiles show the label colors).
  const run = (fn: () => Promise<unknown>) => act.run(async () => { await fn(); await Promise.all([qc.invalidateQueries({ queryKey: key }), qc.invalidateQueries({ queryKey: ["board", boardId] })]); });
  const available = (boardLabels ?? []).filter((l) => !attached?.some((a) => a.id === l.id));

  return (
    <Block title="برچسب‌ها" right={<button onClick={() => setOpen((o) => !o)} className="text-sm text-teal hover:underline">{open ? "بستن" : "+ افزودن برچسب"}</button>}>
      {isLoading && <p className="text-sm text-inkSoft">در حال بارگذاری…</p>}
      {error && <p className="text-sm text-rose">{describeError(error)}</p>}
      <div className="flex flex-wrap gap-2">
        {attached?.length === 0 && <p className="text-sm text-inkSoft">برچسبی متصل نیست.</p>}
        {attached?.map((l) => (
          <span key={l.id} className="inline-flex items-center gap-1 rounded-chip px-2 py-1 text-xs text-white" style={{ backgroundColor: l.color }} data-testid="attached-label">
            {l.name}
            <button aria-label={`برداشتن ${l.name}`} disabled={act.pending} onClick={() => run(() => cardsApi.detachLabel(cardId, l.id))} className="opacity-80 hover:opacity-100">✕</button>
          </span>
        ))}
      </div>
      {open && (
        <div className="rounded-chip border border-line p-2">
          {available.length === 0 ? (
            <p className="text-sm text-inkSoft">برچسب دیگری برای افزودن نیست. برچسب‌ها را از <Link to={`/boards/${boardId}/settings`} className="text-teal hover:underline">تنظیمات برد</Link> بسازید.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {available.map((l) => (
                <button key={l.id} disabled={act.pending} onClick={() => run(() => cardsApi.attachLabel(cardId, l.id))} className="rounded-chip px-2 py-1 text-xs text-white hover:opacity-80" style={{ backgroundColor: l.color }}>+ {l.name}</button>
              ))}
            </div>
          )}
        </div>
      )}
      <Status error={act.error} ok={null} />
    </Block>
  );
}
