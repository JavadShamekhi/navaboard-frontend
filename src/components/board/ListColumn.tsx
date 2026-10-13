import {useState} from "react";
import {useDroppable} from "@dnd-kit/core";
import {SortableContext, useSortable, verticalListSortingStrategy} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import {useQueryClient} from "@tanstack/react-query";
import type {List} from "@/types";
import {boardsApi} from "@/api/boards";
import CardItem from "./CardItem";

type Props = {
	list: List;
	boardId: string;
	onOpenCard: (id: string) => void;
	overlay?: boolean;
};

/**
 * Hook-free wrapper. The overlay variant must NOT mount useSortable/useDroppable:
 * React forbids conditional hooks, and a droppable inside <DragOverlay> would
 * register itself as a drop target and break the drop.
 */
export default function ListColumn(props: Props) {
	if (props.overlay) return <ColumnOverlay list={props.list}/>;
	return <SortableListColumn list={props.list} boardId={props.boardId} onOpenCard={props.onOpenCard}/>;
}

/** Floating preview rendered inside <DragOverlay> while the column is dragged. */
function ColumnOverlay({list}: { list: List }) {
	const cards = list.cards ?? [];
	return (
			<div
					className="w-72 shrink-0 rotate-2 rounded-card border border-teal/40 bg-paperRaised p-3 shadow-2xl ring-2 ring-teal/30">
				<div className="mb-2 flex items-center justify-between border-b-2 border-amber px-1 pb-2">
					<h2 className="text-sm font-medium">{list.title}</h2>
					<span className="text-xs text-inkSoft">{cards.length}</span>
				</div>
				<div className="flex max-h-[60vh] flex-col gap-2 overflow-hidden">
					{cards.map((c) => (
							<div key={c.id} className="rounded-chip bg-white px-2.5 py-2 text-sm shadow-sm">{c.title}</div>
					))}
					{cards.length === 0 && <p className="py-2 text-center text-xs text-inkSoft">این ستون خالی است</p>}
				</div>
			</div>
	);
}

/** The real column: sortable by its header, with a separate drop zone for cards. */
function SortableListColumn({list, boardId, onOpenCard}: Props) {
	// The column itself is sortable (dragged by its header, so card drags are not hijacked)...
	const sortable = useSortable({id: list.id, data: {type: "list", boardId}});
	// ...and its card area is a separate drop zone, used when a card is dropped on an empty/at-the-end spot.
	const {setNodeRef, isOver} = useDroppable({id: `zone:${list.id}`, data: {type: "zone", listId: list.id}});
	const [adding, setAdding] = useState(false);
	const [title, setTitle] = useState("");
	const [cardError, setCardError] = useState<string | null>(null);
	const queryClient = useQueryClient();
	const cards = list.cards ?? [];

	async function create(e: React.FormEvent) {
		e.preventDefault();
		const name = title.trim();
		if (!name) return;
		setCardError(null);
		try {
			await boardsApi.createCard(boardId, list.id, name);
			setTitle("");
			setAdding(false);
		} catch {
			setCardError("ساخت کارت انجام نشد؛ لطفاً دوباره تلاش کنید."); // form stays open, typed text is kept
		} finally {
			queryClient.invalidateQueries({queryKey: ["board", boardId]});
		}
	}

	return (
			<div ref={sortable.setNodeRef} data-testid="list-column"
			     style={{transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition}}
			     className={`flex w-72 shrink-0 flex-col rounded-card bg-paperRaised/60 ${sortable.isDragging ? "opacity-25" : ""}`}>
				<div ref={sortable.setActivatorNodeRef} {...sortable.attributes} {...sortable.listeners}
				     data-testid="list-handle"
				     title="برای جابه‌جایی ستون بکشید"
				     className="flex cursor-grab items-center justify-between border-b-2 border-amber px-3 py-2 active:cursor-grabbing">
					<h2 className="text-sm font-medium">{list.title}</h2>
					<span className="text-xs text-inkSoft">{cards.length}</span>
				</div>
				<div ref={setNodeRef}
				     className={`flex min-h-[48px] flex-col gap-2 p-2 transition-colors ${isOver ? "bg-teal-soft/50" : ""}`}>
					{/* SortableContext id = list id, so drag events report which list the card is over. */}
					<SortableContext id={list.id} items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
						{cards.map((c) => <CardItem key={c.id} card={c} onOpen={() => onOpenCard(c.id)}/>)}
					</SortableContext>
				</div>
				<div className="p-2">
					{adding ? (
							<form onSubmit={create} className="space-y-2">
            <textarea autoFocus value={title}
                      onChange={(e) => {
	                      setTitle(e.target.value);
	                      setCardError(null);
                      }}
                      placeholder="عنوان کارت…" rows={2}
                      className="w-full resize-none rounded-chip border border-line p-2 text-sm outline-none focus:border-teal"/>
								{cardError && <p className="text-xs text-rose">{cardError}</p>}
								<div className="flex gap-2">
									<button type="submit" className="rounded-chip bg-ink px-3 py-1 text-xs text-white">افزودن</button>
									<button type="button" onClick={() => {
										setAdding(false);
										setCardError(null);
									}}
									        className="rounded-chip px-3 py-1 text-xs text-inkSoft hover:bg-paper">انصراف
									</button>
								</div>
							</form>
					) : (
							<button onClick={() => setAdding(true)}
							        className="w-full rounded-chip px-2 py-1.5 text-start text-sm text-inkSoft hover:bg-paper">+
								افزودن کارت</button>
					)}
				</div>
			</div>
	);
}