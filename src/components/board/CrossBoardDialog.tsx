import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { copyCardToBoard, loadLoss, PartialCopyError, type CopyReport } from "@/lib/crossBoard";
import { describeError } from "@/lib/errors";
import type { Board, Card } from "@/types";

export interface CrossMove { card: Card; srcBoard: Board; destBoard: Board; destListId: string; position: number; reason: string }

/** Shown only when the backend refused a direct move to another board. Nothing happens until the user confirms. */
export default function CrossBoardDialog({ info, onClose }: { info: CrossMove; onClose: (changed: boolean) => void }) {
  const { card, srcBoard, destBoard } = info;
  const { data: loss } = useQuery({ queryKey: ["card-loss", card.id], queryFn: () => loadLoss(card.id) });
  const [del, setDel] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<CopyReport | null>(null);

  async function run() {
    setError(null); setStep("شروع…");
    try {
      setReport(await copyCardToBoard({ card, srcBoardId: srcBoard.id, destBoardId: destBoard.id, destListId: info.destListId, position: info.position, deleteOriginal: del }, setStep));
    } catch (e) {
      const partial = e instanceof PartialCopyError;
      setError(partial ? `کپی در مرحله‌ی «${(e as PartialCopyError).step}» متوقف شد: ${describeError((e as PartialCopyError).cause)}. کارت کپی در برد مقصد ساخته شده ولی کارت اصلی دست‌نخورده است.` : describeError(e));
    } finally { setStep(null); }
  }

  const lost = loss ? [loss.comments && `${loss.comments} کامنت`, loss.attachments && `${loss.attachments} فایل پیوست`, loss.assignees && `${loss.assignees} مسئول`].filter(Boolean) : [];
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-6" onClick={() => !step && onClose(!!report || !!error)}>
      <div role="dialog" aria-label="جابه‌جایی بین بردها" onClick={(e) => e.stopPropagation()} className="mt-16 w-full max-w-lg space-y-3 rounded-card bg-paperRaised p-6 text-sm shadow-raised">
        <h2 className="text-base font-semibold">انتقال «{card.title}» به برد «{destBoard.name}»</h2>
        {report ? (
          <div className="space-y-2" data-testid="cross-report">
            <p className="text-teal">{report.originalDeleted ? "کارت منتقل شد (کپی ساخته و اصلی حذف شد)." : "کارت در برد مقصد کپی شد؛ کارت اصلی سر جایش مانده است."}</p>
            <p className="text-inkSoft">{report.checklists} چک‌لیست و {report.labelsCopied} برچسب کپی شد.{report.labelsSkipped.length > 0 && ` برچسب‌های بدون هم‌نام در برد مقصد: ${report.labelsSkipped.join("، ")}`}</p>
            <button onClick={() => onClose(true)} className="rounded-chip bg-ink px-4 py-2 text-white">بستن</button>
          </div>
        ) : (
          <>
            <p className="rounded-chip bg-amber-soft px-3 py-2" data-testid="cross-reason">جابه‌جایی مستقیم بین دو برد ممکن نیست: {info.reason}</p>
            <p>می‌توانید به‌جای جابه‌جایی، کارت را در برد مقصد <b>کپی</b> کنید.</p>
            <div>
              <p className="font-medium">کپی می‌شود</p>
              <p className="text-inkSoft">عنوان، توضیحات، موعد، چک‌لیست‌ها (با وضعیت تیک) و برچسب‌هایی که در برد مقصد هم‌نام دارند.</p>
            </div>
            <div>
              <p className="font-medium text-rose">کپی نمی‌شود</p>
              <p className="text-inkSoft" data-testid="cross-loss">{loss ? (lost.length ? `${lost.join("، ")}، و تاریخچه‌ی فعالیت` : "تاریخچه‌ی فعالیت") : "در حال بررسی…"}</p>
            </div>
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={del} onChange={(e) => setDel(e.target.checked)} disabled={!!step} className="mt-1" />
              <span>بعد از کپی، کارت اصلی حذف شود <span className="text-rose">(کامنت‌ها و فایل‌های آن برای همیشه از بین می‌روند)</span></span>
            </label>
            {error && <p className="text-rose" data-testid="cross-error">{error}</p>}
            <div className="flex items-center gap-3">
              <button disabled={!!step || !loss} onClick={run} className={`rounded-chip px-4 py-2 text-white disabled:opacity-50 ${del ? "bg-rose" : "bg-ink"}`}>{del ? "کپی و حذف کارت اصلی" : "کپی کارت"}</button>
              <button disabled={!!step} onClick={() => onClose(!!error)} className="text-inkSoft hover:underline">انصراف</button>
              {step && <span className="text-xs text-inkSoft" data-testid="cross-step">{step}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
