import { api, apiUpload } from "./client";
import type { Attachment, Checklist, ChecklistItem, Comment, Label, User } from "@/types";

export const cardsApi = {
  comments: (id: string) => api<Comment[]>(`cards/${id}/comments/`),
  addComment: (id: string, body: string) => api<Comment>(`cards/${id}/comments/`, { method: "POST", body: { body } }),
  updateComment: (commentId: string, body: string) => api<Comment>(`comments/${commentId}/`, { method: "PATCH", body: { body } }),
  deleteComment: (commentId: string) => api<void>(`comments/${commentId}/`, { method: "DELETE" }),

  checklists: (id: string) => api<Checklist[]>(`cards/${id}/checklists/`),
  addChecklist: (id: string, title: string) => api<Checklist>(`cards/${id}/checklists/`, { method: "POST", body: { title } }),
  updateChecklist: (cl: string, title: string) => api<Checklist>(`checklists/${cl}/`, { method: "PATCH", body: { title } }),
  moveChecklist: (cl: string, position: number) => api<void>(`checklists/${cl}/move/`, { method: "POST", body: { position } }),
  deleteChecklist: (cl: string) => api<void>(`checklists/${cl}/`, { method: "DELETE" }),
  addChecklistItem: (cl: string, title: string) => api<ChecklistItem>(`checklists/${cl}/items/`, { method: "POST", body: { title } }),
  toggleChecklistItem: (item: string, is_completed: boolean) =>
    api<ChecklistItem>(`checklist-items/${item}/`, { method: "PATCH", body: { is_completed } }),
  moveChecklistItem: (item: string, position: number) => api<void>(`checklist-items/${item}/move/`, { method: "POST", body: { position } }),
  deleteChecklistItem: (item: string) => api<void>(`checklist-items/${item}/`, { method: "DELETE" }),

  labels: (id: string) => api<Label[]>(`cards/${id}/labels/`),
  attachLabel: (id: string, label_id: string) => api<void>(`cards/${id}/labels/`, { method: "POST", body: { label_id } }),
  detachLabel: (id: string, labelId: string) => api<void>(`cards/${id}/labels/${labelId}/`, { method: "DELETE" }),

  assignees: (id: string) => api<User[]>(`cards/${id}/members/`),
  assign: (id: string, phone_number: string) => api<User>(`cards/${id}/members/`, { method: "POST", body: { phone_number } }),
  unassign: (id: string, assigneeId: string) => api<void>(`cards/${id}/members/${assigneeId}/`, { method: "DELETE" }),

  attachments: (id: string) => api<Attachment[]>(`cards/${id}/attachments/`),
  upload: (id: string, file: File) => { const f = new FormData(); f.append("file", file); return apiUpload<Attachment>(`cards/${id}/attachments/`, f); },
  deleteAttachment: (id: string, attId: string) => api<void>(`cards/${id}/attachments/${attId}/`, { method: "DELETE" }),
};
