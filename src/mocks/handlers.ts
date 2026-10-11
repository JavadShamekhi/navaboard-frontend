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
    if (!user) return HttpResponse.json({ phone_number: ["کاربری با این شماره در ناوابرد حساب ندارد."] }, { status: 400 });
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
    if (!user) return HttpResponse.json({ phone_number: ["کاربری با این شماره در ناوابرد حساب ندارد."] }, { status: 400 });
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
    if (i >= 0) db.cards.splice(i, 1);
    return empty();
  }),
  http.post("/api/boards/:id/cards/:cardId/move/", async ({ params, request }) => {
    const { destination_list_id, position } = (await request.json()) as { destination_list_id: string; position: number };
    moveCard(params.cardId as string, destination_list_id, position);
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
    return HttpResponse.json(comment, { status: 201 });
  }),

  // notifications (stub)
  http.get("/api/notifications/unread-count/", () => HttpResponse.json({ count: 0 })),
  http.get("/api/notifications/", () => HttpResponse.json({ count: 0, next: null, previous: null, results: [] })),
];
