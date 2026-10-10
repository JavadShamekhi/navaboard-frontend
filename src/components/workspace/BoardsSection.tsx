import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { boardsApi } from "@/api/boards";
import { describeError } from "@/lib/errors";
import { Section, Status, btnCls, inputCls, useAction } from "@/components/ui";
import type { BoardVisibility } from "@/types";

export default function BoardsSection({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const { data: boards, isLoading, error } = useQuery({ queryKey: ["boards", workspaceId], queryFn: () => boardsApi.inWorkspace(workspaceId) });
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<BoardVisibility>("private");
  const a = useAction();

  return (
    <Section title="بردها" hint="بردهای خصوصی فقط برای اعضای خود برد دیده می‌شوند.">
      {isLoading && <p className="text-sm text-inkSoft">در حال بارگذاری…</p>}
      {error && <p className="text-sm text-rose">{describeError(error)}</p>}
      {boards?.length === 0 && <p className="text-sm text-inkSoft">هنوز بردی ندارید.</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {boards?.map((b) => (
          <Link key={b.id} to={`/boards/${b.id}`} className="rounded-card border border-line bg-paper p-3 hover:border-teal">
            <p className="font-medium">{b.name}</p>
            <p className="mt-1 text-xs text-inkSoft">{b.visibility === "private" ? "خصوصی" : "قابل‌مشاهده برای فضای کاری"}</p>
          </Link>
        ))}
      </div>
      <form className="flex flex-wrap gap-2 border-t border-line pt-3" onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        a.run(async () => {
          await boardsApi.createInWorkspace(workspaceId, name.trim(), visibility);
          setName("");
          qc.invalidateQueries({ queryKey: ["boards", workspaceId] });
        }, "برد ساخته شد.");
      }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام برد جدید" className={inputCls + " min-w-40 flex-1"} />
        <select value={visibility} onChange={(e) => setVisibility(e.target.value as BoardVisibility)} className="rounded-chip border border-line bg-white px-2 py-2 text-sm">
          <option value="private">خصوصی</option>
          <option value="workspace">قابل‌مشاهده برای فضای کاری</option>
        </select>
        <button disabled={a.pending} className={btnCls}>ساخت برد</button>
      </form>
      <Status error={a.error} ok={a.ok} />
    </Section>
  );
}
