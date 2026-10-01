import { currentLang } from "./i18n";

export async function api(path, { method = "GET", body } = {}) {
  const headers = { "X-Lang": currentLang() };
  if (body) headers["Content-Type"] = "application/json";
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || (currentLang() === "pt" ? "Algo deu errado." : "Something went wrong."));
    error.status = response.status;
    error.code = data.code;
    error.data = data;
    throw error;
  }
  return data;
}
