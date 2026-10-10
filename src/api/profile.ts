import { api } from "./client";
import type { User } from "@/types";

export const profileApi = {
  me: () => api<User>("auth/me/"),
  update: (patch: { full_name?: string }) => api<User>("auth/me/", { method: "PATCH", body: patch }),
  requestPhoneChange: (phone_number: string) => api("auth/phone/change/request/", { method: "POST", body: { phone_number } }),
  confirmPhoneChange: (phone_number: string, code: string) => api("auth/phone/change/confirm/", { method: "POST", body: { phone_number, code } }),
  changePassword: (current_password: string, new_password: string) =>
    api("auth/password/change/", { method: "POST", body: { current_password, new_password } }),
  requestPasswordReset: (phone_number: string) => api("auth/password/reset/request/", { method: "POST", body: { phone_number } }),
  confirmPasswordReset: (phone_number: string, code: string, new_password: string) =>
    api("auth/password/reset/confirm/", { method: "POST", body: { phone_number, code, new_password } }),
  // Optional email + password (enables POST auth/email/login/). Guide: all three use Bearer, no CSRF.
  requestEmailVerification: (email: string) => api("auth/email/verification/request/", { method: "POST", body: { email } }),
  confirmEmailVerification: (email: string, code: string) => api("auth/email/verification/confirm/", { method: "POST", body: { email, code } }),
  setPassword: (password: string) => api("auth/password/set/", { method: "POST", body: { password } }),
};
