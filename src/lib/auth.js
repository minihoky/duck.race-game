import { api } from "./api";

function post(path, body) {
  return api(path, { method: "POST", body: body || {} });
}

export function register(body) {
  return post("/api/auth/register", body);
}

export function login(body) {
  return post("/api/auth/login", body);
}

export function logout() {
  return post("/api/auth/logout");
}

export function resend(email) {
  return post("/api/auth/resend", { email });
}

export function verifyEmail(token) {
  return post("/api/auth/verify", { token });
}

export function forgotPassword(email) {
  return post("/api/auth/forgot", { email });
}

export function resetPassword(token, password) {
  return post("/api/auth/reset", { token, password });
}

export async function me() {
  try {
    const data = await api("/api/auth/me");
    return data.user || null;
  } catch {
    return null;
  }
}

export function publishAccount(user) {
  window.dispatchEvent(new CustomEvent("duck-account", { detail: user }));
}
