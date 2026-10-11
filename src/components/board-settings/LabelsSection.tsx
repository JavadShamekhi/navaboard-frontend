import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { boardsApi } from "@/api/boards";
import { describeError } from "@/lib/errors";
import { Section, Status, btnCls, inputCls, useAction } from "@/components/ui";
import type { Label } from "@/types";

export default function LabelsSection({ boardId, canManage }: { boardId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const key = ["labels", boardId];
  const { data: labels, isLoading, error } = useQuery({ queryKey: key, queryFn: () => boardsApi.labels(boardId) });
  const [name, setName] = useState("");
  const [color, setColor] = useState("#2F6E6B");
  const add = useAction();
  const row = useAction();
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["board", boardId] }); };

  return (
    <Section title="برچسب‌ها" hint={canManage ? "برچسب‌ها را اینجا بسازید؛ اتصال آن‌ها به کارت از داخل خود کارت انجام می‌شود." : "فقط مدیر برد می‌تواند برچسب‌ها را مدیریت کند."}>
      {isLoading && <p className="text-sm text-inkSoft">در حال بارگذاری…</p>}
      {error && <p className="text-sm text-rose">{describeError(error)}</p>}
      {labels?.length === 0 && <p className="text-sm text-inkSoft">برچسبی نیست.</p>}
      <ul className="space-y-2">
        {labels?.map((l) => (
          <LabelRow key={l.id + l.name + l.color} label={l} canManage={canManage} busy={row.pending}
            onSave={(patch) => row.run(async () => { await boardsApi.updateLabel(boardId, l.id, patch); refresh(); })}
            onDelete={() => {
              if (!window.confirm(`برچسب «${l.name}» از برد حذف شود؟ از همه‌ی کارت‌ها هم برداشته می‌شود.`)) return;
              row.run(async () => { await boardsApi.deleteLabel(boardId, l.id); refresh(); });
            }} />
        ))}
      </ul>
      <Status error={row.error} ok={null} />
      {canManage && (
        <form className="flex gap-2 border-t border-line pt-3" onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          add.run(async () => { await boardsApi.createLabel(boardId, name.trim(), color); setName(""); refresh(); }, "برچسب ساخته شد.");
        }}>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="رنگ" className="h-10 w-12 shrink-0 cursor-pointer rounded-chip border border-line bg-white p-1" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام برچسب" className={inputCls} />
          <button disabled={add.pending} className={btnCls}>ساخت</button>
        </form>
      )}
      <Status error={add.error} ok={add.ok} />
    </Section>
  );
}

function LabelRow({ label, canManage, busy, onSave, onDelete }: {
  label: Label; canManage: boolean; busy: boolean;
  onSave: (patch: { name?: string; color?: string }) => void; onDelete: () => void;
}) {
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState(label.color);
  const dirty = name.trim() !== label.name || color !== label.color;
  if (!canManage) {
    return <li className="flex items-center gap-2 text-sm"><span className="h-3 w-6 rounded-full" style={{ backgroundColor: label.color }} />{label.name}</li>;
  }
  return (
    <li className="flex items-center gap-2">
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="رنگ" className="h-9 w-10 shrink-0 cursor-pointer rounded-chip border border-line bg-white p-1" />
      <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      {dirty && <button disabled={busy} className="text-sm text-teal hover:underline" onClick={() => onSave({ ...(name.trim() !== label.name ? { name: name.trim() } : {}), ...(color !== label.color ? { color } : {}) })}>ذخیره</button>}
      <button disabled={busy} onClick={onDelete} className="text-sm text-rose hover:underline">حذف</button>
    </li>
  );
}
