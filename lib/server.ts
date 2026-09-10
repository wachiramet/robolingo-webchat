import { verifySession } from "./security";

const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "LINE_CHANNEL_ACCESS_TOKEN",
  "LINE_CHANNEL_SECRET",
  "ADMIN_PASSWORD",
  "SESSION_SECRET",
  "APP_URL",
] as const;
export function mode(): "demo" | "live" | "setup" {
  if (process.env.DEMO_MODE === "true") return "demo";
  if (
    process.env.NODE_ENV !== "production" &&
    required.every((key) => !process.env[key])
  )
    return "demo";
  if (
    required.some((key) => !process.env[key]) ||
    (process.env.SESSION_SECRET?.length ?? 0) < 32 ||
    (process.env.ADMIN_PASSWORD?.length ?? 0) < 12
  )
    return "setup";
  try {
    const app = new URL(process.env.APP_URL!);
    const db = new URL(process.env.SUPABASE_URL!);
    if (
      db.protocol !== "https:" ||
      (process.env.NODE_ENV === "production" && app.protocol !== "https:")
    )
      return "setup";
  } catch {
    return "setup";
  }
  return "live";
}
export function authenticated(request: Request) {
  const token =
    request.headers
      .get("cookie")
      ?.split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith("operator_session="))
      ?.slice("operator_session=".length) ?? "";
  return (
    mode() === "live" && verifySession(token, process.env.SESSION_SECRET ?? "")
  );
}
export function sameOrigin(request: Request) {
  return (
    request.headers.get("origin") ===
    new URL(process.env.APP_URL || request.url).origin
  );
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function guard(request: Request, mutation = false) {
  if (mode() !== "live")
    return json({ error: "Integration is not configured." }, 503);
  if (!authenticated(request)) return json({ error: "Please sign in." }, 401);
  if (mutation && !sameOrigin(request))
    return json({ error: "Request not allowed." }, 403);
  return null;
}
export async function db(path: string, init: RequestInit = {}) {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error("Storage unavailable");
  return response.status === 204 ? null : response.json();
}
export async function rpc(name: string, body: unknown) {
  return db(`rpc/${name}`, { method: "POST", body: JSON.stringify(body) });
}
export function messageDto(row: Record<string, string>) {
  return {
    id: row.id,
    userId: row.user_id,
    text: row.text,
    direction: row.direction,
    createdAt: row.created_at,
  };
}
