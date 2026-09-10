import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  loginRateKey,
  passwordMatches,
  signSession,
  validMessage,
  validReadThrough,
  validRequestId,
  validUserId,
  verifyLineSignature,
  verifySession,
} from "../lib/security.ts";

test("login limit trusts only Vercel's IP header and stores a keyed hash", () => {
  const secret = "test-session-secret";
  const headers = new Headers({
    "x-vercel-forwarded-for": "203.0.113.1",
    "x-forwarded-for": "198.51.100.1",
  });
  const key = loginRateKey(headers, secret, true);
  assert.match(key, /^[a-f0-9]{64}$/);
  headers.set("x-forwarded-for", "198.51.100.2");
  assert.equal(loginRateKey(headers, secret, true), key);
  headers.set("x-vercel-forwarded-for", "203.0.113.2");
  assert.notEqual(loginRateKey(headers, secret, true), key);
  assert.notEqual(
    loginRateKey(headers, "another-secret", true),
    loginRateKey(headers, secret, true),
  );
  assert.equal(
    loginRateKey(headers, secret, false),
    loginRateKey(new Headers(), secret, false),
  );
  headers.set("x-vercel-forwarded-for", "fake, 203.0.113.1");
  assert.equal(
    loginRateKey(headers, secret, true),
    loginRateKey(new Headers(), secret, true),
  );
});

test("LINE signature authenticates exact raw bytes", () => {
  const body = '{"events":[]}';
  const secret = "test-channel-secret";
  const signature = createHmac("sha256", secret).update(body).digest("base64");
  assert.equal(verifyLineSignature(body, signature, secret), true);
  assert.equal(verifyLineSignature(`${body} `, signature, secret), false);
  assert.equal(verifyLineSignature(body, "", secret), false);
});
test("signed session rejects tampering, expiry, short secret", () => {
  const secret = "a".repeat(32);
  const token = signSession(secret, 1000);
  assert.equal(verifySession(token, secret, 1001), true);
  assert.equal(verifySession(`${token}x`, secret, 1001), false);
  assert.equal(verifySession(token, secret, 1000 + 8 * 60 * 60 * 1000), false);
  assert.equal(verifySession(token, "short", 1001), false);
  assert.equal(verifySession(token, "b".repeat(32), 1001), false);
});
test("message input is bounded and identifiers cannot become REST filters", () => {
  assert.equal(validUserId(`U${"a".repeat(32)}`), true);
  assert.equal(validUserId("Uabc&select=*"), false);
  assert.equal(validMessage(" สวัสดี "), true);
  assert.equal(validMessage("   "), false);
  assert.equal(validMessage("a".repeat(5001)), false);
  assert.equal(validRequestId("b0be7257-8271-4dc4-9a76-67b724063a87"), true);
  assert.equal(validRequestId("not-a-uuid"), false);
  assert.equal(passwordMatches("correct", "correct"), true);
  assert.equal(passwordMatches("wrong", "correct"), false);
});

test("read cutoff rejects missing, invalid and future timestamps", () => {
  assert.equal(
    validReadThrough("2026-01-01T00:00:00.000Z", Date.parse("2026-01-02")),
    true,
  );
  assert.equal(
    validReadThrough("2026-01-03T00:00:00.000Z", Date.parse("2026-01-02")),
    false,
  );
  assert.equal(validReadThrough("invalid"), false);
  assert.equal(validReadThrough(undefined), false);
});
