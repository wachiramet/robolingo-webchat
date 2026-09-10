import { authenticated, json, mode, rpc, sameOrigin } from "../../../lib/server";
import { loginRateKey, passwordMatches, signSession } from "../../../lib/security";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return json({ mode: mode(), authenticated: authenticated(request) });
}
export async function POST(request: Request) {
  if (mode() !== "live")
    return json({ error: "Integration is not configured." }, 503);
  if (!sameOrigin(request)) return json({ error: "Request not allowed." }, 403);
  try {
    const allowed = await rpc("consume_login_attempt", {
      p_key: loginRateKey(
        request.headers,
        process.env.SESSION_SECRET!,
        process.env.VERCEL === "1",
      ),
    });
    if (allowed !== true) {
      const response = json(
        { error: "Too many login attempts. Try again in 15 minutes." },
        429,
      );
      response.headers.set("Retry-After", "900");
      return response;
    }
  } catch {
    return json({ error: "Sign in is temporarily unavailable." }, 503);
  }
  try {
    const { password } = await request.json();
    if (
      typeof password !== "string" ||
      password.length > 1024 ||
      !passwordMatches(password, process.env.ADMIN_PASSWORD!)
    ) {
      return json({ error: "Incorrect password." }, 401);
    }
    const response = json({ authenticated: true });
    response.headers.set(
      "Set-Cookie",
      `operator_session=${signSession(process.env.SESSION_SECRET!)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    );
    return response;
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Request not allowed." }, 403);
  const response = json({ authenticated: false });
  response.headers.set(
    "Set-Cookie",
    `operator_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
  return response;
}
