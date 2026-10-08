import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { restoreSession } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import AppShell from "@/components/AppShell";
import LoginPage from "@/pages/LoginPage";
import WorkspacesPage from "@/pages/WorkspacesPage";
import BoardPage from "@/pages/BoardPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  if (status === "checking") return <div className="flex h-screen items-center justify-center text-inkSoft">در حال بررسی نشست…</div>;
  if (status === "guest") return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const setUser = useAuthStore((s) => s.setUser);
  const setStatus = useAuthStore((s) => s.setStatus);

  useEffect(() => {
    restoreSession().then(setUser).catch(() => setStatus("guest"));
  }, [setUser, setStatus]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/" element={<Navigate to="/workspaces" replace />} />
          <Route path="/workspaces" element={<WorkspacesPage />} />
          <Route path="/boards/:boardId" element={<BoardPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
