import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useQueryClient } from "@tanstack/react-query";
import type { List } from "@/types";
import { boardsApi } from "@/api/boards";
import CardItem from "./CardItem";

export default function ListColumn({ list, boardId, onOpenCard }: { list: List; boardId: string; onOpenCard: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: list.id });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const queryClient = useQueryClient();
  const cards = list.cards ?? [];

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await boardsApi.createCard(boardId, list.id, title.trim());
    setTitle(""); setAdding(false);
    queryClient.invalidateQueries({ queryKey: ["board", boardId] });
  }

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-card bg-paperRaised/60">
      <div className="flex items-center justify-between border-b-2 border-amber px-3 py-2">
        <h2 className="text-sm font-medium">{list.title}</h2>
        <span className="text-xs text-inkSoft">{cards.length}</span>
      </div>
      <div ref={setNodeRef} className={`flex min-h-[48px] flex-col gap-2 p-2 transition-colors ${isOver ? "bg-teal-soft/50" : ""}`}>
        {/* SortableContext id = list id, so drag events report which list the card is over. */}
        <SortableContext id={list.id} items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((c) => <CardItem key={c.id} card={c} onOpen={() => onOpenCard(c.id)} />)}
        </SortableContext>
      </div>
      <div className="p-2">
        {adding ? (
          <form onSubmit={create} className="space-y-2">
            <textarea autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان کارت…" rows={2}
              className="w-full resize-none rounded-chip border border-line p-2 text-sm outline-none focus:border-teal" />
            <div className="flex gap-2">
              <button type="submit" className="rounded-chip bg-ink px-3 py-1 text-xs text-white">افزودن</button>
              <button type="button" onClick={() => setAdding(false)} className="rounded-chip px-3 py-1 text-xs text-inkSoft hover:bg-paper">انصراف</button>
            </div>
          </form>
        ) : (
          <button onClick={() => setAdding(true)} className="w-full rounded-chip px-2 py-1.5 text-start text-sm text-inkSoft hover:bg-paper">+ افزودن کارت</button>
        )}
      </div>
    </div>
  );
}
