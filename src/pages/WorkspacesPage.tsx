import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workspacesApi } from "@/api/workspaces";
import { boardsApi } from "@/api/boards";
import type { Workspace } from "@/types";
import { describeError } from "@/lib/errors";

function InlineCreate({ placeholder, onCreate }: { placeholder: string; onCreate: (name: string) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!open) return <button onClick={() => setOpen(true)} className="rounded-card border border-dashed border-line p-4 text-sm text-inkSoft hover:border-teal">+ {placeholder}</button>;
  return (
    <form className="rounded-card border border-line bg-paperRaised p-3" onSubmit={async (e) => {
      e.preventDefault();
      if (!name.trim()) return;
      try { await onCreate(name.trim()); setName(""); setOpen(false); setError(null); } catch (err) { setError(describeError(err)); }
    }}>
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} className="w-full rounded-chip border border-line px-2 py-1 text-sm outline-none focus:border-teal" />
      {error && <p className="mt-1 text-xs text-rose">{error}</p>}
      <div className="mt-2 flex gap-2 text-xs">
        <button type="submit" className="rounded-chip bg-ink px-3 py-1 text-white">ساخت</button>
        <button type="button" onClick={() => setOpen(false)} className="text-inkSoft">انصراف</button>
      </div>
    </form>
  );
}

export default function WorkspacesPage() {
  const queryClient = useQueryClient();
  const { data: workspaces, isLoading, error } = useQuery({ queryKey: ["workspaces"], queryFn: workspacesApi.list });
  const create = useMutation({ mutationFn: workspacesApi.create, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workspaces"] }) });

  if (isLoading) return <div className="p-8 text-inkSoft">در حال بارگذاری…</div>;
  if (error) return <div className="p-8 text-rose">{describeError(error)}</div>;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">فضاهای کاری</h1>
      <div className="space-y-8">
        {workspaces?.length === 0 && <p className="text-inkSoft">هنوز فضای کاری ندارید. اولین فضای کاری را بسازید.</p>}
        {workspaces?.map((ws) => <WorkspaceSection key={ws.id} workspace={ws} />)}
        <div className="max-w-xs"><InlineCreate placeholder="فضای کاری جدید" onCreate={(n) => create.mutateAsync(n)} /></div>
      </div>
    </div>
  );
}

function WorkspaceSection({ workspace }: { workspace: Workspace }) {
  const { data: boards } = useQuery({ queryKey: ["boards", workspace.id], queryFn: () => boardsApi.inWorkspace(workspace.id) });
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-sm font-medium text-inkSoft">{workspace.name}</h2>
        <Link to={`/workspaces/${workspace.id}`} className="ms-auto text-sm text-teal hover:underline">مدیریت اعضا و تنظیمات</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {boards?.length === 0 && <p className="col-span-full text-sm text-inkSoft">هنوز بردی نیست؛ از صفحه‌ی مدیریت یک برد بسازید.</p>}
        {boards?.map((b) => (
          <Link key={b.id} to={`/boards/${b.id}`} className="rounded-card border border-line bg-paperRaised p-4 shadow-card hover:border-teal">
            <p className="font-medium">{b.name}</p>
            <p className="mt-1 text-xs text-inkSoft">{b.visibility === "private" ? "خصوصی" : "قابل‌مشاهده برای فضای کاری"}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
