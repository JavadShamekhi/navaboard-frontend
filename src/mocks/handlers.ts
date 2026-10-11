import { http, HttpResponse } from "msw";
import { boardWithLists, currentUser, db, directory, moveCard, nextId, normalizePhone } from "./db";

const DEV_OTP = "123456";
let mockPassword = "dev12345"; // mock account password
let lastOtpPhone: string | null = null;
const now = () => new Date().toISOString();
const notFound = () => HttpResponse.json({ detail: "یافت نشد" }, { status: 404 });
const empty = () => new HttpResponse(null, { status: 204 });
// The real API returns no role field: permissions follow the caller membership.
const myRole = (wsId: string) => db.workspaceMembers[wsId]?.find((m) => m.user.id === currentUser.id)?.role;
const boardRole = (boardId: string) => db.boardMembers[boardId]?.find((m) => m.user.id === currentUser.id)?.role;
/** Board admin, or the owner of the workspace the board lives in. */
const canManageBoard = (boardId: string) => {
  const b = db.boards.find((x) => x.id === boardId);
  return boardRole(boardId) === "admin" || (!!b && myRole(b.workspace_id) === "owner");
};
const boardOfCard = (cardId: string) => db.lists.find((l) => l.id === db.cards.find((c) => c.id === cardId)?.list_id)?.board_id;
const canManageCard = (cardId: string) => { const b = boardOfCard(cardId); return !!b && canManageBoard(b); };
const scopeOfBoard = (boardId: string) => ({ board_id: boardId, workspace_id: db.boards.find((b) => b.id === boardId)?.workspace_id });
/** Newest first; every successful mutation by the current user leaves an event (like the real activity log). */
const logActivity = (action: string, resource_id: string, scope: { workspace_id?: string; board_id?: string; card_id?: string }) => {
  db.activity.unshift({ id: nextId(), actor: currentUser, action, resource_id, created_at: now(), ...scope });
};
/** The real feeds are paginated: { count, next, previous, results }, default 30 per page, max 100. */
const paginate = <T,>(rows: T[], url: URL) => {
  const size = Math.min(Number(url.searchParams.get("page_size")) || 30, 100);
  const page = Math.max(Number(url.searchParams.get("page")) || 1, 1);
  const link = (p: number) => { const u = new URL(url); u.searchParams.set("page", String(p)); return u.toString(); };
  return { count: rows.length, next: page * size < rows.length ? link(page + 1) : null, previous: page > 1 ? link(page - 1) : null, results: rows.slice((page - 1) * size, page * size) };
};
// Test helper (dev only): simulate somebody else doing something that notifies the current user.
if (typeof window !== "undefined") {
  (window as unknown as { __mockNotify: () => void }).__mockNotify = () => {
    const activity = { id: nextId(), actor: directory[1], action: "card.commented", resource_id: "card-2", board_id: "board-1", created_at: now() };
    db.notifications.unshift({ id: nextId(), read_at: null, created_at: now(), activity });
  };
}
const forbidden = () => HttpResponse.json({ detail: "شما اجازه‌ی این کار را ندارید." }, { status: 403 });

export const handlers = [
  // auth
  http.get("/api/auth/csrf/", () => HttpResponse.json({ csrfToken: "dev-csrf-token" })),
  http.post("/api/auth/otp/request/", async ({ request }) => {
    const { phone_number } = (await request.json()) as { phone_number: string };
    lastOtpPhone = phone_number;
    return HttpResponse.json({ at_expires: new Date(Date.now() + 120_000).toISOString(), code_otp_development: DEV_OTP }, { status: 201 });
  }),
  http.post("/api/auth/otp/verify/", async ({ request }) => {
    const { phone_number, code } = (await request.json()) as { phone_number: string; code: string };
    if (phone_number !== lastOtpPhone || code !== DEV_OTP) return HttpResponse.json({ detail: "کد واردشده نادرست یا منقضی است." }, { status: 400 });
    localStorage.setItem("mock-refresh-cookie", "1"); // stands in for the HttpOnly refresh cookie (mock only)
    return HttpResponse.json({ access: "mock-access-token", token_type: "Bearer", user_created: false, user: currentUser });
  }),
  // Mock email login: dev@navaboard.test / dev12345
  http.post("/api/auth/email/login/", async ({ request }) => {
    const { email, password } = (await request.json()) as { email: string; password: string };
    if (email !== (currentUser.email || "dev@navaboard.test") || password !== mockPassword)
      return HttpResponse.json({ detail: "ایمیل یا رمز عبور نادرست است." }, { status: 400 });
    localStorage.setItem("mock-refresh-cookie", "1");
    return HttpResponse.json({ access: "mock-access-token", token_type: "Bearer", user_created: false, user: currentUser });
  }),
  // profile: phone change, email verification, passwords (code is always 123456 in the mock)
  http.post("/api/auth/phone/change/request/", () => HttpResponse.json({ at_expires: new Date(Date.now() + 120_000).toISOString() }, { status: 201 })),
  http.post("/api/auth/phone/change/confirm/", async ({ request }) => {
    const { phone_number, code } = (await request.json()) as { phone_number: string; code: string };
    if (code !== DEV_OTP) return HttpResponse.json({ detail: "کد نادرست یا منقضی است." }, { status: 400 });
    currentUser.phone_number = phone_number.startsWith("0") ? "+98" + phone_number.slice(1) : phone_number;
    return HttpResponse.json(currentUser);
  }),
  http.post("/api/auth/email/verification/request/", () => HttpResponse.json({ at_expires: new Date(Date.now() + 120_000).toISOString() }, { status: 201 })),
  http.post("/api/auth/email/verification/confirm/", async ({ request }) => {
    const { email, code } = (await request.json()) as { email: string; code: string };
    if (code !== DEV_OTP) return HttpResponse.json({ detail: "کد نادرست یا منقضی است." }, { status: 400 });
    currentUser.email = email;
    return HttpResponse.json(currentUser);
  }),
  http.post("/api/auth/password/set/", async ({ request }) => {
    mockPassword = ((await request.json()) as { password: string }).password;
    localStorage.removeItem("mock-refresh-cookie"); // server invalidates sessions
    return empty();
  }),
  http.post("/api/auth/password/change/", async ({ request }) => {
    const { current_password, new_password } = (await request.json()) as { current_password: string; new_password: string };
    if (current_password !== mockPassword) return HttpResponse.json({ current_password: ["رمز فعلی نادرست است."] }, { status: 400 });
    mockPassword = new_password;
    localStorage.removeItem("mock-refresh-cookie");
    return empty();
  }),
  http.post("/api/auth/password/reset/request/", () => HttpResponse.json({ at_expires: new Date(Date.now() + 120_000).toISOString() }, { status: 201 })),
  http.post("/api/auth/password/reset/confirm/", async ({ request }) => {
    const { code, new_password } = (await request.json()) as { code: string; new_password: string };
    if (code !== DEV_OTP) return HttpResponse.json({ detail: "کد نادرست یا منقضی است." }, { status: 400 });
    mockPassword = new_password;
    return empty();
  }),
  http.post("/api/auth/token/refresh/", () =>
    localStorage.getItem("mock-refresh-cookie")
      ? HttpResponse.json({ access: "mock-access-token" })
      : HttpResponse.json({ detail: "Authentication credentials were not provided." }, { status: 401 })
  ),
  http.post("/api/auth/logout/", () => { localStorage.removeItem("mock-refresh-cookie"); return empty(); }),
  http.get("/api/auth/me/", () => HttpResponse.json(currentUser)),
  http.patch("/api/auth/me/", async ({ request }) => {
    Object.assign(currentUser, await request.json());
    return HttpResponse.json(currentUser);
  }),

  // workspaces
  http.get("/api/workspaces/", () => HttpResponse.json(db.workspaces)),
  http.post("/api/workspaces/", async ({ request }) => {
    const { name } = (await request.json()) as { name: string };
    const ws = { id: nextId(), name, created_at: now() };
    db.workspaces.push(ws);
    db.workspaceMembers[ws.id] = [{ id: nextId(), user: currentUser, role: "owner" }];
    return HttpResponse.json(ws, { status: 201 });
  }),
  http.get("/api/workspaces/:id/", ({ params }) => {
    const ws = db.workspaces.find((w) => w.id === params.id);
    return ws ? HttpResponse.json(ws) : notFound();
  }),
  http.patch("/api/workspaces/:id/", async ({ params, request }) => {
    const ws = db.workspaces.find((w) => w.id === params.id);
    if (!ws) return notFound();
    if (myRole(ws.id) === "member") return forbidden();
    Object.assign(ws, await request.json());
    return HttpResponse.json(ws);
  }),
  http.delete("/api/workspaces/:id/", ({ params }) => {
    const ws = db.workspaces.find((w) => w.id === params.id);
    if (!ws) return notFound();
    if (myRole(ws.id) !== "owner") return forbidden();
    db.workspaces.splice(db.workspaces.indexOf(ws), 1);
    db.boards = db.boards.filter((b) => b.workspace_id !== ws.id);
    delete db.workspaceMembers[ws.id];
    return empty();
  }),
  http.get("/api/workspaces/:id/members/", ({ params }) => HttpResponse.json(db.workspaceMembers[params.id as string] ?? [])),
  http.post("/api/workspaces/:id/members/", async ({ params, request }) => {
    const ws = db.workspaces.find((w) => w.id === params.id);
    if (!ws) return notFound();
    if (myRole(ws.id) === "member") return forbidden();
    const { phone_number, role } = (await request.json()) as { phone_number: string; role: "admin" | "member" };
    const user = directory.find((u) => normalizePhone(u.phone_number) === normalizePhone(phone_number));
    if (!user) return HttpResponse.json({ phone_number: ["کاربری با این شماره در نوابرد حساب ندارد."] }, { status: 400 });
    const list = (db.workspaceMembers[ws.id] ??= []);
    if (list.some((m) => m.user.id === user.id)) return HttpResponse.json({ detail: "این کاربر قبلاً عضو است." }, { status: 400 });
    const m = { id: nextId(), user, role };
    list.push(m);
    return HttpResponse.json(m, { status: 201 });
  }),
  http.patch("/api/workspaces/:id/members/:mid/", async ({ params, request }) => {
    const ws = db.workspaces.find((w) => w.id === params.id);
    if (myRole(params.id as string) !== "owner") return forbidden(); // only the owner changes roles
    const m = db.workspaceMembers[params.id as string]?.find((x) => x.id === params.mid);
    if (!m) return notFound();
    const { role } = (await request.json()) as { role: "admin" | "member" };
    if (m.role === "owner") return HttpResponse.json({ detail: "نقش مالک فقط با انتقال مالکیت تغییر می‌کند." }, { status: 400 });
    m.role = role;
    return HttpResponse.json(m);
  }),
  http.delete("/api/workspaces/:id/members/:mid/", ({ params }) => {
    const list = db.workspaceMembers[params.id as string] ?? [];
    const m = list.find((x) => x.id === params.mid);
    if (!m) return notFound();
    if (m.role === "owner") return HttpResponse.json({ detail: "مالک باید قبل از خروج، مالکیت را منتقل کند." }, { status: 400 });
    list.splice(list.indexOf(m), 1);
    return empty();
  }),
  http.post("/api/workspaces/:id/transfer-ownership/", async ({ params, request }) => {
    const ws = db.workspaces.find((w) => w.id === params.id);
    if (!ws || myRole(ws.id) !== "owner") return forbidden();
    const { new_owner_phone_number } = (await request.json()) as { new_owner_phone_number: string };
    const list = db.workspaceMembers[ws.id] ?? [];
    const target = list.find((m) => normalizePhone(m.user.phone_number) === normalizePhone(new_owner_phone_number));
    if (!target) return HttpResponse.json({ new_owner_phone_number: ["مالک جدید باید عضو این فضای کاری باشد."] }, { status: 400 });
    list.forEach((m) => { if (m.role === "owner") m.role = "admin"; });
    target.role = "owner";
    return empty();
  }),
  http.get("/api/workspaces/:id/boards/", ({ params }) => HttpResponse.json(db.boards.filter((b) => b.workspace_id === params.id))),
  http.post("/api/workspaces/:id/boards/", async ({ params, request }) => {
    const body = (await request.json()) as { name: string; visibility: "private" | "workspace" };
    const board = { id: nextId(), workspace_id: params.id as string, name: body.name, visibility: body.visibility, created_at: now() };
    db.boards.push(board);
    db.boardMembers[board.id] = [{ id: nextId(), user: currentUser, role: "admin" }];
    logActivity("board.created", board.id, { workspace_id: board.workspace_id, board_id: board.id });
    return HttpResponse.json(board, { status: 201 });
  }),

  // boards / lists / cards
  http.get("/api/boards/:id/", ({ params }) => {
    const board = boardWithLists(params.id as string);
    if (!board) return notFound();
    if (localStorage.getItem("mock-flat-board")) { const { lists: _omit, ...flat } = board; return HttpResponse.json(flat); } // detail without nested lists/cards
    return HttpResponse.json(board);
  }),
  http.patch("/api/boards/:id/", async ({ params, request }) => {
    const board = db.boards.find((b) => b.id === params.id);
    if (!board) return notFound();
    if (!canManageBoard(board.id)) return forbidden();
    Object.assign(board, await request.json());
    return HttpResponse.json(board);
  }),
  http.delete("/api/boards/:id/", ({ params }) => {
    const board = db.boards.find((b) => b.id === params.id);
    if (!board) return notFound();
    if (!canManageBoard(board.id)) return forbidden();
    const listIds = db.lists.filter((l) => l.board_id === board.id).map((l) => l.id);
    db.cards = db.cards.filter((c) => !listIds.includes(c.list_id));
    db.lists = db.lists.filter((l) => l.board_id !== board.id);
    db.boards.splice(db.boards.indexOf(board), 1);
    delete db.boardMembers[board.id];
    return empty();
  }),
  http.get("/api/boards/:id/lists/", ({ params }) =>
    HttpResponse.json(db.lists.filter((l) => l.board_id === params.id).sort((a, b) => a.position - b.position))),
  http.patch("/api/boards/:id/lists/:listId/", async ({ params, request }) => {
    const list = db.lists.find((l) => l.id === params.listId);
    if (!list) return notFound();
    Object.assign(list, await request.json());
    return HttpResponse.json(list);
  }),
  http.delete("/api/boards/:id/lists/:listId/", ({ params }) => {
    const list = db.lists.find((l) => l.id === params.listId);
    if (!list) return notFound();
    db.cards = db.cards.filter((c) => c.list_id !== list.id);
    db.lists.splice(db.lists.indexOf(list), 1);
    db.lists.filter((l) => l.board_id === params.id).sort((a, b) => a.position - b.position).forEach((l, i) => (l.position = i));
    return empty();
  }),
  http.get("/api/boards/:id/lists/:listId/cards/", ({ params }) =>
    HttpResponse.json(db.cards.filter((c) => c.list_id === params.listId).sort((a, b) => a.position - b.position))),

  // board members (only members of the board's workspace can be added)
  http.get("/api/boards/:id/members/", ({ params }) => HttpResponse.json(db.boardMembers[params.id as string] ?? [])),
  http.post("/api/boards/:id/members/", async ({ params, request }) => {
    const board = db.boards.find((b) => b.id === params.id);
    if (!board) return notFound();
    if (!canManageBoard(board.id)) return forbidden();
    const { phone_number, role } = (await request.json()) as { phone_number: string; role: "admin" | "member" };
    const user = directory.find((u) => normalizePhone(u.phone_number) === normalizePhone(phone_number));
    if (!user) return HttpResponse.json({ phone_number: ["کاربری با این شماره در نوابرد حساب ندارد."] }, { status: 400 });
    if (!db.workspaceMembers[board.workspace_id]?.some((m) => m.user.id === user.id))
      return HttpResponse.json({ phone_number: ["این کاربر باید ابتدا عضو فضای کاری باشد."] }, { status: 400 });
    const list = (db.boardMembers[board.id] ??= []);
    if (list.some((m) => m.user.id === user.id)) return HttpResponse.json({ detail: "این کاربر قبلاً عضو برد است." }, { status: 400 });
    const m = { id: nextId(), user, role };
    list.push(m);
    return HttpResponse.json(m, { status: 201 });
  }),
  http.patch("/api/boards/:id/members/:mid/", async ({ params, request }) => {
    if (!canManageBoard(params.id as string)) return forbidden();
    const list = db.boardMembers[params.id as string] ?? [];
    const m = list.find((x) => x.id === params.mid);
    if (!m) return notFound();
    const { role } = (await request.json()) as { role: "admin" | "member" };
    if (m.role === "admin" && role !== "admin" && list.filter((x) => x.role === "admin").length <= 1)
      return HttpResponse.json({ detail: "برد باید حداقل یک مدیر داشته باشد." }, { status: 400 });
    m.role = role;
    return HttpResponse.json(m);
  }),
  http.delete("/api/boards/:id/members/:mid/", ({ params }) => {
    if (!canManageBoard(params.id as string)) return forbidden();
    const list = db.boardMembers[params.id as string] ?? [];
    const m = list.find((x) => x.id === params.mid);
    if (!m) return notFound();
    if (m.role === "admin" && list.filter((x) => x.role === "admin").length <= 1)
      return HttpResponse.json({ detail: "برد باید حداقل یک مدیر داشته باشد." }, { status: 400 });
    list.splice(list.indexOf(m), 1);
    return empty();
  }),

  // board labels
  http.post("/api/boards/:id/labels/", async ({ params, request }) => {
    if (!canManageBoard(params.id as string)) return forbidden();
    const { name, color } = (await request.json()) as { name: string; color: string };
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return HttpResponse.json({ color: ["رنگ باید به شکل #RRGGBB باشد."] }, { status: 400 });
    const label = { id: nextId(), board_id: params.id as string, name, color };
    db.labels.push(label);
    return HttpResponse.json(label, { status: 201 });
  }),
  http.patch("/api/boards/:id/labels/:labelId/", async ({ params, request }) => {
    if (!canManageBoard(params.id as string)) return forbidden();
    const label = db.labels.find((l) => l.id === params.labelId);
    if (!label) return notFound();
    Object.assign(label, await request.json());
    return HttpResponse.json(label);
  }),
  http.delete("/api/boards/:id/labels/:labelId/", ({ params }) => {
    if (!canManageBoard(params.id as string)) return forbidden();
    const i = db.labels.findIndex((l) => l.id === params.labelId);
    if (i < 0) return notFound();
    db.labels.splice(i, 1);
    return empty();
  }),

  http.post("/api/boards/:id/lists/", async ({ params, request }) => {
    const { title } = (await request.json()) as { title: string };
    const list = { id: nextId(), board_id: params.id as string, title, position: db.lists.filter((l) => l.board_id === params.id).length };
    db.lists.push(list);
    return HttpResponse.json(list, { status: 201 });
  }),
  http.post("/api/boards/:id/lists/:listId/move/", async ({ params, request }) => {
    const { position } = (await request.json()) as { position: number };
    const siblings = db.lists.filter((l) => l.board_id === params.id).sort((a, b) => a.position - b.position);
    const list = siblings.find((l) => l.id === params.listId);
    if (!list) return notFound();
    siblings.splice(siblings.indexOf(list), 1);
    siblings.splice(position, 0, list);
    siblings.forEach((l, i) => (l.position = i));
    return empty();
  }),
  http.post("/api/boards/:id/lists/:listId/cards/", async ({ params, request }) => {
    const body = (await request.json()) as { title: string; description?: string };
    const card = {
      id: nextId(), list_id: params.listId as string, title: body.title, description: body.description ?? null,
      position: db.cards.filter((c) => c.list_id === params.listId).length, due_at: null, creator: currentUser,
      created_at: now(), updated_at: now(), labels: [], assignees: [], checklists: [],
    };
    db.cards.push(card);
    logActivity("card.created", card.id, { ...scopeOfBoard(params.id as string), card_id: card.id });
    return HttpResponse.json(card, { status: 201 });
  }),
  http.get("/api/boards/:id/cards/:cardId/", ({ params }) => {
    const card = db.cards.find((c) => c.id === params.cardId);
    return card ? HttpResponse.json(card) : notFound();
  }),
  http.patch("/api/boards/:id/cards/:cardId/", async ({ params, request }) => {
    const card = db.cards.find((c) => c.id === params.cardId);
    if (!card) return notFound();
    Object.assign(card, await request.json(), { updated_at: now() });
    return HttpResponse.json(card);
  }),
  http.delete("/api/boards/:id/cards/:cardId/", ({ params }) => {
    const i = db.cards.findIndex((c) => c.id === params.cardId);
    if (i >= 0) { db.cards.splice(i, 1); logActivity("card.deleted", params.cardId as string, { ...scopeOfBoard(params.id as string) }); }
    return empty();
  }),
  http.post("/api/boards/:id/cards/:cardId/move/", async ({ params, request }) => {
    const { destination_list_id, position } = (await request.json()) as { destination_list_id: string; position: number };
    moveCard(params.cardId as string, destination_list_id, position);
    logActivity("card.moved", params.cardId as string, { ...scopeOfBoard(params.id as string), card_id: params.cardId as string });
    return empty();
  }),

  // labels
  http.get("/api/boards/:id/labels/", ({ params }) => HttpResponse.json(db.labels.filter((l) => l.board_id === params.id))),
  http.get("/api/cards/:cardId/labels/", ({ params }) => HttpResponse.json(db.cards.find((c) => c.id === params.cardId)?.labels ?? [])),

  // checklists + comments
  http.get("/api/cards/:cardId/checklists/", ({ params }) => HttpResponse.json(db.checklists.filter((c) => c.card_id === params.cardId))),
  http.post("/api/cards/:cardId/checklists/", async ({ params, request }) => {
    const { title } = (await request.json()) as { title: string };
    const cl = { id: nextId(), card_id: params.cardId as string, title, position: db.checklists.filter((c) => c.card_id === params.cardId).length, items: [] };
    db.checklists.push(cl);
    return HttpResponse.json(cl, { status: 201 });
  }),
  http.post("/api/checklists/:id/items/", async ({ params, request }) => {
    const { title } = (await request.json()) as { title: string };
    const cl = db.checklists.find((c) => c.id === params.id);
    if (!cl) return notFound();
    const item = { id: nextId(), checklist_id: cl.id, title, position: cl.items.length, is_completed: false };
    cl.items.push(item);
    return HttpResponse.json(item, { status: 201 });
  }),
  http.patch("/api/checklist-items/:id/", async ({ params, request }) => {
    for (const cl of db.checklists) {
      const item = cl.items.find((i) => i.id === params.id);
      if (item) { Object.assign(item, await request.json()); return HttpResponse.json(item); }
    }
    return notFound();
  }),
  http.get("/api/cards/:cardId/comments/", ({ params }) => HttpResponse.json(db.comments.filter((c) => c.card_id === params.cardId))),
  http.post("/api/cards/:cardId/comments/", async ({ params, request }) => {
    const { body } = (await request.json()) as { body: string };
    const comment = { id: nextId(), card_id: params.cardId as string, author: currentUser, body, created_at: now(), updated_at: now() };
    db.comments.push(comment);
    logActivity("comment.created", comment.id, { ...scopeOfBoard(boardOfCard(params.cardId as string) ?? ""), card_id: params.cardId as string });
    return HttpResponse.json(comment, { status: 201 });
  }),

  // --- card permissions: board admin / workspace owner manage assignees; authors or managers edit comments ---
  // (defined as plain helpers right above the handlers that use them)

  http.patch("/api/comments/:id/", async ({ params, request }) => {
    const c = db.comments.find((x) => x.id === params.id);
    if (!c) return notFound();
    if (c.author.id !== currentUser.id && !canManageCard(c.card_id)) return forbidden();
    const { body } = (await request.json()) as { body: string };
    Object.assign(c, { body, updated_at: new Date(Date.now() + 1000).toISOString() });
    return HttpResponse.json(c);
  }),
  http.delete("/api/comments/:id/", ({ params }) => {
    const i = db.comments.findIndex((x) => x.id === params.id);
    if (i < 0) return notFound();
    const c = db.comments[i];
    if (c.author.id !== currentUser.id && !canManageCard(c.card_id)) return forbidden();
    db.comments.splice(i, 1);
    return empty();
  }),

  http.patch("/api/checklists/:id/", async ({ params, request }) => {
    const cl = db.checklists.find((x) => x.id === params.id);
    if (!cl) return notFound();
    Object.assign(cl, await request.json());
    return HttpResponse.json(cl);
  }),
  http.delete("/api/checklists/:id/", ({ params }) => {
    const i = db.checklists.findIndex((x) => x.id === params.id);
    if (i < 0) return notFound();
    db.checklists.splice(i, 1);
    return empty();
  }),
  http.post("/api/checklists/:id/move/", async ({ params, request }) => {
    const cl = db.checklists.find((x) => x.id === params.id);
    if (!cl) return notFound();
    const { position } = (await request.json()) as { position: number };
    const sib = db.checklists.filter((x) => x.card_id === cl.card_id).sort((a, b) => a.position - b.position);
    sib.splice(sib.indexOf(cl), 1);
    sib.splice(position, 0, cl);
    sib.forEach((x, i) => (x.position = i));
    return empty();
  }),
  http.post("/api/checklist-items/:id/move/", async ({ params, request }) => {
    const { position } = (await request.json()) as { position: number };
    for (const cl of db.checklists) {
      const it = cl.items.find((x) => x.id === params.id);
      if (!it) continue;
      const sib = [...cl.items].sort((a, b) => a.position - b.position);
      sib.splice(sib.indexOf(it), 1);
      sib.splice(position, 0, it);
      sib.forEach((x, i) => (x.position = i));
      return empty();
    }
    return notFound();
  }),
  http.delete("/api/checklist-items/:id/", ({ params }) => {
    for (const cl of db.checklists) {
      const i = cl.items.findIndex((x) => x.id === params.id);
      if (i >= 0) { cl.items.splice(i, 1); cl.items.sort((a, b) => a.position - b.position).forEach((x, k) => (x.position = k)); return empty(); }
    }
    return notFound();
  }),

  // card labels: attach / detach (the board detail reads card.labels, so tiles update too)
  http.post("/api/cards/:cardId/labels/", async ({ params, request }) => {
    const card = db.cards.find((c) => c.id === params.cardId);
    if (!card) return notFound();
    const { label_id } = (await request.json()) as { label_id: string };
    const label = db.labels.find((l) => l.id === label_id);
    if (!label) return HttpResponse.json({ label_id: ["برچسب پیدا نشد."] }, { status: 400 });
    if (card.labels?.some((l) => l.id === label.id)) return HttpResponse.json({ detail: "این برچسب قبلاً متصل شده است." }, { status: 400 });
    (card.labels ??= []).push(label);
    return HttpResponse.json(label, { status: 201 });
  }),
  http.delete("/api/cards/:cardId/labels/:labelId/", ({ params }) => {
    const card = db.cards.find((c) => c.id === params.cardId);
    if (!card) return notFound();
    card.labels = (card.labels ?? []).filter((l) => l.id !== params.labelId);
    return empty();
  }),

  // card assignees: records { id, user }; the id is NOT the user id
  http.get("/api/cards/:cardId/members/", ({ params }) => HttpResponse.json(db.cards.find((c) => c.id === params.cardId)?.assignees ?? [])),
  http.post("/api/cards/:cardId/members/", async ({ params, request }) => {
    const card = db.cards.find((c) => c.id === params.cardId);
    if (!card) return notFound();
    if (!canManageCard(card.id)) return forbidden();
    const { phone_number } = (await request.json()) as { phone_number: string };
    const user = directory.find((u) => normalizePhone(u.phone_number) === normalizePhone(phone_number));
    if (!user) return HttpResponse.json({ phone_number: ["کاربری با این شماره در نوابرد حساب ندارد."] }, { status: 400 });
    if (card.assignees?.some((a) => a.user.id === user.id)) return HttpResponse.json({ detail: "این کاربر قبلاً مسئول این کارت است." }, { status: 400 });
    const rec = { id: nextId(), user };
    (card.assignees ??= []).push(rec);
    return HttpResponse.json(rec, { status: 201 });
  }),
  http.delete("/api/cards/:cardId/members/:assigneeId/", ({ params }) => {
    const card = db.cards.find((c) => c.id === params.cardId);
    if (!card) return notFound();
    if (!canManageCard(card.id)) return forbidden();
    card.assignees = (card.assignees ?? []).filter((a) => a.id !== params.assigneeId);
    return empty();
  }),

  // attachments (multipart upload, blob download)
  http.get("/api/cards/:cardId/attachments/", ({ params }) => HttpResponse.json(db.attachments.filter((a) => a.card_id === params.cardId))),
  http.post("/api/cards/:cardId/attachments/", async ({ params, request }) => {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return HttpResponse.json({ file: ["فایلی ارسال نشده است."] }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return HttpResponse.json({ file: ["حجم فایل از حد مجاز (۱۰ مگابایت) بیشتر است."] }, { status: 400 });
    const att = { id: nextId(), card_id: params.cardId as string, original_name: file.name, size: file.size, created_at: now() };
    db.attachments.push(att);
    db.attachmentContent[att.id] = await file.text();
    return HttpResponse.json(att, { status: 201 });
  }),
  http.get("/api/cards/:cardId/attachments/:attId/content/", ({ params }) => {
    const att = db.attachments.find((a) => a.id === params.attId);
    if (!att) return notFound();
    return new HttpResponse(db.attachmentContent[att.id] ?? "", { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": "attachment" } });
  }),
  http.delete("/api/cards/:cardId/attachments/:attId/", ({ params }) => {
    const i = db.attachments.findIndex((a) => a.id === params.attId);
    if (i < 0) return notFound();
    db.attachments.splice(i, 1);
    return empty();
  }),

  // notifications (stub)
  http.get("/api/notifications/unread-count/", () => {
    if (localStorage.getItem("mock-notif-fail")) return HttpResponse.json({ detail: "خطای سرور" }, { status: 500 }); // exercises the polling backoff
    return HttpResponse.json({ count: db.notifications.filter((n) => !n.read_at).length });
  }),
  http.get("/api/notifications/", ({ request }) => {
    const url = new URL(request.url);
    let rows = [...db.notifications].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (url.searchParams.get("unread") === "true") rows = rows.filter((n) => !n.read_at);
    return HttpResponse.json(paginate(rows, url));
  }),
  http.post("/api/notifications/read-all/", () => {
    const unread = db.notifications.filter((n) => !n.read_at);
    unread.forEach((n) => (n.read_at = now()));
    return HttpResponse.json({ updated: unread.length });
  }),
  http.post("/api/notifications/:id/read/", ({ params }) => {
    const n = db.notifications.find((x) => x.id === params.id);
    if (!n) return notFound();
    n.read_at ??= now();
    return HttpResponse.json(n);
  }),
  http.get("/api/workspaces/:id/activity/", ({ params, request }) => HttpResponse.json(paginate(db.activity.filter((a) => a.workspace_id === params.id), new URL(request.url)))),
  http.get("/api/boards/:id/activity/", ({ params, request }) => HttpResponse.json(paginate(db.activity.filter((a) => a.board_id === params.id), new URL(request.url)))),
  http.get("/api/cards/:id/activity/", ({ params, request }) => HttpResponse.json(paginate(db.activity.filter((a) => a.card_id === params.id), new URL(request.url)))),

  // card search: q matches title/description; filters combine; dates must carry a timezone
  http.get("/api/cards/", ({ request }) => {
    const url = new URL(request.url);
    const sp = url.searchParams;
    const hasTz = (v: string) => /(Z|[+-]\d{2}:?\d{2})$/.test(v);
    for (const k of ["due_before", "due_after"]) if (sp.get(k) && !hasTz(sp.get(k)!)) return HttpResponse.json({ [k]: ["تاریخ باید منطقه‌ی زمانی داشته باشد."] }, { status: 400 });
    const q = sp.get("q")?.toLowerCase();
    const rows = db.cards.filter((c) => {
      const list = db.lists.find((l) => l.id === c.list_id);
      const board = db.boards.find((b) => b.id === list?.board_id);
      if (q && !`${c.title} ${c.description ?? ""}`.toLowerCase().includes(q)) return false;
      if (sp.get("board_id") && board?.id !== sp.get("board_id")) return false;
      if (sp.get("workspace_id") && board?.workspace_id !== sp.get("workspace_id")) return false;
      if (sp.get("assigned_to_me") === "true" && !c.assignees?.some((a) => a.user.id === currentUser.id)) return false;
      if (sp.get("due_before") && !(c.due_at && c.due_at < new Date(sp.get("due_before")!).toISOString())) return false;
      if (sp.get("due_after") && !(c.due_at && c.due_at > new Date(sp.get("due_after")!).toISOString())) return false;
      return true;
    }).map((c) => ({ ...c, board_id: db.lists.find((l) => l.id === c.list_id)?.board_id }));
    return HttpResponse.json(paginate(rows, url));
  }),
  // board search: this mock deliberately IGNORES `q` (unconfirmed parameter) so the UI's own name filter is exercised
  http.get("/api/boards/", () => HttpResponse.json(db.boards)),
];
