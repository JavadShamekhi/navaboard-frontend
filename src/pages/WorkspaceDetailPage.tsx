import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { workspacesApi } from "@/api/workspaces";
import { useAuthStore } from "@/store/auth";
import { describeError } from "@/lib/errors";
import { ROLE_LABEL } from "@/lib/roles";
import BoardsSection from "@/components/workspace/BoardsSection";
import MembersSection from "@/components/workspace/MembersSection";
import SettingsSection from "@/components/workspace/SettingsSection";

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

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-6 py-10">
      <div>
        <Link to="/workspaces" className="text-sm text-inkSoft hover:underline">فضاهای کاری</Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{ws.name}</h1>
          {ws.role_user_current && <span className="rounded-chip bg-teal-soft px-2 py-0.5 text-xs text-teal">{ROLE_LABEL[ws.role_user_current]}</span>}
        </div>
      </div>
      <BoardsSection workspaceId={ws.id} />
      <MembersSection workspace={ws} meId={me.id} />
      <SettingsSection key={ws.name + ws.role_user_current} workspace={ws} meId={me.id} />
    </div>
  );
}
