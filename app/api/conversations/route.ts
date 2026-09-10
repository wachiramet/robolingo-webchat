import { db, guard, json, rpc } from "../../../lib/server";
import { validReadThrough, validUserId } from "../../../lib/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const error = guard(request);
  if (error) return error;
  try {
    const rows = await db(
      "conversation_summary?select=*&order=updated_at.desc&limit=200",
    );
    return json({
      conversations: rows.map((row: Record<string, unknown>) => ({
        id: row.user_id,
        name: row.name,
        lastMessage: row.last_message,
        updatedAt: row.updated_at,
        unread: row.unread,
      })),
    });
  } catch {
    return json({ error: "Could not load conversations." }, 502);
  }
}

export async function PATCH(request: Request) {
  const error = guard(request, true);
  if (error) return error;
  try {
    const { userId, readThrough } = await request.json();
    if (!validUserId(userId) || !validReadThrough(readThrough))
      return json({ error: "Invalid user." }, 400);
    await rpc("mark_conversation_read", {
      p_user_id: userId,
      p_cutoff: readThrough,
    });
    return json({ ok: true });
  } catch {
    return json({ error: "Could not mark conversation read." }, 502);
  }
}
