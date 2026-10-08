import { Link, Outlet, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { logout } from "@/api/client";
import { useAuthStore } from "@/store/auth";

export default function AppShell() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleLogout() {
    try { await logout(); } finally {
      queryClient.clear(); // drop private cached data
      setUser(null);
      navigate("/login");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-line bg-paperRaised px-6 py-3">
        <Link to="/workspaces" className="text-lg font-semibold tracking-tight">ناوابرد</Link>
        <div className="flex items-center gap-4 text-sm text-inkSoft">
          <span>{user?.full_name ?? user?.phone_number}</span>
          <button onClick={handleLogout} className="text-rose hover:underline">خروج</button>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-auto bg-paper"><Outlet /></main>
    </div>
  );
}
