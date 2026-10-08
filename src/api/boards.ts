import { api } from "./client";
import type { Board, BoardMember, Card, Label, List } from "@/types";

export const boardsApi = {
  get: (id: string) => api<Board>(`boards/${id}/`),
  update: (id: string, patch: { name?: string; visibility?: "private" | "workspace" }) =>
    api<Board>(`boards/${id}/`, { method: "PATCH", body: patch }),
  remove: (id: string) => api<void>(`boards/${id}/`, { method: "DELETE" }),

  lists: (id: string) => api<List[]>(`boards/${id}/lists/`),
  createList: (id: string, title: string) => api<List>(`boards/${id}/lists/`, { method: "POST", body: { title } }),
  updateList: (id: string, listId: string, patch: { title: string }) =>
    api<List>(`boards/${id}/lists/${listId}/`, { method: "PATCH", body: patch }),
  deleteList: (id: string, listId: string) => api<void>(`boards/${id}/lists/${listId}/`, { method: "DELETE" }),
  moveList: (id: string, listId: string, position: number) =>
    api<void>(`boards/${id}/lists/${listId}/move/`, { method: "POST", body: { position } }),

  listCards: (id: string, listId: string) => api<Card[]>(`boards/${id}/lists/${listId}/cards/`),
  createCard: (id: string, listId: string, title: string, description?: string) =>
    api<Card>(`boards/${id}/lists/${listId}/cards/`, { method: "POST", body: { title, description } }),
  getCard: (id: string, cardId: string) => api<Card>(`boards/${id}/cards/${cardId}/`),
  updateCard: (id: string, cardId: string, patch: Partial<Pick<Card, "title" | "description" | "due_at">>) =>
    api<Card>(`boards/${id}/cards/${cardId}/`, { method: "PATCH", body: patch }),
  deleteCard: (id: string, cardId: string) => api<void>(`boards/${id}/cards/${cardId}/`, { method: "DELETE" }),
  moveCard: (id: string, cardId: string, destination_list_id: string, position: number) =>
    api<void>(`boards/${id}/cards/${cardId}/move/`, { method: "POST", body: { destination_list_id, position } }),

  members: (id: string) => api<BoardMember[]>(`boards/${id}/members/`),
  addMember: (id: string, phone_number: string, role: "admin" | "member") =>
    api<BoardMember>(`boards/${id}/members/`, { method: "POST", body: { phone_number, role } }),
  updateMember: (id: string, membershipId: string, role: "admin" | "member") =>
    api<BoardMember>(`boards/${id}/members/${membershipId}/`, { method: "PATCH", body: { role } }),
  removeMember: (id: string, membershipId: string) =>
    api<void>(`boards/${id}/members/${membershipId}/`, { method: "DELETE" }),

  labels: (id: string) => api<Label[]>(`boards/${id}/labels/`),
  createLabel: (id: string, name: string, color: string) =>
    api<Label>(`boards/${id}/labels/`, { method: "POST", body: { name, color } }),
  updateLabel: (id: string, labelId: string, patch: { name?: string; color?: string }) =>
    api<Label>(`boards/${id}/labels/${labelId}/`, { method: "PATCH", body: patch }),
  deleteLabel: (id: string, labelId: string) => api<void>(`boards/${id}/labels/${labelId}/`, { method: "DELETE" }),
};
