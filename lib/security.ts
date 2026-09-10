import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

// Vercel overwrites this header. Never trust client-supplied forwarding headers.
export function loginRateKey(
  headers: Headers,
  secret: string,
  vercel: boolean,
) {
  const forwarded = headers.get("x-vercel-forwarded-for")?.trim() ?? "";
  const client =
    vercel && isIP(forwarded) ? forwarded : "shared-local-or-unknown";
  return createHmac("sha256", secret).update(`login:${client}`).digest("hex");
}

function equal(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function verifyLineSignature(
  body: string,
  signature: string,
  secret: string,
) {
  return (
    Boolean(secret && signature) &&
    equal(createHmac("sha256", secret).update(body).digest("base64"), signature)
  );
}
export function signSession(secret: string, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({ exp: now + 8 * 60 * 60 * 1000 }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}
export function verifySession(token: string, secret: string, now = Date.now()) {
  if (secret.length < 32) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  if (
    !equal(
      createHmac("sha256", secret).update(payload).digest("base64url"),
      signature,
    )
  )
    return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && exp > now;
  } catch {
    return false;
  }
}
export function validUserId(value: unknown): value is string {
  return typeof value === "string" && /^U[a-f0-9]{32}$/.test(value);
}
export function validMessage(value: unknown): value is string {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= 5000
  );
}
export function validRequestId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      value,
    )
  );
}
export function passwordMatches(candidate: string, expected: string) {
  return (
    Boolean(expected) &&
    equal(
      createHmac("sha256", "password-compare").update(candidate).digest("hex"),
      createHmac("sha256", "password-compare").update(expected).digest("hex"),
    )
  );
}

export function validReadThrough(
  value: unknown,
  now = Date.now(),
): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= now && timestamp >= 0;
}
