import type { ApiErrorBody, User } from "@/types";

export class ApiError extends Error {
  status: number;
  data: ApiErrorBody | null;
  retryAfter: string | null;
  constructor(message: string, status: number, data: ApiErrorBody | null, retryAfter: string | null) {
    super(message);
    this.status = status;
    this.data = data;
    this.retryAfter = retryAfter;
  }
}

// In-memory session state — never persisted to localStorage.
let csrfToken: string | null = null;
let accessToken: string | null = null;
let refreshInFlight: Promise<void> | null = null;

async function readResponse(response: Response) {
  if (response.status === 204) return null;
  const text = await response.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : null; } catch { data = { detail: text || "Unexpected response" }; }
  if (!response.ok) {
    const body = data as ApiErrorBody | null;
    const detail = body && typeof body === "object" && "detail" in body
      ? String((body as { detail: string }).detail) : `HTTP ${response.status}`;
    throw new ApiError(detail, response.status, body, response.headers.get("Retry-After"));
  }
  return data;
}

export async function initializeCsrf() {
  const data = (await readResponse(await fetch("/api/auth/csrf/", { credentials: "include" }))) as { csrfToken: string };
  csrfToken = data.csrfToken;
}

async function csrfFetch(path: string, init: RequestInit = {}) {
  if (!csrfToken) await initializeCsrf();
  return fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: { ...(init.headers ?? {}), "X-CSRFToken": csrfToken ?? "" },
  });
}

// Single-flight: concurrent 401s share one refresh request.
export function refreshAccess(): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const data = (await readResponse(await csrfFetch("/auth/token/refresh/", { method: "POST" }))) as { access: string };
      accessToken = data.access;
    })()
      .catch((error) => {
        if (error instanceof ApiError && [400, 401].includes(error.status)) accessToken = null;
        throw error;
      })
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

// CSRF is NOT required for OTP request; required for verify, email login, refresh, logout.
export async function requestOtp(phoneNumber: string) {
  const r = await fetch("/api/auth/otp/request/", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone_number: phoneNumber }),
  });
  return readResponse(r) as Promise<{ at_expires: string; code_otp_development?: string }>;
}

export async function verifyOtp(phoneNumber: string, code: string): Promise<User> {
  const r = await csrfFetch("/auth/otp/verify/", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone_number: phoneNumber, code }),
  });
  const data = (await readResponse(r)) as { access: string; user: User };
  accessToken = data.access;
  return data.user;
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  const r = await csrfFetch("/auth/email/login/", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = (await readResponse(r)) as { access: string; user: User };
  accessToken = data.access;
  return data.user;
}

export async function logout() {
  await readResponse(await csrfFetch("/auth/logout/", { method: "POST" }));
  accessToken = null;
}

/** After a page reload: CSRF -> refresh via cookie -> profile. Returns null when login is required. */
export async function restoreSession(): Promise<User | null> {
  await initializeCsrf();
  try { await refreshAccess(); } catch (error) {
    if (error instanceof ApiError && [400, 401].includes(error.status)) return null;
    throw error;
  }
  return api<User>("auth/me/");
}

function authHeader(): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

// One 401 -> refresh -> single retry. No infinite loops.
async function withRetry(send: () => Promise<Response>) {
  let response = await send();
  if (response.status === 401) { await refreshAccess(); response = await send(); }
  return response;
}

export async function api<T>(path: string, { method = "GET", body }: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await withRetry(() => fetch(`/api/${path}`, {
    method, credentials: "include",
    headers: { ...authHeader(), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
  return readResponse(response) as Promise<T>;
}

/** FormData upload — never set Content-Type manually. */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const response = await withRetry(() => fetch(`/api/${path}`, {
    method: "POST", credentials: "include", headers: authHeader(), body: form,
  }));
  return readResponse(response) as Promise<T>;
}

export async function downloadAttachment(cardId: string, attachmentId: string, fileName: string) {
  const response = await withRetry(() => fetch(`/api/cards/${cardId}/attachments/${attachmentId}/content/`, {
    credentials: "include", headers: authHeader(),
  }));
  if (!response.ok) await readResponse(response);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url; link.download = fileName;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
