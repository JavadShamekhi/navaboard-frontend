import {useState, type ReactNode} from "react";
import {useSearchParams} from "react-router-dom";
import {profileApi} from "@/api/profile";
import {useAuthStore} from "@/store/auth";
import {useEndSession} from "@/lib/session";
import Avatar from "@/components/Avatar";
import {Status, btnCls, inputCls, ltrInput, useAction} from "@/components/ui";

/* ---------- آیکون‌ها ---------- */
const paths = {
	user: <>
		<circle cx="12" cy="8" r="4"/>
		<path d="M4 21a8 8 0 0 1 16 0"/>
	</>,
	phone: <path
			d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>,
	mail: <>
		<rect x="3" y="5" width="18" height="14" rx="2"/>
		<path d="m3 7 9 6 9-6"/>
	</>,
	lock: <>
		<rect x="4" y="11" width="16" height="10" rx="2"/>
		<path d="M8 11V7a4 4 0 0 1 8 0v4"/>
	</>,
	key: <>
		<circle cx="8" cy="15" r="4"/>
		<path d="m11 12 9-9m-3 3 3 3"/>
	</>,
	eye: <>
		<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/>
		<circle cx="12" cy="12" r="3"/>
	</>,
	eyeOff: <>
		<path d="M3 3l18 18"/>
		<path
				d="M10.6 6.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a10 10 0 0 0 4-.8"/>
	</>,
	check: <path d="m5 12 5 5 9-10"/>,
};

function Icon({name, size = 18}: { name: keyof typeof paths; size?: number }) {
	return (
			<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
			     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
				{paths[name]}
			</svg>
	);
}

/* ---------- اجزای مشترک ---------- */
function Card({icon, title, hint, children}: {
	icon: keyof typeof paths;
	title: string;
	hint?: ReactNode;
	children: ReactNode
}) {
	return (
			<section className="rounded-card border border-line bg-paperRaised p-5 shadow-card">
				<header className="mb-4 flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-chip bg-teal-soft text-teal">
          <Icon name={icon}/>
        </span>
					<div className="min-w-0">
						<h2 className="text-base font-semibold">{title}</h2>
						{hint && <p className="mt-0.5 text-sm leading-6 text-inkSoft">{hint}</p>}
					</div>
				</header>
				{children}
			</section>
	);
}

function Field({label, children}: { label: string; children: ReactNode }) {
	return (
			<label className="block space-y-1.5">
				<span className="text-xs font-medium text-inkSoft">{label}</span>
				{children}
			</label>
	);
}

function PasswordInput(props: {
	value: string;
	onChange: (v: string) => void;
	placeholder?: string;
	autoComplete: string;
}) {
	const [show, setShow] = useState(false);
	return (
			<div className="relative">
				<input
						type={show ? "text" : "password"}
						dir="ltr"
						autoComplete={props.autoComplete}
						value={props.value}
						onChange={(e) => props.onChange(e.target.value)}
						placeholder={props.placeholder}
						required
						className={ltrInput + " pr-10"}
				/>
				<button
						type="button"
						onClick={() => setShow((s) => !s)}
						aria-label={show ? "پنهان کردن رمز" : "نمایش رمز"}
						className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-inkSoft outline-none transition hover:bg-teal-soft hover:text-teal focus-visible:ring-2 focus-visible:ring-teal"
				>
					<Icon name={show ? "eyeOff" : "eye"} size={16}/>
				</button>
			</div>
	);
}

const rowCls = "flex flex-col gap-2 sm:flex-row sm:items-end";
const ghostBtn =
		"rounded-chip px-3 py-2 text-sm text-inkSoft outline-none transition hover:bg-teal-soft hover:text-teal focus-visible:ring-2 focus-visible:ring-teal";

function Verified({children}: { children: ReactNode }) {
	return (
			<span className="inline-flex items-center gap-1 rounded-chip bg-teal-soft px-2 py-0.5 text-xs text-teal">
      <Icon name="check" size={12}/>
				{children}
    </span>
	);
}

function RequireEmail({ok, children}: { ok: boolean; children: ReactNode }) {
	return (
			<fieldset
					disabled={!ok}
					className={`m-0 min-w-0 border-0 p-0 transition ${ok ? "" : "pointer-events-none select-none opacity-50"}`}
			>
				{children}
			</fieldset>
	);
}

function NeedEmailNotice() {
	return (
			<p className="mb-3 flex items-start gap-2 rounded-chip border border-line bg-paper px-3 py-2 text-sm text-inkSoft">
				<Icon name="mail" size={16}/>
				<span>
        برای تعیین یا تغییر رمز، ابتدا ایمیل خود را در تب «اطلاعات حساب» تأیید کنید.
      </span>
			</p>
	);
}

/* ---------- فرم‌ها ---------- */
function NameForm() {
	const user = useAuthStore((s) => s.user)!;
	const setUser = useAuthStore((s) => s.setUser);
	const [name, setName] = useState(user.full_name ?? "");
	const a = useAction();
	const unchanged = name.trim() === (user.full_name ?? "");
	return (
			<Card icon="user" title="نام" hint="این نام برای سایر اعضای برد نمایش داده می‌شود.">
				<form
						className={rowCls}
						onSubmit={(e) => {
							e.preventDefault();
							a.run(async () => setUser(await profileApi.update({full_name: name.trim()})), "ذخیره شد.");
						}}
				>
					<div className="flex-1">
						<Field label="نام و نام خانوادگی">
							<input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً علی رضایی"
							       className={inputCls}/>
						</Field>
					</div>
					<button disabled={a.pending || unchanged} className={btnCls + " sm:shrink-0 disabled:opacity-50"}>
						{a.pending ? "در حال ذخیره…" : "ذخیره"}
					</button>
				</form>
				<Status error={a.error} ok={a.ok}/>
			</Card>
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
			<Card
					icon="phone"
					title="شماره‌ی موبایل"
					hint={
						<>
							شماره‌ی فعلی: <span dir="ltr" className="font-medium text-ink">{user.phone_number}</span>
						</>
					}
			>
				{step === "phone" ? (
						<form
								className={rowCls}
								onSubmit={(e) => {
									e.preventDefault();
									a.run(async () => {
										await profileApi.requestPhoneChange(phone);
										setStep("code");
									});
								}}
						>
							<div className="flex-1">
								<Field label="شماره‌ی جدید">
									<input dir="ltr" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)}
									       placeholder="09121234567" required className={ltrInput}/>
								</Field>
							</div>
							<button disabled={a.pending} className={btnCls + " sm:shrink-0"}>ارسال کد</button>
						</form>
				) : (
						<form
								className="space-y-3"
								onSubmit={(e) => {
									e.preventDefault();
									a.run(async () => {
										await profileApi.confirmPhoneChange(phone, code);
										setUser(await profileApi.me()); // re-read: the server stores the normalized number
										setStep("phone");
										setPhone("");
										setCode("");
									}, "شماره تغییر کرد.");
								}}
						>
							<p className="rounded-chip bg-teal-soft px-3 py-2 text-sm">
								کد تأیید به <span dir="ltr" className="font-medium">{phone}</span> ارسال شد.
							</p>
							<div className={rowCls}>
								<div className="flex-1">
									<Field label="کد تأیید">
										<input dir="ltr" inputMode="numeric" autoFocus value={code}
										       onChange={(e) => setCode(e.target.value)} placeholder="••••••" required
										       className={ltrInput + " tracking-widest"}/>
									</Field>
								</div>
								<div className="flex gap-2">
									<button disabled={a.pending} className={btnCls}>تأیید</button>
									<button type="button" onClick={() => {
										setStep("phone");
										a.reset();
									}} className={ghostBtn}>انصراف
									</button>
								</div>
							</div>
						</form>
				)}
				<Status error={a.error} ok={a.ok}/>
			</Card>
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
			<Card
					icon="mail"
					title="ایمیل (اختیاری)"
					hint={
						user.email ? (
								<span className="inline-flex flex-wrap items-center gap-2">
            <span dir="ltr" className="font-medium text-ink">{user.email}</span>
            <Verified>تأییدشده</Verified>
          </span>
						) : (
								"برای ورود با ایمیل و رمز، ابتدا ایمیل را تأیید کنید."
						)
					}
			>
				{step === "email" ? (
						<form
								className={rowCls}
								onSubmit={(e) => {
									e.preventDefault();
									a.run(async () => {
										await profileApi.requestEmailVerification(email);
										setStep("code");
									});
								}}
						>
							<div className="flex-1">
								<Field label={user.email ? "ایمیل جدید" : "آدرس ایمیل"}>
									<input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)}
									       placeholder="user@example.com" required className={ltrInput}/>
								</Field>
							</div>
							<button disabled={a.pending} className={btnCls + " sm:shrink-0"}>ارسال کد</button>
						</form>
				) : (
						<form
								className="space-y-3"
								onSubmit={(e) => {
									e.preventDefault();
									a.run(async () => {
										await profileApi.confirmEmailVerification(email, code); // must be the same email as the request step
										setUser(await profileApi.me());
										setStep("email");
										setEmail("");
										setCode("");
									}, "ایمیل تأیید شد.");
								}}
						>
							<p className="rounded-chip bg-teal-soft px-3 py-2 text-sm">
								کد تأیید به <span dir="ltr" className="font-medium">{email}</span> ارسال شد.
							</p>
							<div className={rowCls}>
								<div className="flex-1">
									<Field label="کد تأیید">
										<input dir="ltr" inputMode="numeric" autoFocus value={code}
										       onChange={(e) => setCode(e.target.value)} placeholder="••••••" required
										       className={ltrInput + " tracking-widest"}/>
									</Field>
								</div>
								<div className="flex gap-2">
									<button disabled={a.pending} className={btnCls}>تأیید</button>
									<button type="button" onClick={() => {
										setStep("email");
										a.reset();
									}} className={ghostBtn}>انصراف
									</button>
								</div>
							</div>
						</form>
				)}
				<Status error={a.error} ok={a.ok}/>
			</Card>
	);
}

function SetPasswordForm() {
	const user = useAuthStore((s) => s.user)!;
	const hasEmail = !!user.email;
	const [password, setPassword] = useState("");
	const end = useEndSession();
	const a = useAction();
	return (
			<Card icon="key" title="تعیین رمز عبور" hint="برای اولین بار رمز بگذارید. بعد از ثبت، باید دوباره وارد شوید.">
				{!hasEmail && <NeedEmailNotice/>}
				<RequireEmail ok={hasEmail}>
					<form
							className={rowCls}
							onSubmit={(e) => {
								e.preventDefault();
								if (!hasEmail) return;
								a.run(async () => {
									await profileApi.setPassword(password);
									end("رمز عبور تعیین شد؛ دوباره وارد شوید.");
								});
							}}
					>
						<div className="flex-1">
							<Field label="رمز عبور جدید">
								<PasswordInput value={password} onChange={setPassword} autoComplete="new-password"
								               placeholder="حداقل ۸ کاراکتر"/>
							</Field>
						</div>
						<button disabled={a.pending} className={btnCls + " sm:shrink-0"}>ثبت رمز</button>
					</form>
				</RequireEmail>
				<Status error={a.error} ok={a.ok}/>
			</Card>
	);
}

function ChangePasswordForm() {
	const user = useAuthStore((s) => s.user)!;
	const hasEmail = !!user.email;
	const [current, setCurrent] = useState("");
	const [next, setNext] = useState("");
	const end = useEndSession();
	const a = useAction();
	return (
			<Card icon="lock" title="تغییر رمز عبور" hint="اگر قبلاً رمز گذاشته‌اید. بعد از تغییر، باید دوباره وارد شوید.">
				{!hasEmail && <NeedEmailNotice/>}
				<RequireEmail ok={hasEmail}>
					<form
							className="space-y-3"
							onSubmit={(e) => {
								e.preventDefault();
								if (!hasEmail) return;
								a.run(async () => {
									await profileApi.changePassword(current, next);
									end("رمز عبور تغییر کرد؛ دوباره وارد شوید.");
								});
							}}
					>
						<div className="grid gap-3 sm:grid-cols-2">
							<Field label="رمز فعلی">
								<PasswordInput value={current} onChange={setCurrent} autoComplete="current-password"/>
							</Field>
							<Field label="رمز جدید">
								<PasswordInput value={next} onChange={setNext} autoComplete="new-password"/>
							</Field>
						</div>
						<button disabled={a.pending} className={btnCls}>تغییر رمز</button>
					</form>
				</RequireEmail>
				<Status error={a.error} ok={a.ok}/>
			</Card>
	);
}

/* ---------- صفحه ---------- */
const TABS = [
	{id: "account", label: "اطلاعات حساب", icon: "user"},
	{id: "security", label: "امنیت", icon: "lock"},
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function ProfilePage() {
	const [params] = useSearchParams();
	const user = useAuthStore((s) => s.user);
	const hasEmail = !!user?.email;

	const [tab, setTab] = useState<TabId>(
			params.get("tab") === "security" && hasEmail ? "security" : "account",
	);
	const [welcome, setWelcome] = useState(!!params.get("welcome"));

	if (!user) return null;

	// اگر ایمیل وجود ندارد، هیچ‌وقت روی تب امنیت نمی‌ماند
	const activeTab: TabId = tab === "security" && !hasEmail ? "account" : tab;

	return (
			<div className="mx-auto max-w-2xl space-y-5 px-4 py-8 sm:px-6 sm:py-10">
				{/* هدر پروفایل */}
				<div className="overflow-hidden rounded-card border border-line bg-paperRaised shadow-card">
					<div className="h-20 bg-gradient-to-l from-teal-soft via-teal-soft/60 to-transparent"/>
					<div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end">
						<div className="-mt-10 w-fit rounded-full ring-4 ring-paperRaised">
							<Avatar user={user} size={80}/>
						</div>
						<div className="min-w-0 flex-1 space-y-1.5">
							<h1 className="truncate text-xl font-semibold">{user.full_name || "بدون نام"}</h1>
							<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-inkSoft">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="phone" size={14}/>
                <span dir="ltr">{user.phone_number}</span>
	              {user.is_phone_verified && <Verified>تأییدشده</Verified>}
              </span>
								<span className="inline-flex min-w-0 items-center gap-1.5">
                <Icon name="mail" size={14}/>
									{user.email ? <span dir="ltr" className="truncate">{user.email}</span> : "ایمیل ثبت نشده"}
              </span>
							</div>
						</div>
					</div>
				</div>

				{welcome && (
						<div className="flex items-start justify-between gap-3 rounded-card bg-teal-soft px-4 py-3 text-sm">
							<p>خوش آمدید! اگر می‌خواهید، نام خود را وارد کنید.</p>
							<button
									type="button"
									onClick={() => setWelcome(false)}
									aria-label="بستن"
									className="text-inkSoft transition hover:text-ink"
							>
								✕
							</button>
						</div>
				)}

				{/* تب‌ها */}
				<div role="tablist" className="grid grid-cols-2 gap-1 rounded-card border border-line bg-paperRaised p-1">
					{TABS.map((t) => {
						const locked = t.id === "security" && !hasEmail;
						const selected = activeTab === t.id;
						return (
								<button
										key={t.id}
										role="tab"
										type="button"
										disabled={locked}
										title={locked ? "ابتدا ایمیل خود را تأیید کنید" : undefined}
										aria-selected={selected}
										aria-disabled={locked}
										onClick={() => setTab(t.id)}
										className={`flex items-center justify-center gap-2 rounded-chip px-3 py-2 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-teal ${
												selected ? "bg-teal-soft text-teal" : "text-inkSoft hover:text-ink"
										} ${locked ? "cursor-not-allowed opacity-50 hover:text-inkSoft" : ""}`}
								>
									<Icon name={locked ? "lock" : t.icon} size={16}/>
									{t.label}
								</button>
						);
					})}
				</div>

				{!hasEmail && (
						<p className="flex items-start gap-2 rounded-chip border border-line bg-paperRaised px-3 py-2 text-sm text-inkSoft">
							<Icon name="mail" size={16}/>
							<span>تب «امنیت» (تعیین و تغییر رمز عبور) بعد از تأیید ایمیل فعال می‌شود.</span>
						</p>
				)}

				<div role="tabpanel" className="space-y-4">
					{activeTab === "account" ? (
							<>
								<NameForm/>
								<PhoneForm/>
								<EmailForm/>
							</>
					) : (
							<>
								<SetPasswordForm/>
								<ChangePasswordForm/>
							</>
					)}
				</div>
			</div>
	);
}