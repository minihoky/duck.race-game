async function post(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body || {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Something went wrong.");
    error.code = data.code;
    error.status = response.status;
    throw error;
  }
  return data;
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
  const response = await fetch("/api/auth/me", { credentials: "same-origin" });
  if (!response.ok) return null;
  const data = await response.json().catch(() => ({}));
  return data.user || null;
}
