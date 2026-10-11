import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { boardsApi } from "@/api/boards";
import { Section, Status, btnCls, inputCls, useAction } from "@/components/ui";
import type { Board, BoardVisibility } from "@/types";

export default function InfoSection({ board, canManage }: { board: Board; canManage: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = useState(board.name);
  const [visibility, setVisibility] = useState<BoardVisibility>(board.visibility);
  useEffect(() => { setName(board.name); setVisibility(board.visibility); }, [board.name, board.visibility]);
  const a = useAction();
  const dirty = name.trim() !== board.name || visibility !== board.visibility;

  return (
    <Section title="اطلاعات برد" hint={canManage ? undefined : "فقط مدیر برد می‌تواند این بخش را تغییر دهد."}>
      <form className="space-y-2" onSubmit={(e) => {
        e.preventDefault();
        a.run(async () => {
          // Only send what changed.
          const patch: { name?: string; visibility?: BoardVisibility } = {};
          if (name.trim() !== board.name) patch.name = name.trim();
          if (visibility !== board.visibility) patch.visibility = visibility;
          await boardsApi.update(board.id, patch);
          qc.invalidateQueries({ queryKey: ["board", board.id] });
          qc.invalidateQueries({ queryKey: ["boards", board.workspace_id] });
        }, "ذخیره شد.");
      }}>
        <input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} required className={inputCls} />
        <div className="flex gap-2">
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as BoardVisibility)} disabled={!canManage} className="min-w-0 flex-1 rounded-chip border border-line bg-white px-2 py-2 text-sm">
            <option value="private">خصوصی (فقط اعضای برد)</option>
            <option value="workspace">قابل‌مشاهده برای فضای کاری</option>
          </select>
          {canManage && <button disabled={a.pending || !dirty} className={btnCls}>ذخیره</button>}
        </div>
      </form>
      <Status error={a.error} ok={a.ok} />
    </Section>
  );
}
