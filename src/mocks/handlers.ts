import { http, HttpResponse } from "msw";
import { boardWithLists, currentUser, db, moveCard, nextId } from "./db";

const DEV_OTP = "123456";
let lastOtpPhone: string | null = null;
const now = () => new Date().toISOString();
const notFound = () => HttpResponse.json({ detail: "یافت نشد" }, { status: 404 });
const empty = () => new HttpResponse(null, { status: 204 });

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
    return HttpResponse.json({ access: "mock-access-token", type_token: "Bearer", created_user: false, user: currentUser });
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
    const ws = { id: nextId(), name, role_user_current: "owner" as const, created_at: now() };
    db.workspaces.push(ws);
    return HttpResponse.json(ws, { status: 201 });
  }),
  http.get("/api/workspaces/:id/boards/", ({ params }) => HttpResponse.json(db.boards.filter((b) => b.workspace_id === params.id))),
  http.post("/api/workspaces/:id/boards/", async ({ params, request }) => {
    const body = (await request.json()) as { name: string; visibility: "private" | "workspace" };
    const board = { id: nextId(), workspace_id: params.id as string, name: body.name, visibility: body.visibility, role_user_current: "admin" as const, created_at: now() };
    db.boards.push(board);
    return HttpResponse.json(board, { status: 201 });
  }),

  // boards / lists / cards
  http.get("/api/boards/:id/", ({ params }) => {
    const board = boardWithLists(params.id as string);
    return board ? HttpResponse.json(board) : notFound();
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
