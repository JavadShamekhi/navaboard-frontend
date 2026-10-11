import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { boardsApi } from "@/api/boards";
import { cardsApi } from "@/api/cards";
import { describeError } from "@/lib/errors";
import { memberUser, personLabel } from "@/lib/roles";
import Avatar from "@/components/Avatar";
import { Status, ltrInput, useAction } from "@/components/ui";
import Block from "./Block";
import type { User } from "@/types";

export default function AssigneesSection({ cardId, boardId, canManage }: { cardId: string; boardId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const key = ["assignees", cardId];
  const { data: assignees, isLoading, error } = useQuery({ queryKey: key, queryFn: () => cardsApi.assignees(cardId) });
  const { data: boardMembers } = useQuery({ queryKey: ["board-members", boardId], queryFn: () => boardsApi.members(boardId), enabled: canManage });
  const [phone, setPhone] = useState("");
  const act = useAction();
  const run = (fn: () => Promise<unknown>, ok?: string) => act.run(async () => { await fn(); await Promise.all([qc.invalidateQueries({ queryKey: key }), qc.invalidateQueries({ queryKey: ["board", boardId] })]); }, ok);

  return (
    <Block title="مسئول‌ها">
      {isLoading && <p className="text-sm text-inkSoft">در حال بارگذاری…</p>}
      {error && <p className="text-sm text-rose">{describeError(error)}</p>}
      {assignees?.length === 0 && <p className="text-sm text-inkSoft">مسئولی تعیین نشده.</p>}
      <ul className="space-y-1">
        {assignees?.map((a) => {
          // a.id is the assignment record id (what DELETE needs); the person is nested under `user`.
          const u: User = (a as { user?: User }).user ?? (a as unknown as User);
          return (
            <li key={a.id} className="flex items-center gap-2 text-sm" data-testid="assignee">
              <Avatar user={u} size={24} />
              <span className="flex-1">{personLabel(u)}</span>
              {canManage && <button disabled={act.pending} onClick={() => run(() => cardsApi.unassign(cardId, a.id))} className="text-xs text-rose hover:underline">حذف</button>}
            </li>
          );
        })}
      </ul>
      {canManage ? (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => cardsApi.assign(cardId, phone.trim()), "مسئول اضافه شد.").then(() => setPhone("")); }}>
          <input list="board-people" dir="ltr" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09121234567" required className={ltrInput} />
          <datalist id="board-people">{(boardMembers ?? []).map((m) => { const u = memberUser(m); return <option key={u.id} value={u.phone_number}>{personLabel(u)}</option>; })}</datalist>
          <button className="shrink-0 rounded-chip bg-ink px-3 py-1.5 text-sm text-white">افزودن مسئول</button>
        </form>
      ) : (
        <p className="text-xs text-inkSoft">فقط مدیر برد می‌تواند مسئول تعیین کند.</p>
      )}
      <p className="text-xs text-inkSoft">مسئول‌شدن به‌تنهایی دسترسی به برد خصوصی نمی‌دهد؛ در صورت نیاز او را به اعضای برد اضافه کنید.</p>
      <Status error={act.error} ok={act.ok} />
    </Block>
  );
}
