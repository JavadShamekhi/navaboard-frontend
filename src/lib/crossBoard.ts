import { boardsApi } from "@/api/boards";
import { cardsApi } from "@/api/cards";
import type { Card } from "@/types";

/**
 * The API says: "Destination must be on the same board" (card move endpoint). So a card cannot be moved to another board.
 * Keep this false; set it to true only if the backend is extended, and the UI will try a direct move first.
 */
export const CROSS_BOARD_MOVE_SUPPORTED = false;
export const CROSS_BOARD_REASON = "طبق مستندات API، ستون مقصد باید در همان برد کارت باشد.";

/** Things a copy cannot carry over (they belong to the original card and cannot be re-created by another user). */
export interface Loss { comments: number; attachments: number; assignees: number }

export async function loadLoss(cardId: string): Promise<Loss> {
  const [c, a, s] = await Promise.all([cardsApi.comments(cardId), cardsApi.attachments(cardId), cardsApi.assignees(cardId)]);
  return { comments: c.length, attachments: a.length, assignees: s.length };
}

export interface CopyReport { newCardId: string; checklists: number; labelsCopied: number; labelsSkipped: string[]; originalDeleted: boolean }

/** The copy failed half-way: the new card exists, the original is untouched. */
export class PartialCopyError extends Error {
  constructor(public newCardId: string, public step: string, public cause: unknown) { super(`copy failed at: ${step}`); }
}

const byPos = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

/**
 * Fallback for backends where the move endpoint only works inside one board (guide, section 8):
 * create the card in the destination board, copy what the API lets us copy, and only then (optionally) delete the original.
 * The original is deleted LAST, so any failure leaves it intact.
 */
export async function copyCardToBoard(
  o: { card: Card; srcBoardId: string; destBoardId: string; destListId: string; position: number; deleteOriginal: boolean },
  onStep: (s: string) => void = () => {}
): Promise<CopyReport> {
  const { card, srcBoardId, destBoardId, destListId, position, deleteOriginal } = o;
  onStep("ساخت کارت در برد مقصد…");
  const created = await boardsApi.createCard(destBoardId, destListId, card.title, card.description ?? undefined);
  let step = "";
  try {
    step = "موعد انجام";
    if (card.due_at) await boardsApi.updateCard(destBoardId, created.id, { due_at: card.due_at });
    step = "جایگاه کارت";
    await boardsApi.moveCard(destBoardId, created.id, destListId, position); // a move INSIDE the destination board is allowed

    step = "چک‌لیست‌ها"; onStep("کپی چک‌لیست‌ها…");
    const lists = [...(await cardsApi.checklists(card.id))].sort(byPos);
    for (const cl of lists) {
      const nl = await cardsApi.addChecklist(created.id, cl.title);
      for (const it of [...(cl.items ?? [])].sort(byPos)) {
        const ni = await cardsApi.addChecklistItem(nl.id, it.title);
        if (it.is_completed) await cardsApi.toggleChecklistItem(ni.id, true);
      }
    }

    step = "برچسب‌ها"; onStep("کپی برچسب‌ها…");
    // Labels belong to a board: only labels with the same name on the destination board can be attached.
    const [srcLabels, destLabels] = await Promise.all([cardsApi.labels(card.id), boardsApi.labels(destBoardId)]);
    const skipped: string[] = []; let copied = 0;
    for (const l of srcLabels) {
      const match = destLabels.find((d) => d.name.trim().toLowerCase() === l.name.trim().toLowerCase());
      if (match) { await cardsApi.attachLabel(created.id, match.id); copied++; } else skipped.push(l.name);
    }

    if (deleteOriginal) { step = "حذف کارت اصلی"; onStep("حذف کارت اصلی…"); await boardsApi.deleteCard(srcBoardId, card.id); }
    return { newCardId: created.id, checklists: lists.length, labelsCopied: copied, labelsSkipped: skipped, originalDeleted: deleteOriginal };
  } catch (e) {
    throw new PartialCopyError(created.id, step, e);
  }
}
