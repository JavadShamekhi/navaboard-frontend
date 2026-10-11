import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { boardsApi } from "@/api/boards";
import { useAuthStore } from "@/store/auth";
import { describeError } from "@/lib/errors";
import { BOARD_ROLE_LABEL, useMyBoardRole, useMyWorkspaceRole } from "@/lib/roles";
import { Section, Status, dangerBtnCls, useAction } from "@/components/ui";
import InfoSection from "@/components/board-settings/InfoSection";
import ListsSection from "@/components/board-settings/ListsSection";
import LabelsSection from "@/components/board-settings/LabelsSection";
import BoardMembersSection from "@/components/board-settings/BoardMembersSection";
import type { Board, User } from "@/types";

export default function BoardSettingsPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const me = useAuthStore((s) => s.user);
  const { data: board, isLoading, error } = useQuery({ queryKey: ["board", boardId], queryFn: () => boardsApi.get(boardId!), enabled: !!boardId });
  if (isLoading) return <div className="p-8 text-inkSoft">در حال بارگذاری…</div>;
  if (error || !board || !me) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <p className="text-rose">{describeError(error)}</p>
        <Link to="/workspaces" className="mt-3 inline-block text-sm text-teal hover:underline">بازگشت</Link>
      </div>
    );
  }
  return <Settings board={board} me={me} />;
}

function Settings({ board, me }: { board: Board; me: User }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { role: boardRole } = useMyBoardRole(board.id, me);
  const { role: wsRole } = useMyWorkspaceRole(board.workspace_id, me);
  // Board admins manage the board; the workspace owner manages all boards of the workspace (guide, section 9).
  const canManage = boardRole === "admin" || wsRole === "owner";
  const [name, setName] = useState("");
  const del = useAction();

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-6 py-10">
      <div>
        <Link to={`/boards/${board.id}`} className="text-sm text-inkSoft hover:underline">بازگشت به برد</Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-2xl font-semibold">تنظیمات «{board.name}»</h1>
          {boardRole && <span className="rounded-chip bg-teal-soft px-2 py-0.5 text-xs text-teal">{BOARD_ROLE_LABEL[boardRole]}</span>}
        </div>
      </div>
      <InfoSection board={board} canManage={canManage} />
      <ListsSection boardId={board.id} />
      <LabelsSection boardId={board.id} canManage={canManage} />
      <BoardMembersSection board={board} me={me} canManage={canManage} />
      {canManage && (
        <Section title="حذف برد" hint="ستون‌ها و کارت‌های این برد از دسترس خارج می‌شوند و بازیابی عمومی وجود ندارد." danger>
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`نام برد: ${board.name}`} className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-rose" />
            <button disabled={del.pending || name !== board.name} className={dangerBtnCls} onClick={() => del.run(async () => {
              await boardsApi.remove(board.id);
              qc.invalidateQueries({ queryKey: ["boards", board.workspace_id] });
              navigate(`/workspaces/${board.workspace_id}`, { replace: true });
            })}>حذف برد</button>
          </div>
          <Status error={del.error} ok={null} />
        </Section>
      )}
    </div>
  );
}
