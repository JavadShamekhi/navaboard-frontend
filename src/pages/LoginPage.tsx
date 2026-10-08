import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { requestOtp, verifyOtp } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { describeError } from "@/lib/errors";

export default function LoginPage() {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();

  async function run(fn: () => Promise<void>) {
    setError(null); setPending(true);
    try { await fn(); } catch (e) { setError(describeError(e)); } finally { setPending(false); }
  }

  const inputCls = "w-full rounded-chip border border-line px-3 py-2 text-left outline-none focus:border-teal";
  const btnCls = "w-full rounded-chip bg-ink py-2 text-sm font-medium text-white disabled:opacity-50";

  return (
    <div className="flex min-h-full items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-card border border-line bg-paperRaised p-8 shadow-card">
        <h1 className="mb-1 text-xl font-semibold">ورود به ناوابرد</h1>
        <p className="mb-6 text-sm text-inkSoft">{step === "phone" ? "شماره موبایل خود را وارد کنید." : `کد ارسال‌شده به ${phone} را وارد کنید.`}</p>
        {step === "phone" ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(async () => { await requestOtp(phone); setStep("otp"); }); }}>
            <input type="tel" inputMode="numeric" dir="ltr" placeholder="09121234567" value={phone} onChange={(e) => setPhone(e.target.value)} required className={inputCls} />
            {error && <p className="text-sm text-rose">{error}</p>}
            <button type="submit" disabled={pending} className={btnCls}>{pending ? "در حال ارسال…" : "ارسال کد"}</button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(async () => { setUser(await verifyOtp(phone, code)); navigate("/workspaces"); }); }}>
            <input type="text" inputMode="numeric" dir="ltr" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} required className={inputCls + " tracking-widest"} />
            {error && <p className="text-sm text-rose">{error}</p>}
            <button type="submit" disabled={pending} className={btnCls}>{pending ? "در حال بررسی…" : "تأیید و ورود"}</button>
            <button type="button" onClick={() => { setStep("phone"); setError(null); setCode(""); }} className="w-full text-center text-sm text-inkSoft hover:underline">تغییر شماره</button>
          </form>
        )}
      </div>
    </div>
  );
}
