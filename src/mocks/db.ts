import type { Board, BoardMember, Card, Checklist, Comment, Label, List, User, Workspace, WorkspaceMember } from "@/types";

let idCounter = 1000;
export const nextId = () => `mock-${idCounter++}`;
const now = () => new Date().toISOString();

export const currentUser: User = { id: "user-1", phone_number: "09121234567", full_name: "جواد شامخی", email: null, is_phone_verified: true };

const mkUser = (id: string, phone: string, name: string): User => ({ id, phone_number: phone, full_name: name, email: null, is_phone_verified: true });
/** Accounts that exist in the mock backend: only these phone numbers can be added as members. */
export const directory: User[] = [currentUser, mkUser("user-2", "+989351112233", "علی احمدی"), mkUser("user-3", "+989129998877", "مریم کریمی")];
export const normalizePhone = (p: string) => (p.trim().startsWith("0") ? "+98" + p.trim().slice(1) : p.trim());

const mkCard = (id: string, list_id: string, title: string, position: number): Card => ({
  id, list_id, title, description: null, position, due_at: null, creator: currentUser,
  created_at: now(), updated_at: now(), labels: [], assignees: [], checklists: [],
});

export const db = {
  workspaces: [
    { id: "ws-1", name: "تیم محصول", created_at: now() },
    { id: "ws-2", name: "تیم دیگر", created_at: now() }, // owned by someone else: exercises the non-owner view
  ] as Workspace[],
  boards: [{ id: "board-1", workspace_id: "ws-1", name: "اسپرینت جاری", visibility: "private", created_at: now() },
    { id: "board-2", workspace_id: "ws-2", name: "برد مشترک", visibility: "workspace", created_at: now() },
  ] as Board[],
  lists: [
    { id: "list-1", board_id: "board-1", title: "برای انجام", position: 0 },
    { id: "list-2", board_id: "board-1", title: "در حال انجام", position: 1 },
    { id: "list-3", board_id: "board-1", title: "انجام‌شده", position: 2 },
    { id: "list-4", board_id: "board-2", title: "کارهای مشترک", position: 0 },
  ] as List[],
  labels: [
    { id: "label-1", board_id: "board-1", name: "باگ", color: "#B5495B" },
    { id: "label-2", board_id: "board-1", name: "ویژگی جدید", color: "#2F6E6B" },
  ] as Label[],
  cards: [
    mkCard("card-1", "list-1", "پیاده‌سازی فلوی ورود با OTP", 0),
    mkCard("card-2", "list-1", "طراحی صفحه برد Kanban", 1),
    mkCard("card-3", "list-2", "اتصال drag-and-drop به move endpoint", 0),
    mkCard("card-4", "list-4", "کارت برد مشترک", 0),
  ] as Card[],
  // workspace id -> memberships (membership id is NOT the user id)
  workspaceMembers: {
    "ws-1": [
      { id: "m-1", user: currentUser, role: "owner" },
      { id: "m-2", user: directory[1], role: "member" },
    ],
    "ws-2": [
      { id: "m-3", user: directory[1], role: "owner" },
      { id: "m-4", user: currentUser, role: "member" },
    ],
  } as Record<string, WorkspaceMember[]>,
  // board id -> board memberships (a separate list from workspace members)
  boardMembers: {
    "board-1": [
      { id: "bm-1", user: currentUser, role: "admin" },
      { id: "bm-2", user: directory[1], role: "member" },
    ],
    "board-2": [
      { id: "bm-3", user: currentUser, role: "member" },
      { id: "bm-4", user: directory[1], role: "admin" },
    ],
  } as Record<string, BoardMember[]>,
  comments: [] as Comment[],
  checklists: [] as Checklist[],
};

export function boardWithLists(boardId: string): Board | undefined {
  const board = db.boards.find((b) => b.id === boardId);
  if (!board) return undefined;
  const lists = db.lists.filter((l) => l.board_id === boardId).sort((a, b) => a.position - b.position)
    .map((l) => ({ ...l, cards: db.cards.filter((c) => c.list_id === l.id).sort((a, b) => a.position - b.position) }));
  return { ...board, lists };
}

/** Insert a card at `position` inside its destination list and renumber both affected lists 0..n-1. */
export function moveCard(cardId: string, destListId: string, position: number) {
  const card = db.cards.find((c) => c.id === cardId);
  if (!card) return;
  const sourceListId = card.list_id;
  const dest = db.cards.filter((c) => c.list_id === destListId && c.id !== cardId).sort((a, b) => a.position - b.position);
  dest.splice(Math.min(position, dest.length), 0, card);
  card.list_id = destListId;
  dest.forEach((c, i) => (c.position = i));
  if (sourceListId !== destListId) {
    db.cards.filter((c) => c.list_id === sourceListId).sort((a, b) => a.position - b.position).forEach((c, i) => (c.position = i));
  }
}
