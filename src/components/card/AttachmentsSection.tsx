import { useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cardsApi } from "@/api/cards";
import { downloadAttachment } from "@/api/client";
import { describeError } from "@/lib/errors";
import { Status, useAction } from "@/components/ui";
import Block from "./Block";

const size = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} مگابایت` : `${Math.max(1, Math.round(n / 1024))} کیلوبایت`);

export default function AttachmentsSection({ cardId }: { cardId: string }) {
  const qc = useQueryClient();
  const key = ["attachments", cardId];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => cardsApi.attachments(cardId) });
  const fileInput = useRef<HTMLInputElement>(null);
  const act = useAction();
  const run = (fn: () => Promise<unknown>, ok?: string) => act.run(async () => { await fn(); await qc.invalidateQueries({ queryKey: key }); }, ok);

  return (
    <Block title="فایل‌های پیوست" right={<button disabled={act.pending} onClick={() => fileInput.current?.click()} className="text-sm text-teal hover:underline">+ آپلود فایل</button>}>
      <input ref={fileInput} type="file" hidden data-testid="file-input" onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = ""; // allow picking the same file again
        if (f) run(() => cardsApi.upload(cardId, f), "فایل آپلود شد.");
      }} />
      {isLoading && <p className="text-sm text-inkSoft">در حال بارگذاری…</p>}
      {error && <p className="text-sm text-rose">{describeError(error)}</p>}
      {data?.length === 0 && <p className="text-sm text-inkSoft">فایلی پیوست نشده.</p>}
      <ul className="divide-y divide-line">
        {data?.map((a) => (
          <li key={a.id} className="flex items-center gap-3 py-2 text-sm" data-testid="attachment">
            <span className="min-w-0 flex-1 truncate" dir="auto">{a.original_name}</span>
            <span className="shrink-0 text-xs text-inkSoft">{size(a.size)}</span>
            {/* A plain link cannot send the Authorization header, so the file is fetched as a blob. */}
            <button disabled={act.pending} className="text-teal hover:underline" onClick={() => act.run(() => downloadAttachment(cardId, a.id, a.original_name))}>دانلود</button>
            <button disabled={act.pending} className="text-rose hover:underline" onClick={() => { if (window.confirm(`«${a.original_name}» حذف شود؟`)) run(() => cardsApi.deleteAttachment(cardId, a.id)); }}>حذف</button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-inkSoft">حداکثر حجم پیش‌فرض هر فایل ۱۰ مگابایت است. فایل‌ها خصوصی‌اند و فقط برای اعضای برد قابل دانلودند.</p>
      <Status error={act.error} ok={act.ok} />
    </Block>
  );
}
