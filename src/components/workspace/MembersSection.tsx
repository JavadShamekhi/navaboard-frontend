import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { workspacesApi } from "@/api/workspaces";
import { describeError } from "@/lib/errors";
import { ROLE_LABEL, isMe, memberUser, personLabel } from "@/lib/roles";
import Avatar from "@/components/Avatar";
import { Section, Status, btnCls, ltrInput, useAction } from "@/components/ui";
import type { User, Workspace, WorkspaceMember, WorkspaceRole } from "@/types";

export default function MembersSection({ workspace, me, role }: { workspace: Workspace; me: User; role?: WorkspaceRole }) {
  const qc = useQueryClient();
  const isOwner = role === "owner";
  const canManage = role === "owner" || role === "admin";
  const key = ["workspace-members", workspace.id];
  const { data: members, isLoading, error } = useQuery({ queryKey: key, queryFn: () => workspacesApi.members(workspace.id) });
  const [phone, setPhone] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "member">("member");
  const add = useAction();
  const row = useAction(); // errors from role change / removal rows

  // Owner manages everyone but the owner; an admin manages regular members only (backend is the final authority).
  const canRemove = (m: WorkspaceMember) => m.role !== "owner" && !isMe(memberUser(m), me) && (isOwner || (canManage && m.role === "member"));

  return (
    <Section title="اعضا" hint="عضو جدید باید قبلاً در ناوابرد حساب داشته باشد (با شماره‌ی موبایل).">
      {isLoading && <p className="text-sm text-inkSoft">در حال بارگذاری…</p>}
      {error && <p className="text-sm text-rose">{describeError(error)}</p>}
      <ul className="divide-y divide-line">
        {members?.map((m) => {
          const u = memberUser(m);
          return (
            <li key={m.id} className="flex items-center gap-3 py-2">
              <Avatar user={u} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{personLabel(u)}{isMe(u, me) && <span className="ms-2 text-xs text-inkSoft">(شما)</span>}</p>
                {u.full_name && <p className="text-xs text-inkSoft" dir="ltr" style={{ textAlign: "right" }}>{u.phone_number}</p>}
              </div>
              {isOwner && m.role !== "owner" ? (
                // Only the owner changes roles; "owner" itself moves through the transfer flow.
                <select value={m.role} disabled={row.pending} className="rounded-chip border border-line bg-white px-2 py-1 text-sm"
                  onChange={(e) => row.run(async () => {
                    await workspacesApi.updateMemberRole(workspace.id, m.id, e.target.value as "admin" | "member");
                    qc.invalidateQueries({ queryKey: key });
                  })}>
                  <option value="admin">{ROLE_LABEL.admin}</option>
                  <option value="member">{ROLE_LABEL.member}</option>
                </select>
              ) : (
                <span className="rounded-chip bg-paper px-2 py-1 text-xs text-inkSoft">{ROLE_LABEL[m.role]}</span>
              )}
              {canRemove(m) && (
                <button disabled={row.pending} className="text-sm text-rose hover:underline" onClick={() => {
                  if (!window.confirm(`«${personLabel(u)}» از فضای کاری حذف شود؟ دسترسی او به بردها هم از بین می‌رود.`)) return;
                  row.run(async () => { await workspacesApi.removeMember(workspace.id, m.id); qc.invalidateQueries({ queryKey: key }); });
                }}>حذف</button>
              )}
            </li>
          );
        })}
      </ul>
      <Status error={row.error} ok={null} />

      {canManage ? (
        <form className="flex flex-wrap gap-2 border-t border-line pt-3" onSubmit={(e) => {
          e.preventDefault();
          add.run(async () => {
            await workspacesApi.addMember(workspace.id, phone.trim(), newRole);
            setPhone("");
            qc.invalidateQueries({ queryKey: key });
          }, "عضو اضافه شد.");
        }}>
          <input dir="ltr" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09121234567" required className={ltrInput + " min-w-40 flex-1"} />
          <select value={newRole} onChange={(e) => setNewRole(e.target.value as "admin" | "member")} className="rounded-chip border border-line bg-white px-2 py-2 text-sm">
            <option value="member">{ROLE_LABEL.member}</option>
            <option value="admin">{ROLE_LABEL.admin}</option>
          </select>
          <button disabled={add.pending} className={btnCls}>افزودن عضو</button>
        </form>
      ) : (
        <p className="border-t border-line pt-3 text-sm text-inkSoft">فقط مالک و مدیر می‌توانند عضو اضافه کنند.</p>
      )}
      <Status error={add.error} ok={add.ok} />
    </Section>
  );
}
