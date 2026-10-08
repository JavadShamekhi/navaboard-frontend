import { ApiError } from "@/api/client";

/** Turn any API error into a user-facing Persian message. Handles detail / array / field-map shapes. */
export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return err.retryAfter ? `تعداد تلاش‌ها زیاد است؛ ${err.retryAfter} ثانیه بعد دوباره امتحان کنید.` : "تعداد تلاش‌ها زیاد است؛ کمی بعد دوباره امتحان کنید.";
    if (err.status === 403) return "اجازه‌ی این کار را ندارید یا نشست CSRF نامعتبر است.";
    if (err.status >= 500) return "سرویس موقتاً در دسترس نیست.";
    const d = err.data;
    if (Array.isArray(d)) return d.join("، ");
    if (d && typeof d === "object") {
      if ("detail" in d) return String((d as { detail: string }).detail);
      return Object.values(d).flat().join("، ");
    }
    return err.message;
  }
  return "خطای شبکه؛ اتصال را بررسی کنید.";
}
