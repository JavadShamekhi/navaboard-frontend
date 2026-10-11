import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "@/api/notifications";
import { activityOf, actorName, boardIdOf, describeAction, formatWhen } from "@/lib/activity";
import { describeError } from "@/lib/errors";
import { backoff, useUnreadCount } from "@/lib/notifications";
import { Status, useAction } from "@/components/ui";
import type { NotificationItem } from "@/types";

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const act = useAction();
  const { data: unread } = useUnreadCount();
  const q = useQuery({
    queryKey: ["notifications", { unreadOnly, page }],
    queryFn: () => notificationsApi.list({ unread: unreadOnly, page }),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => backoff(query.state.errorUpdateCount) * 2,
  });
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["notifications"] }), qc.invalidateQueries({ queryKey: ["unread-count"] })]);

  // New notifications arrived (the bell polls the count): re-read the list.
  const lastCount = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (lastCount.current !== undefined && unread && unread.count !== lastCount.current) qc.invalidateQueries({ queryKey: ["notifications"] });
    lastCount.current = unread?.count;
  }, [unread?.count, qc]);

  const items = q.data?.results ?? [];
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-6 py-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">اعلان‌ها</h1>
        <button disabled={act.pending || !unread?.count} className="rounded-chip border border-line px-3 py-1.5 text-sm hover:border-teal disabled:opacity-40"
          onClick={() => act.run(async () => { const r = await notificationsApi.markAllRead(); await refresh(); setPage(1); void r; }, "همه‌ی اعلان‌ها خوانده شد.")}>
          خواندن همه
        </button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }} /> فقط خوانده‌نشده‌ها
      </label>
      <Status error={act.error} ok={act.ok} />
      {q.isLoading && <p className="text-inkSoft">در حال بارگذاری…</p>}
      {q.error && <p className="text-rose">{describeError(q.error)}</p>}
      {!q.isLoading && items.length === 0 && <p className="text-inkSoft">{unreadOnly ? "اعلان خوانده‌نشده‌ای ندارید." : "هنوز اعلانی ندارید."}</p>}
      <ul className="space-y-2">
        {items.map((n) => <Item key={n.id} n={n} busy={act.pending} onRead={() => act.run(async () => { await notificationsApi.markRead(n.id); await refresh(); })} />)}
      </ul>
      {(q.data?.next || q.data?.previous) && (
        <div className="flex items-center justify-between text-sm">
          <button disabled={!q.data?.previous} onClick={() => setPage((p) => p - 1)} className="text-teal disabled:opacity-40">جدیدتر</button>
          <span className="text-xs text-inkSoft">صفحه {page} — {q.data?.count} اعلان</span>
          <button disabled={!q.data?.next} onClick={() => setPage((p) => p + 1)} className="text-teal disabled:opacity-40">قدیمی‌تر</button>
        </div>
      )}
    </div>
  );
}

function Item({ n, busy, onRead }: { n: NotificationItem; busy: boolean; onRead: () => void }) {
  const a = activityOf(n);
  const isUnread = !n.read_at; // read_at is null while unread
  const action = String(a.action ?? "");
  const boardId = boardIdOf(a);
  return (
    <li data-testid="notification" data-unread={isUnread} className={`rounded-card border p-3 text-sm shadow-card ${isUnread ? "border-teal bg-teal-soft/40" : "border-line bg-paperRaised"}`}>
      <div className="flex items-start gap-2">
        {isUnread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal" aria-label="خوانده‌نشده" />}
        <div className="min-w-0 flex-1">
          <p><span className="font-medium">{actorName(a.actor)}</span> {describeAction(action)}</p>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-inkSoft">
            <span>{formatWhen(a.created_at ?? n.created_at)}</span>
            {action && <code dir="ltr" className="rounded bg-paper px-1">{action}</code>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
          {boardId && <Link to={`/boards/${boardId}`} onClick={() => isUnread && onRead()} className="text-teal hover:underline">مشاهده برد</Link>}
          {isUnread && <button disabled={busy} onClick={onRead} className="text-inkSoft hover:underline">خوانده شد</button>}
        </div>
      </div>
    </li>
  );
}
