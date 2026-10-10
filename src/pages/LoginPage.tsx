import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginWithEmail, requestOtp, verifyOtp } from "@/api/client";
import { profileApi } from "@/api/profile";
import { useAuthStore } from "@/store/auth";
import { describeError } from "@/lib/errors";

type Mode = "phone" | "otp" | "email" | "resetRequest" | "resetConfirm";

const TEXT: Record<Mode, string> = {
  phone: "شماره موبایل خود را وارد کنید.",
  otp: "کد ارسال‌شده را وارد کنید.",
  email: "با ایمیل و رمز عبور وارد شوید (برای حساب‌هایی که ایمیل تأییدشده و رمز دارند).",
  resetRequest: "شماره‌ی موبایل حساب را وارد کنید تا کد بازیابی رمز ارسال شود.",
  resetConfirm: "کد بازیابی و رمز جدید را وارد کنید.",
};

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("phone");
  const storeNotice = useAuthStore((s) => s.notice);
  const clearStoreNotice = useAuthStore((s) => s.setNotice);
  const [notice, setNotice] = useState<string | null>(storeNotice);
  useEffect(() => { if (storeNotice) clearStoreNotice(null); }, [storeNotice, clearStoreNotice]);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Dev only: the backend may return the code in the response when no SMS provider is configured.
  const [devCode, setDevCode] = useState<string | null>(null);
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();

  async function run(fn: () => Promise<void>) {
    setError(null); setNotice(null); setPending(true);
    try { await fn(); } catch (e) { setError(describeError(e)); } finally { setPending(false); }
  }

  const inputCls = "w-full rounded-chip border border-line px-3 py-2 text-left outline-none focus:border-teal";
  const btnCls = "w-full rounded-chip bg-ink py-2 text-sm font-medium text-white disabled:opacity-50";
  const linkCls = "w-full text-center text-sm text-inkSoft hover:underline";
  const switchTo = (m: Mode) => { setMode(m); setError(null); setCode(""); };
  const submit = (fn: () => Promise<void>) => (e: React.FormEvent) => { e.preventDefault(); run(fn); };
  const Err = () => (error ? <p className="text-sm text-rose">{error}</p> : null);

  return (
    <div className="flex min-h-full items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-card border border-line bg-paperRaised p-8 shadow-card">
        <h1 className="mb-1 text-xl font-semibold">ورود به ناوابرد</h1>
        <p className="mb-4 text-sm text-inkSoft">{TEXT[mode]}</p>
        {notice && <p className="mb-4 rounded-chip bg-teal-soft px-3 py-2 text-sm">{notice}</p>}

        {mode === "phone" && (
          <form className="space-y-4" onSubmit={submit(async () => {
            const res = await requestOtp(phone);
            setDevCode(import.meta.env.DEV ? res.code_otp_development ?? null : null);
            setMode("otp");
          })}>
            <input type="tel" inputMode="numeric" dir="ltr" placeholder="09121234567" value={phone} onChange={(e) => setPhone(e.target.value)} required className={inputCls} />
            <Err />
            <button type="submit" disabled={pending} className={btnCls}>{pending ? "در حال ارسال…" : "ارسال کد"}</button>
            <button type="button" onClick={() => switchTo("email")} className={linkCls}>ورود با ایمیل و رمز</button>
          </form>
        )}

        {mode === "otp" && (
          <form className="space-y-4" onSubmit={submit(async () => {
            const { user, userCreated } = await verifyOtp(phone, code);
            setUser(user);
            // First sign-in creates the account: let the user set a name right away.
            navigate(userCreated ? "/profile?welcome=1" : "/workspaces");
          })}>
            <input type="text" inputMode="numeric" dir="ltr" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} required className={inputCls + " tracking-widest"} />
            {devCode && (
              <button type="button" onClick={() => setCode(devCode)} className="w-full rounded-chip bg-amber-soft px-3 py-2 text-sm text-ink">
                حالت توسعه: کد {devCode} را وارد کن
              </button>
            )}
            <Err />
            <button type="submit" disabled={pending} className={btnCls}>{pending ? "در حال بررسی…" : "تأیید و ورود"}</button>
            <button type="button" onClick={() => switchTo("phone")} className={linkCls}>تغییر شماره</button>
          </form>
        )}

        {mode === "email" && (
          <form className="space-y-4" onSubmit={submit(async () => { setUser(await loginWithEmail(email, password)); navigate("/workspaces"); })}>
            <input type="email" dir="ltr" placeholder="user@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" className={inputCls} />
            <input type="password" dir="ltr" placeholder="رمز عبور" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className={inputCls} />
            <Err />
            <button type="submit" disabled={pending} className={btnCls}>{pending ? "در حال بررسی…" : "ورود"}</button>
            <button type="button" onClick={() => switchTo("resetRequest")} className={linkCls}>رمز عبور را فراموش کرده‌ام</button>
            <button type="button" onClick={() => switchTo("phone")} className={linkCls}>ورود با شماره موبایل</button>
          </form>
        )}

        {mode === "resetRequest" && (
          <form className="space-y-4" onSubmit={submit(async () => { await profileApi.requestPasswordReset(phone); setMode("resetConfirm"); })}>
            <input type="tel" inputMode="numeric" dir="ltr" placeholder="09121234567" value={phone} onChange={(e) => setPhone(e.target.value)} required className={inputCls} />
            <Err />
            <button type="submit" disabled={pending} className={btnCls}>{pending ? "در حال ارسال…" : "ارسال کد بازیابی"}</button>
            <button type="button" onClick={() => switchTo("email")} className={linkCls}>بازگشت</button>
          </form>
        )}

        {mode === "resetConfirm" && (
          <form className="space-y-4" onSubmit={submit(async () => {
            await profileApi.confirmPasswordReset(phone, code, password);
            setPassword("");
            setMode("email");
            setNotice("رمز عبور تغییر کرد؛ با رمز جدید وارد شوید.");
          })}>
            <input type="text" inputMode="numeric" dir="ltr" placeholder="کد بازیابی" value={code} onChange={(e) => setCode(e.target.value)} required className={inputCls + " tracking-widest"} />
            <input type="password" dir="ltr" placeholder="رمز جدید" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" className={inputCls} />
            <Err />
            <button type="submit" disabled={pending} className={btnCls}>{pending ? "در حال بررسی…" : "تغییر رمز"}</button>
            <button type="button" onClick={() => switchTo("resetRequest")} className={linkCls}>ارسال دوباره‌ی کد</button>
          </form>
        )}
      </div>
    </div>
  );
}
