import { auth } from "../firebase";

const BASE = process.env.REACT_APP_API_URL || "";

// Calls the LISAP API as the signed-in user. Resolves to { ok, status, data }.
export async function api(path, { method = "GET", body } = {}) {
  const user = auth.currentUser;
  const headers = {};
  if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}
