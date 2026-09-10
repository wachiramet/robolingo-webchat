import { db, guard, json, messageDto, rpc } from "../../../lib/server";
import {
  validMessage,
  validRequestId,
  validUserId,
} from "../../../lib/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const error = guard(request);
  if (error) return error;
  const userId = new URL(request.url).searchParams.get("userId");
  if (!validUserId(userId)) return json({ error: "Invalid user." }, 400);
  const readThrough = new Date().toISOString();
  try {
    const rows = await db(
      `messages?user_id=eq.${userId}&delivery=eq.sent&select=*&order=created_at.desc&limit=500`,
    );
    return json({ messages: rows.reverse().map(messageDto), readThrough });
  } catch {
    return json({ error: "Could not load messages." }, 502);
  }
}

export async function POST(request: Request) {
  const error = guard(request, true);
  if (error) return error;
  try {
    const { userId, text, requestId } = await request.json();
    if (
      !validUserId(userId) ||
      !validMessage(text) ||
      !validRequestId(requestId)
    )
      return json({ error: "Invalid message." }, 400);
    const reserved = await rpc("reserve_outgoing", {
      p_id: requestId,
      p_user_id: userId,
      p_text: text.trim(),
    });
    if (
      !reserved ||
      reserved.user_id !== userId ||
      reserved.text !== text.trim()
    )
      return json({ error: "Request ID has already been used." }, 409);
    if (reserved.delivery === "sent")
      return json({ message: messageDto(reserved) });
    // LINE keeps retry keys for 24h. Never repeat an uncertain older delivery.
    if (Date.now() - Date.parse(reserved.created_at) > 23 * 60 * 60 * 1000)
      return json(
        { error: "Delivery status requires manual verification." },
        409,
      );
    const result = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Line-Retry-Key": requestId,
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: "text", text: text.trim() }],
      }),
    });
    if (
      !result.ok &&
      !(
        result.status === 409 &&
        result.headers.has("x-line-accepted-request-id")
      )
    )
      return json(
        { error: "Message was not confirmed. Retry the same message." },
        502,
      );
    const saved = await db(`messages?id=eq.${requestId}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ delivery: "sent" }),
    });
    if (!saved?.[0]) throw new Error("Save failed");
    return json({ message: messageDto(saved[0]) });
  } catch {
    return json(
      { error: "Message was not confirmed. Retry the same message." },
      502,
    );
  }
}
