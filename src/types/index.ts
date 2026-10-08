// Types are inferred from the integration guide. Swagger/schema.yml is the source of truth — verify against it.
export type UUID = string;
export type WorkspaceRole = "owner" | "admin" | "member";
export type BoardRole = "admin" | "member";
export type BoardVisibility = "private" | "workspace";

export interface User { id: UUID; phone_number: string; full_name: string | null; email: string | null }
export interface Workspace { id: UUID; name: string; role_user_current?: WorkspaceRole; created_at: string }
export interface WorkspaceMember { id: UUID; user: User; role: WorkspaceRole } // id = membership id, not user id
export interface Board {
  id: UUID; workspace_id: UUID; name: string; visibility: BoardVisibility;
  role_user_current?: BoardRole; lists?: List[]; created_at: string;
}
export interface BoardMember { id: UUID; user: User; role: BoardRole }
export interface List { id: UUID; board_id: UUID; title: string; position: number; cards?: Card[] }
export interface Card {
  id: UUID; list_id: UUID; title: string; description: string | null; position: number;
  due_at: string | null; creator: User; created_at: string; updated_at: string;
  labels?: Label[]; assignees?: User[]; checklists?: Checklist[];
}
export interface Label { id: UUID; board_id: UUID; name: string; color: string }
export interface Checklist { id: UUID; card_id: UUID; title: string; position: number; items: ChecklistItem[] }
export interface ChecklistItem { id: UUID; checklist_id: UUID; title: string; position: number; is_completed: boolean }
export interface Comment { id: UUID; card_id: UUID; author: User; body: string; created_at: string; updated_at: string }
export interface Attachment { id: UUID; card_id: UUID; original_name: string; size: number; created_at: string }
export interface NotificationItem { id: UUID; action: string; read_at: string | null; created_at: string; activity: Record<string, unknown> }
export interface ActivityItem { id: UUID; actor: User; action: string; resource_id: UUID; created_at: string }
export interface Paginated<T> { count: number; next: string | null; previous: string | null; results: T[] }
export type ApiErrorBody = { detail: string } | Record<string, string[]> | string[];
