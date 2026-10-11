import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { boardsApi } from "@/api/boards";
import { workspacesApi } from "@/api/workspaces";
import { describeError } from "@/lib/errors";
import { BOARD_ROLE_LABEL, isMe, memberUser, personLabel } from "@/lib/roles";
import Avatar from "@/components/Avatar";
import { Section, Status, btnCls, ltrInput, useAction } from "@/components/ui";
import type { Board, BoardMember, User } from "@/types";

export default function BoardMembersSection({ board, me, canManage }: { board: Board; me: User; canManage: boolean }) {
  const qc = useQueryClient();
  const key = ["board-members", board.id];
  const { data: members, isLoading, error } = useQuery({ queryKey: key, queryFn: () => boardsApi.members(board.id) });
  // Suggestions: only workspace members can join a board, so offer those who are not on it yet.
  const { data: wsMembers } = useQuery({ queryKey: ["workspace-members", board.workspace_id], queryFn: () => workspacesApi.members(board.workspace_id), enabled: canManage });
  const candidates = (wsMembers ?? []).map(memberUser).filter((u) => !members?.some((m) => isMe(memberUser(m), u)));
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const add = useAction();
  const row = useAction();
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const adminCount = members?.filter((m) => m.role === "admin").length ?? 0;

  // Never offer removing/demoting the last admin; the backend is the final authority anyway.
  const isLastAdmin = (m: BoardMember) => m.role === "admin" && adminCount <= 1;

  return (
    <Section title="اعضای برد" hint="فقط اعضای همین فضای کاری را می‌توان به برد اضافه کرد.">
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
              {canManage && !isLastAdmin(m) ? (
                <select value={m.role} disabled={row.pending} className="rounded-chip border border-line bg-white px-2 py-1 text-sm"
                  onChange={(e) => row.run(async () => { await boardsApi.updateMember(board.id, m.id, e.target.value as "admin" | "member"); refresh(); })}>
                  <option value="admin">{BOARD_ROLE_LABEL.admin}</option>
                  <option value="member">{BOARD_ROLE_LABEL.member}</option>
                </select>
              ) : (
                <span className="rounded-chip bg-paper px-2 py-1 text-xs text-inkSoft">{BOARD_ROLE_LABEL[m.role]}</span>
              )}
              {canManage && !isLastAdmin(m) && (
                <button disabled={row.pending} className="text-sm text-rose hover:underline" onClick={() => {
                  if (!window.confirm(`«${personLabel(u)}» از برد حذف شود؟`)) return;
                  row.run(async () => { await boardsApi.removeMember(board.id, m.id); refresh(); });
                }}>حذف</button>
              )}
            </li>
          );
        })}
      </ul>
      <Status error={row.error} ok={null} />

      {canManage && (
        <>
          <form className="flex flex-wrap gap-2 border-t border-line pt-3" onSubmit={(e) => {
            e.preventDefault();
            add.run(async () => { await boardsApi.addMember(board.id, phone.trim(), role); setPhone(""); refresh(); }, "عضو به برد اضافه شد.");
          }}>
            <input list="ws-candidates" dir="ltr" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09121234567" required className={ltrInput + " min-w-40 flex-1"} />
            <datalist id="ws-candidates">{candidates.map((u) => <option key={u.id} value={u.phone_number}>{personLabel(u)}</option>)}</datalist>
            <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "member")} className="rounded-chip border border-line bg-white px-2 py-2 text-sm">
              <option value="member">{BOARD_ROLE_LABEL.member}</option>
              <option value="admin">{BOARD_ROLE_LABEL.admin}</option>
            </select>
            <button disabled={add.pending} className={btnCls}>افزودن عضو</button>
          </form>
          <Status error={add.error} ok={add.ok} />
        </>
      )}
    </Section>
  );
}
