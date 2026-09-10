import { json, mode, rpc } from "../../../../lib/server";
import { validUserId, verifyLineSignature } from "../../../../lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (mode() !== "live")
    return json({ error: "Integration is not configured." }, 503);
  const body = await request.text();
  if (
    !verifyLineSignature(
      body,
      request.headers.get("x-line-signature") ?? "",
      process.env.LINE_CHANNEL_SECRET!,
    )
  )
    return json({ error: "Invalid signature." }, 401);
  try {
    const payload = JSON.parse(body);
    if (!Array.isArray(payload.events))
      return json({ error: "Invalid event." }, 400);
    for (const event of payload.events) {
      const userId = event.source?.userId;
      if (event.source?.type !== "user" || !validUserId(userId)) continue;
      if (
        event.type === "unsend" &&
        typeof event.unsend?.messageId === "string"
      ) {
        await rpc("unsend_message", { p_message_id: event.unsend.messageId });
        continue;
      }
      if (
        event.type !== "message" ||
        typeof event.message?.id !== "string" ||
        typeof event.webhookEventId !== "string"
      )
        continue;
      let name = `LINE ${userId.slice(-6)}`;
      try {
        const response = await fetch(
          `https://api.line.me/v2/bot/profile/${userId}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
            },
            signal: AbortSignal.timeout(5000),
            cache: "no-store",
          },
        );
        if (response.ok) {
          const profile = await response.json();
          if (typeof profile.displayName === "string")
            name = profile.displayName;
        }
      } catch {
        /* A blocked/unavailable profile must not lose the message. */
      }
      const text =
        event.message.type === "text" && typeof event.message.text === "string"
          ? event.message.text
          : `[${String(event.message.type || "Unsupported message")}]`;
      await rpc("ingest_line_message", {
        p_event_id: event.webhookEventId,
        p_message_id: event.message.id,
        p_user_id: userId,
        p_name: name,
        p_text: text,
        p_created_at: new Date(event.timestamp).toISOString(),
      });
    }
    return json({ ok: true });
  } catch {
    return json({ error: "Could not process event. Please retry." }, 500);
  }
}
