import { api } from "./client";
import type { Board, Card, Paginated } from "@/types";

export interface CardSearchParams {
  q?: string; workspace_id?: string; board_id?: string; assigned_to_me?: boolean;
  due_before?: string; due_after?: string; // must include timezone
  page?: number; page_size?: number;
}

export const searchApi = {
  cards: (params: CardSearchParams) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "" && v !== false) qs.set(k, String(v)); });
    return api<Paginated<Card>>(`cards/?${qs}`);
  },
  // Query params of GET /api/boards/ are not in the path list — verify in schema.
  boards: (q?: string) => api<Board[] | Paginated<Board>>(`boards/${q ? `?q=${encodeURIComponent(q)}` : ""}`),
};
