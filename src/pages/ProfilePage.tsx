import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { profileApi } from "@/api/profile";
import { useAuthStore } from "@/store/auth";
import { describeError } from "@/lib/errors";
import { useEndSession } from "@/lib/session";
import Avatar from "@/components/Avatar";

const inputCls = "w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-teal";
const ltrInput = inputCls + " text-left";
const btnCls = "shrink-0 whitespace-nowrap rounded-chip bg-ink px-4 py-2 text-sm text-white disabled:opacity-50";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-paperRaised p-5 shadow-card">
      <h2 className="font-medium">{title}</h2>
      {hint && <p className="mb-3 mt-1 text-sm text-inkSoft">{hint}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

/** Runs an async action with shared pending / error / success state. */
function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  async function run(fn: () => Promise<void>, success?: string) {
    setPending(true); setError(null); setOk(null);
    try { await fn(); if (success) setOk(success); } catch (e) { setError(describeError(e)); } finally { setPending(false); }
  }
  return { pending, error, ok, run, reset: () => { setError(null); setOk(null); } };
}

function Status({ error, ok }: { error: string | null; ok: string | null }) {
  if (error) return <p className="text-sm text-rose">{error}</p>;
  if (ok) return <p className="text-sm text-teal">{ok}</p>;
  return null;
}

function NameForm() {
  const user = useAuthStore((s) => s.user)!;
  const setUser = useAuthStore((s) => s.setUser);
  const [name, setName] = useState(user.full_name ?? "");
  const a = useAction();
  return (
    <Section title="نام">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); a.run(async () => setUser(await profileApi.update({ full_name: name.trim() })), "ذخیره شد."); }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام و نام خانوادگی" className={inputCls} />
        <button disabled={a.pending} className={btnCls}>ذخیره</button>
      </form>
      <Status error={a.error} ok={a.ok} />
    </Section>
  );
}

function PhoneForm() {
  const user = useAuthStore((s) => s.user)!;
  const setUser = useAuthStore((s) => s.setUser);
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const a = useAction();
  return (
    <Section title="تغییر شماره‌ی موبایل" hint="کد تأیید به شماره‌ی جدید ارسال می‌شود.">
      {step === "phone" ? (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); a.run(async () => { await profileApi.requestPhoneChange(phone); setStep("code"); }); }}>
          <input dir="ltr" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09121234567" required className={ltrInput} />
          <button disabled={a.pending} className={btnCls}>ارسال کد</button>
        </form>
      ) : (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); a.run(async () => {
          await profileApi.confirmPhoneChange(phone, code);
          setUser(await profileApi.me()); // re-read: the server stores the normalized number
          setStep("phone"); setPhone(""); setCode("");
        }, "شماره تغییر کرد."); }}>
          <input dir="ltr" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="کد تأیید" required className={ltrInput + " tracking-widest"} />
          <button disabled={a.pending} className={btnCls}>تأیید</button>
          <button type="button" onClick={() => { setStep("phone"); a.reset(); }} className="text-sm text-inkSoft">انصراف</button>
        </form>
      )}
      <Status error={a.error} ok={a.ok} />
    </Section>
  );
}

function EmailForm() {
  const user = useAuthStore((s) => s.user)!;
  const setUser = useAuthStore((s) => s.setUser);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const a = useAction();
  return (
    <Section title="ایمیل (اختیاری)" hint={user.email ? `ایمیل تأییدشده: ${user.email}` : "برای ورود با ایمیل و رمز، ابتدا ایمیل را تأیید کنید."}>
      {step === "email" ? (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); a.run(async () => { await profileApi.requestEmailVerification(email); setStep("code"); }); }}>
          <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" required className={ltrInput} />
          <button disabled={a.pending} className={btnCls}>ارسال کد</button>
        </form>
      ) : (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); a.run(async () => {
          await profileApi.confirmEmailVerification(email, code); // must be the same email as the request step
          setUser(await profileApi.me());
          setStep("email"); setEmail(""); setCode("");
        }, "ایمیل تأیید شد."); }}>
          <input dir="ltr" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="کد تأیید" required className={ltrInput + " tracking-widest"} />
          <button disabled={a.pending} className={btnCls}>تأیید</button>
          <button type="button" onClick={() => { setStep("email"); a.reset(); }} className="text-sm text-inkSoft">انصراف</button>
        </form>
      )}
      <Status error={a.error} ok={a.ok} />
    </Section>
  );
}

function SetPasswordForm() {
  const [password, setPassword] = useState("");
  const end = useEndSession();
  const a = useAction();
  return (
    <Section title="تعیین رمز عبور" hint="برای اولین بار رمز بگذارید (بعد از تأیید ایمیل). بعد از ثبت، باید دوباره وارد شوید.">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); a.run(async () => { await profileApi.setPassword(password); end("رمز عبور تعیین شد؛ دوباره وارد شوید."); }); }}>
        <input type="password" dir="ltr" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="رمز عبور جدید" required className={ltrInput} />
        <button disabled={a.pending} className={btnCls}>ثبت</button>
      </form>
      <Status error={a.error} ok={a.ok} />
    </Section>
  );
}

function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const end = useEndSession();
  const a = useAction();
  return (
    <Section title="تغییر رمز عبور" hint="اگر قبلاً رمز گذاشته‌اید. بعد از تغییر، باید دوباره وارد شوید.">
      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); a.run(async () => { await profileApi.changePassword(current, next); end("رمز عبور تغییر کرد؛ دوباره وارد شوید."); }); }}>
        <input type="password" dir="ltr" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="رمز فعلی" required className={ltrInput} />
        <input type="password" dir="ltr" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="رمز جدید" required className={ltrInput} />
        <button disabled={a.pending} className={btnCls}>تغییر رمز</button>
      </form>
      <Status error={a.error} ok={a.ok} />
    </Section>
  );
}

export default function ProfilePage() {
  const [params] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  return (
    <div className="mx-auto max-w-xl space-y-5 px-6 py-10">
      <h1 className="text-2xl font-semibold">پروفایل</h1>
      <div className="flex items-center gap-4 rounded-card border border-line bg-paperRaised p-5 shadow-card">
        <Avatar user={user} size={56} />
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-lg font-medium">{user.full_name || "بدون نام"}</p>
          <p className="text-sm text-inkSoft">
            <span dir="ltr">{user.phone_number}</span>
            {user.is_phone_verified && <span className="ms-2 rounded-chip bg-teal-soft px-2 py-0.5 text-xs text-teal">تأییدشده</span>}
          </p>
          <p className="truncate text-sm text-inkSoft">{user.email ? <span dir="ltr">{user.email}</span> : "ایمیل ثبت نشده"}</p>
        </div>
      </div>
      {params.get("welcome") && <p className="rounded-chip bg-teal-soft px-3 py-2 text-sm">خوش آمدید! اگر می‌خواهید، نام خود را وارد کنید.</p>}
      <NameForm />
      <PhoneForm />
      <EmailForm />
      <SetPasswordForm />
      <ChangePasswordForm />
    </div>
  );
}
