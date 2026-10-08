import { api } from "./client";
import type { Board, Workspace, WorkspaceMember } from "@/types";

export const workspacesApi = {
  list: () => api<Workspace[]>("workspaces/"),
  create: (name: string) => api<Workspace>("workspaces/", { method: "POST", body: { name } }),
  get: (id: string) => api<Workspace>(`workspaces/${id}/`),
  rename: (id: string, name: string) => api<Workspace>(`workspaces/${id}/`, { method: "PATCH", body: { name } }),
  remove: (id: string) => api<void>(`workspaces/${id}/`, { method: "DELETE" }),
  boards: (id: string) => api<Board[]>(`workspaces/${id}/boards/`),
  createBoard: (id: string, name: string, visibility: "private" | "workspace") =>
    api<Board>(`workspaces/${id}/boards/`, { method: "POST", body: { name, visibility } }),
  members: (id: string) => api<WorkspaceMember[]>(`workspaces/${id}/members/`),
  addMember: (id: string, phone_number: string, role: "admin" | "member") =>
    api<WorkspaceMember>(`workspaces/${id}/members/`, { method: "POST", body: { phone_number, role } }),
  updateMemberRole: (id: string, membershipId: string, role: "admin" | "member") =>
    api<WorkspaceMember>(`workspaces/${id}/members/${membershipId}/`, { method: "PATCH", body: { role } }),
  removeMember: (id: string, membershipId: string) =>
    api<void>(`workspaces/${id}/members/${membershipId}/`, { method: "DELETE" }),
  transferOwnership: (id: string, new_owner_phone_number: string) =>
    api(`workspaces/${id}/transfer-ownership/`, { method: "POST", body: { new_owner_phone_number } }),
};
