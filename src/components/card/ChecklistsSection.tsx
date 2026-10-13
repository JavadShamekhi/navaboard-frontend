import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cardsApi } from "@/api/cards";
import { describeError } from "@/lib/errors";
import { Status, useAction } from "@/components/ui";
import Block from "./Block";
import type { Checklist, ChecklistItem } from "@/types";

const byPos = <T extends { position: number }>(a: T, b: T) => a.position - b.position;
const smallInput = "w-full rounded-chip border border-transparent px-2 py-1 text-sm outline-none hover:border-line focus:border-teal";

function useReorderSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }), // keyboard: focus the handle, Space, arrows, Space
  );
}

function Grip({ label, ...props }: { label: string } & React.HTMLAttributes<HTMLButtonElement>) {
  return <button type="button" aria-label={label} title={label} {...props} className="shrink-0 cursor-grab touch-none px-1 text-inkSoft hover:text-ink active:cursor-grabbing">⠿</button>;
}

export default function ChecklistsSection({ cardId }: { cardId: string }) {
  const qc = useQueryClient();
  const key = ["checklists", cardId];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => cardsApi.checklists(cardId) });
  const lists = [...(data ?? [])].sort(byPos);
  const [title, setTitle] = useState("");
  const act = useAction();
  const sensors = useReorderSensors();
  // Every mutation re-reads the checklists: the server owns the order (positions are 0-based).
  const run = (fn: () => Promise<unknown>) => act.run(async () => { await fn(); await qc.invalidateQueries({ queryKey: key }); });

  // Ticking is optimistic: show it at once, roll back if the server refuses, then re-read the truth.
  const toggle = (itemId: string, checked: boolean) => act.run(async () => {
    const prev = qc.getQueryData<Checklist[]>(key);
    qc.setQueryData<Checklist[]>(key, (old) => old?.map((c) => ({ ...c, items: (c.items ?? []).map((i) => (i.id === itemId ? { ...i, is_completed: checked } : i)) })));
    try { await cardsApi.toggleChecklistItem(itemId, checked); }
    catch (e) { qc.setQueryData(key, prev); throw e; }
    finally { qc.invalidateQueries({ queryKey: key }); }
  });

  /** Checklists: position 0..count-1 inside the card (API). */
  const reorderLists = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = lists.findIndex((l) => l.id === active.id), to = lists.findIndex((l) => l.id === over.id);
    if (from < 0 || to < 0) return;
    return act.run(async () => {
      const prev = qc.getQueryData<Checklist[]>(key);
      qc.setQueryData<Checklist[]>(key, arrayMove(lists, from, to).map((c, i) => ({ ...c, position: i })));
      try { await cardsApi.moveChecklist(String(active.id), to); }
      catch (err) { qc.setQueryData(key, prev); throw err; }
      finally { qc.invalidateQueries({ queryKey: key }); }
    });
  };

  /** Items: position 0..count-1 inside their own checklist (API) - items never leave their checklist. */
  const moveItem = (checklistId: string, itemId: string, from: number, to: number) => act.run(async () => {
    const prev = qc.getQueryData<Checklist[]>(key);
    qc.setQueryData<Checklist[]>(key, (old) => old?.map((c) => c.id !== checklistId ? c
      : { ...c, items: arrayMove([...(c.items ?? [])].sort(byPos), from, to).map((i, k) => ({ ...i, position: k })) }));
    try { await cardsApi.moveChecklistItem(itemId, to); }
    catch (err) { qc.setQueryData(key, prev); throw err; }
    finally { qc.invalidateQueries({ queryKey: key }); }
  });

  return (
    <Block title="چک‌لیست‌ها">
      {isLoading && <p className="text-sm text-inkSoft">در حال بارگذاری…</p>}
      {error && <p className="text-sm text-rose">{describeError(error)}</p>}
      {data?.length === 0 && <p className="text-sm text-inkSoft">هنوز چک‌لیستی اضافه نشده.</p>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderLists}>
        <SortableContext items={lists.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {lists.map((cl) => <ChecklistView key={cl.id} cl={cl} busy={act.pending} run={run} onToggle={toggle} onMoveItem={moveItem} />)}
        </SortableContext>
      </DndContext>
      <Status error={act.error} ok={null} />
      <form className="flex gap-2" onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        run(() => cardsApi.addChecklist(cardId, title.trim())).then(() => setTitle(""));
      }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان چک‌لیست جدید" className="flex-1 rounded-chip border border-line px-3 py-1.5 text-sm outline-none focus:border-teal" />
        <button className="rounded-chip bg-ink px-3 py-1.5 text-sm text-white">افزودن</button>
      </form>
    </Block>
  );
}

function ChecklistView({ cl, busy, run, onToggle, onMoveItem }: {
  cl: Checklist; busy: boolean; run: (fn: () => Promise<unknown>) => Promise<void>;
  onToggle: (itemId: string, checked: boolean) => void; onMoveItem: (checklistId: string, itemId: string, from: number, to: number) => void;
}) {
  const sort = useSortable({ id: cl.id });
  const sensors = useReorderSensors();
  const [title, setTitle] = useState(cl.title);
  const [newItem, setNewItem] = useState("");
  useEffect(() => setTitle(cl.title), [cl.title]);
  const items = [...(cl.items ?? [])].sort(byPos);
  const done = items.filter((i) => i.is_completed).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  const reorderItems = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id), to = items.findIndex((i) => i.id === over.id);
    if (from >= 0 && to >= 0) onMoveItem(cl.id, String(active.id), from, to);
  };

  return (
    <div ref={sort.setNodeRef} style={{ transform: CSS.Translate.toString(sort.transform), transition: sort.transition, opacity: sort.isDragging ? 0.6 : 1 }}
      className="rounded-chip border border-line bg-paperRaised p-3" data-testid="checklist">
      <div className="mb-2 flex items-center gap-2">
        <Grip label="جابه‌جایی چک‌لیست" data-testid="checklist-handle" {...sort.attributes} {...sort.listeners} />
        <input value={title} aria-label="عنوان چک‌لیست" onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title.trim() !== cl.title && run(() => cardsApi.updateChecklist(cl.id, title.trim()))}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          className={smallInput + " font-medium"} />
        <span className="shrink-0 text-xs text-inkSoft" data-testid="progress">{done}/{items.length}</span>
        <button disabled={busy} className="shrink-0 text-xs text-rose hover:underline" onClick={() => {
          if (window.confirm(`چک‌لیست «${cl.title}» حذف شود؟`)) run(() => cardsApi.deleteChecklist(cl.id));
        }}>حذف چک‌لیست</button>
      </div>
      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-paper"><div className="h-full bg-teal transition-all" style={{ width: `${pct}%` }} /></div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderItems}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1">
            {items.map((it) => <ItemRow key={it.id} it={it} busy={busy} onToggle={onToggle} onDelete={() => run(() => cardsApi.deleteChecklistItem(it.id))} />)}
          </ul>
        </SortableContext>
      </DndContext>
      <form className="mt-2" onSubmit={(e) => {
        e.preventDefault();
        if (!newItem.trim()) return;
        run(() => cardsApi.addChecklistItem(cl.id, newItem.trim())).then(() => setNewItem(""));
      }}>
        <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="+ آیتم جدید" className={smallInput} />
      </form>
    </div>
  );
}

function ItemRow({ it, busy, onToggle, onDelete }: { it: ChecklistItem; busy: boolean; onToggle: (id: string, checked: boolean) => void; onDelete: () => void }) {
  const sort = useSortable({ id: it.id });
  return (
    <li ref={sort.setNodeRef} style={{ transform: CSS.Translate.toString(sort.transform), transition: sort.transition, opacity: sort.isDragging ? 0.6 : 1 }}
      className="flex items-center gap-2 bg-paperRaised text-sm" data-testid="checklist-item">
      <Grip label="جابه‌جایی آیتم" data-testid="item-handle" {...sort.attributes} {...sort.listeners} />
      <input type="checkbox" checked={it.is_completed} onChange={(e) => onToggle(it.id, e.target.checked)} />
      <span className={`flex-1 ${it.is_completed ? "text-inkSoft line-through" : ""}`}>{it.title}</span>
      <button disabled={busy} className="text-xs text-inkSoft hover:text-rose" aria-label="حذف آیتم" onClick={onDelete}>✕</button>
    </li>
  );
}
