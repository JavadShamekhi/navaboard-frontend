import { useQuery } from "@tanstack/react-query";
import { workspacesApi } from "@/api/workspaces";
import type { User, WorkspaceMember, WorkspaceRole } from "@/types";

export const ROLE_LABEL: Record<WorkspaceRole, string> = { owner: "مالک", admin: "مدیر", member: "عضو" };

/** Membership rows carry the user nested; tolerate a flat shape too until the schema is confirmed. */
export function memberUser(m: WorkspaceMember): User {
  return (m as { user?: User }).user ?? (m as unknown as User);
}
export const personLabel = (u: User) => u.full_name || u.phone_number;

const digits = (p?: string | null) => (p ?? "").replace(/\D/g, "").slice(-10);
/** Same person: matching id, or the same phone number regardless of 09.. / +989.. format. */
export const isMe = (u: User, me: User) => u.id === me.id || (!!digits(u.phone_number) && digits(u.phone_number) === digits(me.phone_number));

/**
 * The API does not return the caller role on the workspace, so it is read from the member list:
 * the caller own membership carries it. The query is shared with the members section (one request).
 */
export function useMyWorkspaceRole(workspaceId: string, me: User) {
  const q = useQuery({ queryKey: ["workspace-members", workspaceId], queryFn: () => workspacesApi.members(workspaceId) });
  const membership = q.data?.find((m) => isMe(memberUser(m), me));
  return { role: membership?.role as WorkspaceRole | undefined, membership, members: q.data, isLoading: q.isLoading, error: q.error };
}
