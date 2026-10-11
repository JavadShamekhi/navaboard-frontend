import type { NotificationItem } from "@/types";
import { personLabel } from "./roles";

type Rec = Record<string, unknown>;

/** The notification carries its related activity; tolerate the fields living on the notification itself. */
export function activityOf(n: NotificationItem): Rec {
  return ((n.activity ?? n) as unknown) as Rec;
}

export function actorName(actor: unknown): string {
  if (!actor) return "؟";
  if (typeof actor === "string") return actor;
  const u = actor as { full_name?: string | null; phone_number?: string };
  return u.full_name || u.phone_number ? personLabel(u as Parameters<typeof personLabel>[0]) : "؟";
}

const OBJECTS: [RegExp, string][] = [
  [/checklist/i, "چک‌لیست"], [/comment/i, "کامنت"], [/attach/i, "فایل پیوست"], [/label/i, "برچسب"],
  [/card/i, "کارت"], [/list/i, "ستون"], [/board/i, "برد"], [/workspace/i, "فضای کاری"], [/member|assign/i, "عضو"],
];
// Order matters: "unassign"/"remove" must be tested before "assign"/"add".
const VERBS: [RegExp, string][] = [
  [/unassign/i, "مسئول حذف شد"], [/assign/i, "مسئول تعیین شد"], [/mov/i, "جابه‌جا شد"],
  [/delet|remov|archiv/i, "حذف شد"], [/creat|add|join|upload/i, "ایجاد یا اضافه شد"],
  [/updat|edit|renam|chang|complet/i, "ویرایش شد"], [/transfer/i, "منتقل شد"],
];

/** Best-effort Persian sentence from an action key such as "card.moved"; the raw key is always shown next to it. */
export function describeAction(action: string): string {
  const obj = OBJECTS.find(([re]) => re.test(action))?.[1];
  const verb = VERBS.find(([re]) => re.test(action))?.[1];
  if (!obj && !verb) return "رویداد";
  return [obj, verb].filter(Boolean).join(" ");
}

/** Where a notification can lead: the board id, if the activity carries one. */
export function boardIdOf(a: Rec): string | undefined {
  const v = a.board_id ?? (a.board as { id?: string } | undefined)?.id;
  return typeof v === "string" ? v : undefined;
}

export function formatWhen(iso: unknown) {
  const d = new Date(String(iso ?? ""));
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" });
}
