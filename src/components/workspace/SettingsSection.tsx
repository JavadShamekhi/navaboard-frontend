import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { workspacesApi } from "@/api/workspaces";
import { isMe, memberUser, personLabel } from "@/lib/roles";
import { Section, Status, btnCls, dangerBtnCls, inputCls, useAction } from "@/components/ui";
import type { User, Workspace, WorkspaceRole } from "@/types";

export default function SettingsSection({ workspace, me, role }: { workspace: Workspace; me: User; role?: WorkspaceRole }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isOwner = role === "owner";
  const canRename = role === "owner" || role === "admin";
  const [name, setName] = useState(workspace.name);
  const [newOwner, setNewOwner] = useState("");
  const rename = useAction();
  const transfer = useAction();
  const leave = useAction();
  const del = useAction();
  const { data: members } = useQuery({ queryKey: ["workspace-members", workspace.id], queryFn: () => workspacesApi.members(workspace.id) });
  const others = members?.filter((m) => m.role !== "owner" && !isMe(memberUser(m), me)) ?? [];
  const myMembership = members?.find((m) => isMe(memberUser(m), me));

  const refreshWorkspace = () => {
    qc.invalidateQueries({ queryKey: ["workspace", workspace.id] });
    qc.invalidateQueries({ queryKey: ["workspace-members", workspace.id] });
    qc.invalidateQueries({ queryKey: ["workspaces"] });
  };
  const goList = () => { qc.invalidateQueries({ queryKey: ["workspaces"] }); navigate("/workspaces", { replace: true }); };

  return (
    <>
      {canRename && (
        <Section title="نام فضای کاری">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); rename.run(async () => { await workspacesApi.rename(workspace.id, name.trim()); refreshWorkspace(); }, "نام تغییر کرد."); }}>
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
            <button disabled={rename.pending || name.trim() === workspace.name} className={btnCls}>ذخیره</button>
          </form>
          <Status error={rename.error} ok={rename.ok} />
        </Section>
      )}

      {isOwner && (
        <Section title="انتقال مالکیت" hint="مالک جدید باید عضو همین فضای کاری باشد. بعد از انتقال، شما مدیر می‌شوید.">
          {others.length === 0 ? (
            <p className="text-sm text-inkSoft">ابتدا یک عضو اضافه کنید.</p>
          ) : (
            <form className="flex gap-2" onSubmit={(e) => {
              e.preventDefault();
              const target = others.find((m) => memberUser(m).id === newOwner);
              if (!target) return;
              if (!window.confirm(`مالکیت به «${personLabel(memberUser(target))}» منتقل شود؟`)) return;
              transfer.run(async () => { await workspacesApi.transferOwnership(workspace.id, memberUser(target).phone_number); setNewOwner(""); refreshWorkspace(); }, "مالکیت منتقل شد.");
            }}>
              <select value={newOwner} onChange={(e) => setNewOwner(e.target.value)} required className="min-w-0 flex-1 rounded-chip border border-line bg-white px-2 py-2 text-sm">
                <option value="">انتخاب عضو…</option>
                {others.map((m) => <option key={m.id} value={memberUser(m).id}>{personLabel(memberUser(m))}</option>)}
              </select>
              <button disabled={transfer.pending} className={btnCls}>انتقال</button>
            </form>
          )}
          <Status error={transfer.error} ok={transfer.ok} />
        </Section>
      )}

      {!isOwner && myMembership && (
        <Section title="خروج از فضای کاری" danger>
          <button disabled={leave.pending} className={dangerBtnCls} onClick={() => {
            if (!window.confirm("از این فضای کاری خارج می‌شوید و دسترسی‌تان به بردها از بین می‌رود. ادامه می‌دهید؟")) return;
            leave.run(async () => { await workspacesApi.removeMember(workspace.id, myMembership.id); goList(); });
          }}>خروج</button>
          <Status error={leave.error} ok={null} />
        </Section>
      )}

      {isOwner && (
        <Section title="حذف فضای کاری" hint="همه‌ی بردها و کارت‌های این فضای کاری از دسترس خارج می‌شوند و بازیابی عمومی وجود ندارد. مالک باید قبل از خروج مالکیت را منتقل کند." danger>
          <button disabled={del.pending} className={dangerBtnCls} onClick={() => {
            if (window.prompt(`برای تأیید، نام فضای کاری («${workspace.name}») را بنویسید:`) !== workspace.name) return;
            del.run(async () => { await workspacesApi.remove(workspace.id); goList(); });
          }}>حذف فضای کاری</button>
          <Status error={del.error} ok={null} />
        </Section>
      )}
    </>
  );
}
