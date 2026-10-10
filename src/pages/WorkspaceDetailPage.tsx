import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { workspacesApi } from "@/api/workspaces";
import { useAuthStore } from "@/store/auth";
import { describeError } from "@/lib/errors";
import { ROLE_LABEL, useMyWorkspaceRole } from "@/lib/roles";
import BoardsSection from "@/components/workspace/BoardsSection";
import MembersSection from "@/components/workspace/MembersSection";
import SettingsSection from "@/components/workspace/SettingsSection";
import type { User, Workspace } from "@/types";

export default function WorkspaceDetailPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const me = useAuthStore((s) => s.user);
  const { data: ws, isLoading, error } = useQuery({ queryKey: ["workspace", workspaceId], queryFn: () => workspacesApi.get(workspaceId!), enabled: !!workspaceId });

  if (isLoading) return <div className="p-8 text-inkSoft">در حال بارگذاری…</div>;
  if (error || !ws || !me) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <p className="text-rose">{describeError(error)}</p>
        <Link to="/workspaces" className="mt-3 inline-block text-sm text-teal hover:underline">بازگشت به فضاهای کاری</Link>
      </div>
    );
  }
  return <Detail ws={ws} me={me} />;
}

function Detail({ ws, me }: { ws: Workspace; me: User }) {
  const { role, members, isLoading, error } = useMyWorkspaceRole(ws.id, me);
  // Members loaded but our own row was not found: say so instead of silently hiding the settings.
  const roleUnknown = !isLoading && !error && !!members && !role;

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-6 py-10">
      <div>
        <Link to="/workspaces" className="text-sm text-inkSoft hover:underline">فضاهای کاری</Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{ws.name}</h1>
          {role && <span className="rounded-chip bg-teal-soft px-2 py-0.5 text-xs text-teal">{ROLE_LABEL[role]}</span>}
        </div>
      </div>
      {roleUnknown && (
        <p className="rounded-chip bg-amber-soft px-3 py-2 text-sm">
          نقش شما در لیست اعضا پیدا نشد؛ تنظیمات نمایش داده نمی‌شود. (شکل پاسخ اعضا را بررسی کنید.)
        </p>
      )}
      <BoardsSection workspaceId={ws.id} />
      <MembersSection workspace={ws} me={me} role={role} />
      <SettingsSection key={ws.name + role} workspace={ws} me={me} role={role} />
    </div>
  );
}
