import { useState } from "react";
import { describeError } from "@/lib/errors";

export const inputCls = "w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-teal";
export const ltrInput = inputCls + " text-left";
export const btnCls = "shrink-0 whitespace-nowrap rounded-chip bg-ink px-4 py-2 text-sm text-white disabled:opacity-50";
export const dangerBtnCls = "shrink-0 whitespace-nowrap rounded-chip bg-rose px-4 py-2 text-sm text-white disabled:opacity-50";

export function Section({ title, hint, danger, children }: { title: string; hint?: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <section className={`rounded-card border bg-paperRaised p-5 shadow-card ${danger ? "border-rose/40" : "border-line"}`}>
      <h2 className={`font-medium ${danger ? "text-rose" : ""}`}>{title}</h2>
      {hint && <p className="mb-3 mt-1 text-sm text-inkSoft">{hint}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

/** Runs an async action with shared pending / error / success state. */
export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  async function run(fn: () => Promise<void>, success?: string) {
    setPending(true); setError(null); setOk(null);
    try { await fn(); if (success) setOk(success); } catch (e) { setError(describeError(e)); } finally { setPending(false); }
  }
  return { pending, error, ok, run, reset: () => { setError(null); setOk(null); } };
}

export function Status({ error, ok }: { error: string | null; ok: string | null }) {
  if (error) return <p className="text-sm text-rose">{error}</p>;
  if (ok) return <p className="text-sm text-teal">{ok}</p>;
  return null;
}
