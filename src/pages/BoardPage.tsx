import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DndContext, DragOverlay, PointerSensor, closestCorners, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { boardsApi } from "@/api/boards";
import type { Board, Card } from "@/types";
import ListColumn from "@/components/board/ListColumn";
import CardItem from "@/components/board/CardItem";
import CardModal from "@/components/card/CardModal";
import { describeError } from "@/lib/errors";

/**
 * Board detail normally carries lists and cards. If it does not, fall back to the dedicated endpoints
 * (GET lists, GET cards of a list) so the UI works with either response shape.
 */
async function loadBoard(boardId: string): Promise<Board> {
  const b = await boardsApi.get(boardId);
  const rawLists = b.lists ?? (await boardsApi.lists(boardId));
  const lists = await Promise.all(
    [...rawLists].sort((x, y) => x.position - y.position).map(async (l) => {
      const cards = l.cards ?? (await boardsApi.listCards(boardId, l.id));
      return { ...l, cards: [...cards].sort((x, y) => x.position - y.position) };
    })
  );
  return { ...b, lists };
}

/** Pure local move used for the optimistic update; mirrors backend semantics (0-based position). */
function applyMove(board: Board, cardId: string, destListId: string, position: number): Board {
  const lists = (board.lists ?? []).map((l) => ({ ...l, cards: [...(l.cards ?? [])] }));
  let moved: Card | undefined;
  for (const l of lists) {
    const i = l.cards.findIndex((c) => c.id === cardId);
    if (i >= 0) { moved = l.cards.splice(i, 1)[0]; break; }
  }
  const dest = lists.find((l) => l.id === destListId);
  if (!moved || !dest) return board;
  dest.cards.splice(Math.min(position, dest.cards.length), 0, { ...moved, list_id: destListId });
  return { ...board, lists };
}

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const queryClient = useQueryClient();
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [newList, setNewList] = useState("");
  const key = ["board", boardId];

  const { data: board, isLoading, error } = useQuery({ queryKey: key, queryFn: () => loadBoard(boardId!), enabled: !!boardId });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const allCards = board?.lists?.flatMap((l) => l.cards ?? []) ?? [];

  function onDragStart(e: DragStartEvent) { setActiveCard(allCards.find((c) => c.id === e.active.id) ?? null); }

  async function onDragEnd(e: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = e;
    if (!over || !board || !boardId) return;
    const cardId = String(active.id);
    const sortable = over.data.current?.sortable as { containerId: string; index: number } | undefined;
    const destListId = sortable ? sortable.containerId : String(over.id);
    const sourceListId = allCards.find((c) => c.id === cardId)?.list_id;
    const destList = board.lists?.find((l) => l.id === destListId);
    if (!destList || !sourceListId) return;
    const count = destList.cards?.length ?? 0;
    // Over a card -> take its index. Over the empty list area -> append (last valid index).
    const position = sortable ? sortable.index : sourceListId === destListId ? count - 1 : count;
    if (sourceListId === destListId && allCards.find((c) => c.id === cardId)?.position === position) return;

    setMoveError(null);
    const previous = queryClient.getQueryData<Board>(key);
    queryClient.setQueryData<Board>(key, applyMove(board, cardId, destListId, position));
    try {
      await boardsApi.moveCard(boardId, cardId, destListId, position);
    } catch (err) {
      queryClient.setQueryData(key, previous); // roll back the UI
      setMoveError(describeError(err));
    } finally {
      queryClient.invalidateQueries({ queryKey: key }); // server is the source of truth
    }
  }

  async function addList(e: React.FormEvent) {
    e.preventDefault();
    if (!newList.trim() || !boardId) return;
    await boardsApi.createList(boardId, newList.trim());
    setNewList("");
    queryClient.invalidateQueries({ queryKey: key });
  }

  if (isLoading) return <div className="p-8 text-inkSoft">در حال بارگذاری برد…</div>;
  if (error || !board) return <div className="p-8 text-rose">{describeError(error)}</div>;

  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between">
        <Link to={`/workspaces/${board.workspace_id}`} className="text-sm text-inkSoft hover:underline">فضای کاری</Link>
        <Link to={`/boards/${board.id}/settings`} className="text-sm text-teal hover:underline">تنظیمات برد، ستون‌ها و اعضا</Link>
      </div>
      <h1 className="mb-4 text-xl font-semibold">{board.name}</h1>
      {moveError && <p className="mb-3 rounded-chip bg-rose-soft px-3 py-2 text-sm text-rose">جابه‌جایی انجام نشد: {moveError}</p>}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex items-start gap-4 overflow-x-auto pb-4">
          {board.lists?.map((l) => <ListColumn key={l.id} list={l} boardId={boardId!} onOpenCard={setOpenCardId} />)}
          <form onSubmit={addList} className="w-72 shrink-0">
            <input value={newList} onChange={(e) => setNewList(e.target.value)} placeholder="+ ستون جدید" className="w-full rounded-card border border-dashed border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-teal" />
          </form>
        </div>
        <DragOverlay>{activeCard ? <CardItem card={activeCard} onOpen={() => {}} overlay /> : null}</DragOverlay>
      </DndContext>
      {openCardId && <CardModal boardId={boardId!} cardId={openCardId} onClose={() => setOpenCardId(null)} />}
    </div>
  );
}
