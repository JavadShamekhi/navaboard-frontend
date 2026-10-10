import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { clearSession } from "@/api/client";
import { useAuthStore } from "@/store/auth";

/** After password set/change the backend invalidates sessions: wipe local state and go to login. */
export function useEndSession() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const setNotice = useAuthStore((s) => s.setNotice);
  return (notice: string) => {
    clearSession();
    setNotice(notice); // kept in the store: the route guard also redirects to /login and would drop navigation state
    queryClient.clear();
    setUser(null);
    navigate("/login", { replace: true });
  };
}
