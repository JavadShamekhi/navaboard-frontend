import {useRef, useState} from "react";
import {Link, useParams, useSearchParams} from "react-router-dom";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {
	DndContext,
	DragOverlay,
	MeasuringStrategy,
	PointerSensor,
	closestCenter,
	pointerWithin,
	useSensor,
	useSensors,
	type CollisionDetection,
	type DragEndEvent,
	type DragMoveEvent,
	type DragStartEvent,
	type Over,
} from "@dnd-kit/core";
import {SortableContext, arrayMove, horizontalListSortingStrategy} from "@dnd-kit/sortable";
import {boardsApi} from "@/api/boards";
import {searchApi} from "@/api/search";
import {workspacesApi} from "@/api/workspaces";
import {ApiError} from "@/api/client";
import type {Board, Card} from "@/types";
import ListColumn from "@/components/board/ListColumn";
import CardItem from "@/components/board/CardItem";
import CrossBoardDialog, {type CrossMove} from "@/components/board/CrossBoardDialog";
import CardModal from "@/components/card/CardModal";
import {describeError} from "@/lib/errors";
import {CROSS_BOARD_MOVE_SUPPORTED, CROSS_BOARD_REASON} from "@/lib/crossBoard";

type ListT = NonNullable<Board["lists"]>[number];

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
				return {...l, cards: [...cards].sort((x, y) => x.position - y.position)};
			})
	);
	return {...b, lists};
}

/** Pure local card move for the optimistic update; same 0-based positions as the backend. */
function applyMove(board: Board, cardId: string, destListId: string, position: number): Board {
	const lists = (board.lists ?? []).map((l) => ({...l, cards: [...(l.cards ?? [])]}));
	let moved: Card | undefined;
	for (const l of lists) {
		const i = l.cards.findIndex((c) => c.id === cardId);
		if (i >= 0) {
			moved = l.cards.splice(i, 1)[0];
			break;
		}
	}
	const dest = lists.find((l) => l.id === destListId);
	if (!moved || !dest) return board;
	dest.cards.splice(Math.min(position, dest.cards.length), 0, {...moved, list_id: destListId});
	return {...board, lists};
}

/** Columns (type "list") are only compared with columns; cards with cards / drop zones. */

const collision: CollisionDetection = (args) => {
	const isList = args.active.data.current?.type === "list";

	// Columns can only collide with other columns.
	if (isList) {
		return closestCenter({
			...args,
			droppableContainers: args.droppableContainers.filter(
					(container) => container.data.current?.type === "list",
			),
		});
	}

	// Cards can only be dropped on cards or explicit card drop zones.
	const targets = args.droppableContainers.filter((container) => {
		const type = container.data.current?.type;
		return type === "card" || type === "zone";
	});

	// Only accept targets physically underneath the pointer.
	// This prevents dropping a card on a board header from selecting
	// an unrelated column just because it is geometrically nearby.
	const hits = pointerWithin({
		...args,
		droppableContainers: targets,
	});

	// A card takes priority over its surrounding column drop zone.
	const cardHits = hits.filter(
			(hit) =>
					args.droppableContainers.find(
							(container) => container.id === hit.id,
					)?.data.current?.type === "card",
	);

	return cardHits.length > 0
			? cardHits
			: hits.filter(
					(hit) =>
							args.droppableContainers.find(
									(container) => container.id === hit.id,
							)?.data.current?.type === "zone",
			);
};


/** Where a dragged CARD was dropped: over another card (index known) or on a column's empty area (append). */
function resolveDest(over: Over): { listId: string; index?: number } | null {
	const d = over.data.current as {
		type?: string;
		listId?: string;
		sortable?: { containerId: string; index: number }
	} | undefined;
	if (d?.type === "card" && d.sortable) return {listId: String(d.sortable.containerId), index: d.sortable.index};
	if (d?.type === "zone" && d.listId) return {listId: d.listId};
	if (d?.type === "list") return {listId: String(over.id)};
	return null;
}

export default function BoardPage() {
	const {boardId} = useParams<{ boardId: string }>();
	const queryClient = useQueryClient();
	const [sp, setSp] = useSearchParams();
	const [activeCard, setActiveCard] = useState<Card | null>(null);
	const [activeList, setActiveList] = useState<{ list: ListT; boardId: string } | null>(null);
	// ?card=<id> opens that card of this board (used by search results).
	const [open, setOpen] = useState<{ boardId: string; cardId: string } | null>(
			sp.get("card") && boardId ? {boardId, cardId: sp.get("card")!} : null
	);
	const [notice, setNotice] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [cross, setCross] = useState<CrossMove | null>(null);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [newList, setNewList] = useState("");

	// ?with=<boardId>: a second board shown below, so cards can be dragged between the two boards.
	const withId = sp.get("with") ?? "";
	const showOther = pickerOpen || !!withId;

	const {data: board, isLoading, error} = useQuery({
		queryKey: ["board", boardId],
		queryFn: () => loadBoard(boardId!),
		enabled: !!boardId
	});
	const other = useQuery({queryKey: ["board", withId], queryFn: () => loadBoard(withId), enabled: !!withId});
	const {data: allBoards} = useQuery({
		queryKey: ["all-boards"], enabled: showOther,
		queryFn: async () => {
			const d = await searchApi.boards();
			return Array.isArray(d) ? d : d.results;
		},
	});
	// Always fetched: the workspace name is shown in the header bar.
	const {data: workspaces} = useQuery({queryKey: ["workspaces"], queryFn: workspacesApi.list});
	const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 6}}));

	// Live pointer position during a drag. NOTE: dnd-kit's DragEndEvent has NO activatorEvent,
	// so it must be tracked in onDragMove — this was why drops used to land one card off.
	const pointer = useRef({x: 0, y: 0, valid: false});

	const primaryBoardRef = useRef<HTMLDivElement | null>(null);
	const otherBoardRef = useRef<HTMLDivElement | null>(null);

	const boards = [board, other.data].filter(Boolean) as Board[];
	const find = (cardId: string) => {
		for (const b of boards) for (const l of b.lists ?? []) {
			const c = l.cards?.find((x) => x.id === cardId);
			if (c) return {card: c, board: b};
		}
	};
	const refresh = (...ids: string[]) => ids.forEach((id) => queryClient.invalidateQueries({queryKey: ["board", id]}));
	const setWith = (id: string) => {
		if (id) sp.set("with", id); else sp.delete("with");
		setSp(sp, {replace: true});
	};
	const wsName = (id: string) => workspaces?.find((w) => w.id === id)?.name;

	/** activator position + total delta = current pointer position (works for PointerSensor). */
	function trackPointer(activatorEvent: unknown, delta: { x: number; y: number }) {
		const e = activatorEvent as { clientX?: number; clientY?: number; nativeEvent?: PointerEvent } | undefined;
		const p = (e?.nativeEvent ?? e) as { clientX?: number; clientY?: number } | undefined;
		if (p && typeof p.clientX === "number" && typeof p.clientY === "number") {
			pointer.current = {x: p.clientX + delta.x, y: p.clientY + delta.y, valid: true};
		}
	}

	function onDragStart(e: DragStartEvent) {
		trackPointer(e.activatorEvent, {x: 0, y: 0});
		if (e.active.data.current?.type === "list") {
			setActiveCard(null);
			const hit = boards
					.flatMap((b) => (b.lists ?? []).map((list) => ({list, boardId: b.id})))
					.find((x) => x.list.id === String(e.active.id));
			setActiveList(hit ?? null);
		} else {
			setActiveList(null);
			setActiveCard(find(String(e.active.id))?.card ?? null);
		}
	}


	function onDragMove(e: DragMoveEvent) {
		trackPointer(e.activatorEvent, e.delta);

		if (!pointer.current.valid) return;

		const {x, y} = pointer.current;

		const container = [
			primaryBoardRef.current,
			otherBoardRef.current,
		].find((element) => {
			if (!element) return false;

			const rect = element.getBoundingClientRect();

			return (
					x >= rect.left &&
					x <= rect.right &&
					y >= rect.top &&
					y <= rect.bottom
			);
		});

		if (!container) return;

		const rect = container.getBoundingClientRect();
		const edgeSize = 64;

		if (x < rect.left + edgeSize) {
			const distance = rect.left + edgeSize - x;

			container.scrollBy({
				left: -Math.max(8, Math.ceil(distance / 3)),
				behavior: "auto",
			});
		} else if (x > rect.right - edgeSize) {
			const distance = x - (rect.right - edgeSize);

			container.scrollBy({
				left: Math.max(8, Math.ceil(distance / 3)),
				behavior: "auto",
			});
		}
	}


	function onDragCancel() {
		setActiveCard(null);
		setActiveList(null);
	}

	/** A drop must NEVER throw or show an error. Anything unexpected = resync from the server. */
	async function onDragEnd(e: DragEndEvent) {
		const isList = e.active.data.current?.type === "list";
		setActiveCard(null);
		setActiveList(null);
		try {
			if (isList) await moveColumn(e);
			else await moveCard(e);
		} catch {
			setNotice("همگام‌سازی با سرور انجام شد؛ آیتم‌ها در جای قبلی خودشان هستند.");
			boards.forEach((b) => refresh(b.id));
		}
	}

	/**
	 * CARD drop. Without a valid destination NOTHING changes, so dnd-kit returns the card to its
	 * exact original place. With one, the insertion index comes from the final pointer position:
	 * lower half of the hovered card -> insert after it, upper half -> before it.
	 */
	async function moveCard(e: DragEndEvent) {
		const {active, over} = e;
		if (!over || active.id === over.id) return; // no target / dropped on itself -> snap back

		const cardId = String(active.id);
		const src = find(cardId);
		const dest = resolveDest(over);
		if (!src || !dest) return; // no destination -> snap back
		const destBoard = boards.find((b) => b.lists?.some((l) => l.id === dest.listId));
		const destList = destBoard?.lists?.find((l) => l.id === dest.listId);
		if (!destBoard || !destList) return; // no destination -> snap back

		const destCards = destList.cards ?? [];
		const count = destCards.length;
		const sameList = src.card.list_id === dest.listId;
		const sameBoard = src.board.id === destBoard.id;

		const below = pointer.current.valid && pointer.current.y > over.rect.top + over.rect.height / 2;
		let insertAt = dest.index === undefined ? count : Math.min(dest.index + (below ? 1 : 0), count);

		if (sameList) {
			const from = destCards.findIndex((c) => c.id === cardId);
			if (from < 0) return;
			// Within the same list the dragged card is removed first, so the array shifts by one.
			if (dest.index !== undefined && from < dest.index) insertAt -= 1;
			if (insertAt === from) return; // nothing changed -> snap back
			insertAt = Math.max(0, Math.min(insertAt, count - 1));
		}

		if (!sameBoard) {
			await crossMove(src.card, src.board, destBoard, dest.listId, insertAt); // may open the copy dialog
			return;
		}

		// Same board: optimistic update, silent rollback on failure (never a red error).
		const key = ["board", src.board.id];
		setNotice(null);
		const previous = queryClient.getQueryData<Board>(key);
		if (previous) queryClient.setQueryData<Board>(key, applyMove(previous, cardId, dest.listId, insertAt));
		try {
			await boardsApi.moveCard(src.board.id, cardId, dest.listId, insertAt);
		} catch (error) {
			if (previous) queryClient.setQueryData(key, previous); // roll back: card is back where it was
			console.error("Failed to move card:", error);
		} finally {
			queryClient.invalidateQueries({queryKey: key}); // the server owns the final order
		}
	}

	/** COLUMN drop — same contract as cards: no valid target -> nothing happens (snaps back). */
	async function moveColumn(e: DragEndEvent) {
		const {active, over} = e;
		if (!over || active.id === over.id) return;
		const listId = String(active.id);
		const srcBoard = boards.find((b) => b.lists?.some((l) => l.id === listId));
		const lists = srcBoard?.lists ?? [];
		const to = lists.findIndex((l) => l.id === String(over.id));
		const from = lists.findIndex((l) => l.id === listId);
		if (!srcBoard || to < 0 || from < 0 || from === to) return;

		const key = ["board", srcBoard.id];
		setNotice(null);
		const previous = queryClient.getQueryData<Board>(key);
		if (previous) {
			queryClient.setQueryData<Board>(key, {
				...previous,
				lists: arrayMove(lists, from, to).map((l, i) => ({...l, position: i}))
			});
		}
		try {
			await boardsApi.moveList(srcBoard.id, listId, to);
		} catch {
			if (previous) queryClient.setQueryData(key, previous); // return to the previous order
			setNotice("جابه‌جایی ستون ثبت نشد؛ به ترتیب قبلی برگشت.");
		} finally {
			queryClient.invalidateQueries({queryKey: key});
			queryClient.invalidateQueries({queryKey: ["lists", srcBoard.id]});
		}
	}

	async function crossMove(card: Card, srcBoard: Board, destBoard: Board, destListId: string, position: number) {
		setNotice(null);
		if (!CROSS_BOARD_MOVE_SUPPORTED) {
			setCross({card, srcBoard, destBoard, destListId, position, reason: CROSS_BOARD_REASON});
			return;
		}
		setBusy(true);
		try {
			await boardsApi.moveCard(srcBoard.id, card.id, destListId, position); // the endpoint lives under the SOURCE board
			setNotice(`«${card.title}» به برد «${destBoard.name}» منتقل شد.`);
		} catch (err) {
			// 400/404 = refused across boards: offer an explicit, confirmed copy. Anything else: neutral notice, no throw.
			if (err instanceof ApiError && (err.status === 400 || err.status === 404)) setCross({
				card,
				srcBoard,
				destBoard,
				destListId,
				position,
				reason: describeError(err)
			});
			else setNotice("انتقال انجام نشد؛ کارت در جای قبلی خودش ماند.");
		} finally {
			setBusy(false);
			refresh(srcBoard.id, destBoard.id);
		}
	}

	async function addList(e: React.FormEvent) {
		e.preventDefault();
		const name = newList.trim();
		if (!name || !boardId) return;
		try {
			await boardsApi.createList(boardId, name);
			setNewList("");
			setNotice(null);
		} catch {
			setNotice("ستون ساخته نشد؛ لطفاً دوباره تلاش کنید.");
		} finally {
			refresh(boardId);
		}
	}

	if (isLoading) return <div className="p-8 text-inkSoft">در حال بارگذاری برد…</div>;
	if (error || !board) return <div className="p-8 text-rose">{describeError(error)}</div>;

	const columns = (b: Board) => (
			<SortableContext id={`board:${b.id}`} items={(b.lists ?? []).map((l) => l.id)}
			                 strategy={horizontalListSortingStrategy}>
				{b.lists?.map((l) => <ListColumn key={l.id} list={l} boardId={b.id}
				                                 onOpenCard={(cardId) => setOpen({boardId: b.id, cardId})}/>)}
			</SortableContext>
	);

	return (
			<div className="px-6 py-6">
				{/* Workspace bar: distinct color from the page background + taller */}
				<header
						className="mb-7 flex min-h-[84px] flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-paperRaised px-6 py-5 shadow-sm">
					<div className="flex items-center gap-3">
						<Link to={`/workspaces/${board.workspace_id}`}
						      className="rounded-chip bg-teal-soft px-3 py-2 text-sm font-medium text-teal transition-colors hover:bg-teal hover:text-white">
							{wsName(board.workspace_id) ?? "فضای کاری"}
						</Link>
						<span className="text-inkSoft">/</span>
						<h1 className="text-lg font-semibold">{board.name}</h1>
					</div>
					<div className="flex items-center gap-4 text-sm">
						{!showOther &&
                <button onClick={() => setPickerOpen(true)} className="text-teal hover:underline">انتقال کارت به برد
                    دیگر</button>}
						<Link to={`/boards/${board.id}/settings`} className="text-teal hover:underline">تنظیمات برد، ستون‌ها و
							اعضا</Link>
					</div>
				</header>

				{notice &&
            <p className="mb-3 rounded-chip bg-teal-soft px-3 py-2 text-sm" data-testid="move-notice">{notice}</p>}
				{busy && <p className="mb-3 text-sm text-inkSoft" data-testid="move-busy">در حال جابه‌جایی…</p>}

				<DndContext
						sensors={sensors}
						collisionDetection={collision}
						measuring={{droppable: {strategy: MeasuringStrategy.Always}}}
						onDragStart={onDragStart}
						onDragMove={onDragMove}
						onDragEnd={onDragEnd}
						onDragCancel={onDragCancel}
				>
					<div ref={primaryBoardRef} className="flex items-start gap-4 overflow-x-auto pb-4"
					     data-testid="primary-board">
						{columns(board)}
						<form onSubmit={addList} className="w-72 shrink-0">
							<input value={newList} onChange={(e) => setNewList(e.target.value)} placeholder="+ ستون جدید"
							       className="w-full rounded-card border border-dashed border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-teal"/>
						</form>
					</div>

					{showOther && (
							<section className="mt-4 rounded-card border border-dashed border-teal/60 bg-paperRaised/40 p-4"
							         data-testid="other-board">
								<div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
									<span className="font-medium">برد مقصد (کارت‌ها را بین دو برد بکشید)</span>
									<select aria-label="برد مقصد" value={withId} onChange={(e) => setWith(e.target.value)}
									        className="rounded-chip border border-line bg-white px-2 py-1.5">
										<option value="">انتخاب برد…</option>
										{allBoards?.filter((b) => b.id !== board.id).map((b) => <option key={b.id}
										                                                                value={b.id}>{wsName(b.workspace_id) ? `${wsName(b.workspace_id)} / ` : ""}{b.name}</option>)}
									</select>
									{withId && other.data &&
                      <Link to={`/boards/${withId}`} className="text-teal hover:underline">باز کردن این برد</Link>}
									<button onClick={() => {
										setWith("");
										setPickerOpen(false);
									}} className="text-inkSoft hover:underline">بستن
									</button>
								</div>
								{!CROSS_BOARD_MOVE_SUPPORTED &&
                    <p className="mb-3 text-xs text-inkSoft">API فقط جابه‌جایی داخل یک برد را می‌پذیرد؛ کشیدن کارت به
                        این برد، گزینه‌ی «کپی کارت» را نشان می‌دهد.</p>}
								{!withId &&
                    <p className="text-sm text-inkSoft">یک برد انتخاب کنید تا ستون‌هایش اینجا نمایش داده شود.</p>}
								{withId && other.isLoading && <p className="text-sm text-inkSoft">در حال بارگذاری…</p>}
								{withId && other.error && <p className="text-sm text-rose">{describeError(other.error)}</p>}
								{other.data && <div ref={otherBoardRef}
                                    className="flex items-start gap-4 overflow-x-auto pb-2">{columns(other.data)}</div>}
							</section>
					)}
					<DragOverlay dropAnimation={{duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)"}}>
						{activeCard ? <CardItem card={activeCard} onOpen={() => {
						}} overlay/> : null}
						{activeList ? <ListColumn list={activeList.list} boardId={activeList.boardId} onOpenCard={() => {
						}} overlay/> : null}
					</DragOverlay>
				</DndContext>

				{open && <CardModal boardId={open.boardId} cardId={open.cardId} onClose={() => {
					setOpen(null);
					if (sp.has("card")) {
						sp.delete("card");
						setSp(sp, {replace: true});
					}
				}}/>}
				{cross && <CrossBoardDialog info={cross} onClose={(changed) => {
					setCross(null);
					if (changed) refresh(cross.srcBoard.id, cross.destBoard.id);
				}}/>}
			</div>
	);
}