import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { actorName, describeAction, formatWhen } from "@/lib/activity";
import { describeError } from "@/lib/errors";
import type { ActivityItem, Paginated } from "@/types";

function Feed({ queryKey, load }: { queryKey: unknown[]; load: (page: number) => Promise<Paginated<ActivityItem>> }) {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: [...queryKey, page], queryFn: () => load(page), placeholderData: keepPreviousData });
  if (q.isLoading) return <p className="text-sm text-inkSoft">در حال بارگذاری…</p>;
  if (q.error) return <p className="text-sm text-rose">{describeError(q.error)}</p>;
  const items = q.data?.results ?? [];
  return (
    <div className="space-y-2">
      {items.length === 0 && <p className="text-sm text-inkSoft">هنوز فعالیتی ثبت نشده.</p>}
      <ul className="divide-y divide-line">
        {items.map((a) => (
          <li key={a.id} className="py-2 text-sm" data-testid="activity">
            <span className="font-medium">{actorName(a.actor)}</span>{" "}
            <span>{describeAction(String(a.action))}</span>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-inkSoft">
              <span>{formatWhen(a.created_at)}</span>
              <code dir="ltr" className="rounded bg-paper px-1">{String(a.action)}</code>
            </div>
          </li>
        ))}
      </ul>
      {/* Feeds are paginated newest -> oldest (default 30 per page). */}
      {(q.data?.next || q.data?.previous) && (
        <div className="flex items-center justify-between text-sm">
          <button disabled={!q.data?.previous} onClick={() => setPage((p) => p - 1)} className="text-teal disabled:opacity-40">جدیدتر</button>
          <span className="text-xs text-inkSoft">صفحه {page} — {q.data?.count} رویداد</span>
          <button disabled={!q.data?.next} onClick={() => setPage((p) => p + 1)} className="text-teal disabled:opacity-40">قدیمی‌تر</button>
        </div>
      )}
    </div>
  );
}

/** Loads nothing until opened. */
export default function ActivityPanel(props: { queryKey: unknown[]; load: (page: number) => Promise<Paginated<ActivityItem>> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <button onClick={() => setOpen((o) => !o)} className="text-sm text-teal hover:underline">{open ? "بستن تاریخچه" : "نمایش تاریخچه"}</button>
      {open && <Feed {...props} />}
    </div>
  );
}
