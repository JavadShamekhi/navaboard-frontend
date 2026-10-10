import { create } from "zustand";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  status: "checking" | "authenticated" | "guest";
  /** One-shot message shown on the login page (e.g. after a forced re-login). */
  notice: string | null;
  setNotice: (notice: string | null) => void;
  setUser: (user: User | null) => void;
  setStatus: (status: AuthState["status"]) => void;
}
// The access token lives in api/client.ts memory; this store only tracks who is logged in.
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "checking",
  notice: null,
  setNotice: (notice) => set({ notice }),
  setUser: (user) => set({ user, status: user ? "authenticated" : "guest" }),
  setStatus: (status) => set({ status }),
}));
