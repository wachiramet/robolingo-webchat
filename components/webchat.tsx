"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEMO_MESSAGES,
  DEMO_PEOPLE,
  filterConversations,
  orderConversations,
  type Conversation,
  type Message,
} from "@/lib/chat";

type Session = { mode: "demo" | "live" | "setup"; authenticated: boolean };
function Icon({
  name,
  ...props
}: {
  name: "chat" | "search" | "send" | "back" | "exit" | "refresh";
} & React.SVGProps<SVGSVGElement>) {
  const paths = {
    chat: "M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z",
    search: "m21 21-4.3-4.3M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
    send: "m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13",
    back: "m15 18-6-6 6-6",
    exit: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9",
    refresh:
      "M20 7v5h-5M4 17v-5h5m-4-4a8 8 0 0 1 13-3l2 3M4 16l2 3a8 8 0 0 0 13-3",
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่"
        : data.error || "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง",
    );
  return data as T;
}
function time(value: string) {
  return new Date(value).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function date(value: string) {
  return new Date(value).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function Avatar({ name, index = 0 }: { name: string; index?: number }) {
  return (
    <span aria-hidden="true" className={`avatar tone-${index % 3}`}>
      {Array.from(name)[0]}
    </span>
  );
}

export default function Webchat() {
  const [session, setSession] = useState<Session | null>(null);
  const [people, setPeople] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [lastSync, setLastSync] = useState("");
  const [mobileChat, setMobileChat] = useState(false);
  const selection = useRef<string | null>(null);
  const requestId = useRef(new Map<string, string>());
  const bottom = useRef<HTMLDivElement>(null);
  const demo = session?.mode === "demo";
  const active = people.find((p) => p.id === selected);
  const draft = selected ? drafts[selected] || "" : "";
  const visible = filterConversations(people, query, unreadOnly);
  const shown = messages.filter((m) => m.userId === selected);
  const unread = people.filter((p) => p.unread > 0).length;

  async function loadSession() {
    try {
      const info = await api<Session>("/api/session");
      setSession(info);
      setError("");
      if (info.mode === "demo") {
        setPeople(DEMO_PEOPLE);
        setMessages(DEMO_MESSAGES);
        setSelected("demo-1");
        selection.current = "demo-1";
      }
    } catch {
      setError("โหลดแอปไม่สำเร็จ กรุณาลองเชื่อมต่อใหม่");
    }
  }
  useEffect(() => {
    const timer = setTimeout(() => void loadSession(), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (session?.mode !== "live" || !session.authenticated) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      const userId = selected;
      try {
        const result = await api<{ conversations: Conversation[] }>(
          "/api/conversations",
        );
        if (cancelled) return;
        setPeople(result.conversations);
        if (userId) {
          const chat = await api<{ messages: Message[]; readThrough: string }>(
            `/api/messages?userId=${encodeURIComponent(userId)}`,
          );
          if (cancelled) return;
          setMessages(chat.messages);
          await api("/api/conversations", {
            method: "PATCH",
            body: JSON.stringify({ userId, readThrough: chat.readThrough }),
          });
          if (cancelled) return;
          setPeople((previous) =>
            previous.map((p) => (p.id === userId ? { ...p, unread: 0 } : p)),
          );
        }
        setLastSync(
          new Date().toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
        setError("");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "โหลดข้อความไม่สำเร็จ");
          if (e instanceof Error && e.message.startsWith("เซสชันหมดอายุ")) {
            setSession({ mode: "live", authenticated: false });
            setPeople([]);
            setMessages([]);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          timer = setTimeout(poll, 4000);
        }
      }
    }
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [session, selected]);

  const lastMessageId = shown.at(-1)?.id;
  useEffect(() => {
    const list = bottom.current?.parentElement;
    if (list) list.scrollTop = list.scrollHeight;
  }, [lastMessageId, selected]);

  function choose(person: Conversation) {
    selection.current = person.id;
    setSelected(person.id);
    setMobileChat(true);
    setError("");
    if (demo)
      setPeople((previous) =>
        previous.map((p) => (p.id === person.id ? { ...p, unread: 0 } : p)),
      );
    else {
      setMessages([]);
      setLoading(true);
    }
  }
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !draft.trim() || sending) return;
    const userId = selected,
      text = draft.trim();
    const key = JSON.stringify([userId, text]);
    if (!requestId.current.has(key))
      requestId.current.set(key, crypto.randomUUID());
    setSending(true);
    setError("");
    try {
      const message = demo
        ? {
            id: crypto.randomUUID(),
            userId,
            text,
            direction: "outgoing" as const,
            createdAt: new Date().toISOString(),
          }
        : (
            await api<{ message: Message }>("/api/messages", {
              method: "POST",
              body: JSON.stringify({
                userId,
                text,
                requestId: requestId.current.get(key),
              }),
            })
          ).message;
      if (demo || selection.current === userId)
        setMessages((previous) =>
          previous.some((m) => m.id === message.id)
            ? previous
            : [...previous, message],
        );
      setPeople((previous) =>
        orderConversations(
          previous.map((p) =>
            p.id === userId
              ? { ...p, lastMessage: text, updatedAt: message.createdAt }
              : p,
          ),
        ),
      );
      setDrafts((previous) => ({
        ...previous,
        [userId]: previous[userId]?.trim() === text ? "" : previous[userId],
      }));
      requestId.current.delete(key);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "ส่งไม่สำเร็จ ข้อความยังอยู่ในช่องพิมพ์ กรุณาลองอีกครั้ง",
      );
    } finally {
      setSending(false);
    }
  }
  async function login(event: React.FormEvent) {
    event.preventDefault();
    setLoggingIn(true);
    setError("");
    try {
      await api("/api/session", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setPassword("");
      await loadSession();
    } catch {
      setError("เข้าสู่ระบบไม่สำเร็จ ตรวจสอบรหัสผ่านแล้วลองอีกครั้ง");
    } finally {
      setLoggingIn(false);
    }
  }
  async function logout() {
    try {
      await api("/api/session", { method: "DELETE" });
      setPeople([]);
      setMessages([]);
      setSelected(null);
      selection.current = null;
      setDrafts({});
      await loadSession();
    } catch {
      setError("ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง");
    }
  }
  function simulateIncoming() {
    const id = selected || "demo-1";
    const message: Message = {
      id: crypto.randomUUID(),
      userId: id,
      text: "ขอบคุณค่ะ ขอรายละเอียดเพิ่มเติมได้ไหมคะ",
      direction: "incoming",
      createdAt: new Date().toISOString(),
    };
    setMessages((previous) => [...previous, message]);
    setPeople((previous) =>
      orderConversations(
        previous.map((p) =>
          p.id === id
            ? {
                ...p,
                lastMessage: message.text,
                updatedAt: message.createdAt,
                unread: id === selected ? 0 : p.unread + 1,
              }
            : p,
        ),
      ),
    );
  }

  if (!session)
    return (
      <main className="entry">
        <Icon name="chat" />
        <h1>Webchat</h1>
        <p role="status">{error || "กำลังเปิดกล่องข้อความ…"}</p>
        {error && (
          <button className="primary" onClick={loadSession}>
            ลองอีกครั้ง
          </button>
        )}
      </main>
    );
  if (session.mode === "setup")
    return (
      <main className="entry">
        <Icon name="chat" />
        <h1>ยังไม่พร้อมเชื่อมต่อ</h1>
        <p>ตั้งค่า LINE และฐานข้อมูลให้ครบก่อนใช้งาน</p>
        <p className="muted">ดูขั้นตอนใน README ของโปรเจกต์</p>
        <button className="secondary" onClick={loadSession}>
          ตรวจสอบอีกครั้ง
        </button>
      </main>
    );
  if (!demo && !session.authenticated)
    return (
      <main className="entry">
        <form className="login" onSubmit={login}>
          <span className="brand-mark">
            <Icon name="chat" />
          </span>
          <h1>เข้าสู่ Webchat</h1>
          <p>จัดการข้อความจาก LINE OA ของคุณ</p>
          <label htmlFor="password">รหัสผ่านแอดมิน</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={loggingIn}>
            {loggingIn ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
          </button>
        </form>
      </main>
    );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="chat" />
          </span>
          Webchat <span className="brand-divider" />
          <span className="brand-detail">LINE inbox</span>
        </div>
        <div className="top-actions">
          <span className={`connection ${demo ? "demo" : ""}`}>
            <span className="dot" />
            {demo ? "โหมดทดลอง" : "LINE OA"}
          </span>
          {!demo && (
            <button
              className="icon-button"
              aria-label="ออกจากระบบ"
              title="ออกจากระบบ"
              onClick={logout}
            >
              <Icon name="exit" />
            </button>
          )}
        </div>
      </header>
      {demo && (
        <div className="demo-banner">
          <span>
            ข้อมูลตัวอย่าง · ข้อความในหน้านี้จะไม่ถูกส่งไป LINE
            และจะเริ่มใหม่เมื่อรีเฟรช
          </span>
          <button onClick={simulateIncoming}>
            <Icon name="refresh" width="14" height="14" />
            จำลองข้อความเข้า
          </button>
        </div>
      )}
      {error && (
        <p className="error inbox-error" role="alert">
          {error}
        </p>
      )}
      <main className={`workspace ${mobileChat ? "show-chat" : ""}`}>
        <aside className="sidebar" aria-label="รายชื่อผู้สนทนา">
          <div className="sidebar-heading">
            <h1>ข้อความ</h1>
            <span className="total">{people.length}</span>
          </div>
          <label className="search">
            <Icon name="search" width="17" height="17" />
            <input
              aria-label="ค้นหาชื่อหรือรหัสผู้ใช้"
              placeholder="ค้นหาผู้สนทนา"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="ล้างคำค้น">
                ×
              </button>
            )}
          </label>
          <div className="filters" aria-label="กรองการสนทนา">
            <button
              className={!unreadOnly ? "active" : ""}
              aria-pressed={!unreadOnly}
              onClick={() => setUnreadOnly(false)}
            >
              ทั้งหมด
            </button>
            <button
              className={unreadOnly ? "active" : ""}
              aria-pressed={unreadOnly}
              onClick={() => setUnreadOnly(true)}
            >
              ยังไม่อ่าน {unread > 0 && <span>{unread}</span>}
            </button>
          </div>
          <div className="people">
            {visible.map((person, index) => (
              <button
                key={person.id}
                className={`person ${selected === person.id ? "selected" : ""}`}
                onClick={() => choose(person)}
                aria-pressed={selected === person.id}
              >
                <Avatar name={person.name} index={index} />
                <span className="person-copy">
                  <span className="person-top">
                    <strong>{person.name}</strong>
                    <time dateTime={person.updatedAt}>
                      {time(person.updatedAt)}
                    </time>
                  </span>
                  <span className="person-bottom">
                    <span>{person.lastMessage || "ยังไม่มีข้อความ"}</span>
                    {person.unread > 0 && (
                      <span
                        className="unread-dot"
                        aria-label={`${person.unread} ข้อความยังไม่อ่าน`}
                      />
                    )}
                  </span>
                </span>
              </button>
            ))}
            {visible.length === 0 && (
              <div className="list-empty">
                <p>
                  {query
                    ? "ไม่พบผู้สนทนา"
                    : unreadOnly
                      ? "อ่านข้อความครบแล้ว"
                      : "ยังไม่มีการสนทนา"}
                </p>
                <span>
                  {query
                    ? "ลองค้นหาชื่อหรือรหัสผู้ใช้อีกครั้ง"
                    : unreadOnly
                      ? "เลือกทั้งหมดเพื่อดูประวัติแชท"
                      : "ข้อความจะแสดงที่นี่เมื่อลูกค้าทัก LINE OA"}
                </span>
              </div>
            )}
          </div>
          <footer className="sidebar-footer">
            <span className="dot" />
            {demo
              ? "พื้นที่ทดลองใช้งาน"
              : lastSync
                ? `อัปเดตล่าสุด ${lastSync}`
                : "กำลังเชื่อมต่อ…"}
          </footer>
        </aside>
        <section className="chat" aria-label="บทสนทนา">
          {active ? (
            <>
              <header className="chat-header">
                <button
                  className="icon-button back"
                  aria-label="กลับไปรายชื่อ"
                  onClick={() => setMobileChat(false)}
                >
                  <Icon name="back" />
                </button>
                <Avatar name={active.name} />
                <div>
                  <h2>{active.name}</h2>
                  <p title={active.id}>ผู้ใช้ LINE · {active.id}</p>
                </div>
                <span className="channel">LINE</span>
              </header>
              <div
                className="message-list"
                role="log"
                aria-live="polite"
                aria-label={`ข้อความกับ ${active.name}`}
                aria-busy={loading}
              >
                {loading && <p className="chat-status">กำลังโหลดข้อความ…</p>}
                {!loading && shown.length === 0 && (
                  <p className="chat-status">ยังไม่มีข้อความในการสนทนานี้</p>
                )}
                {shown.map((message, index) => (
                  <div key={message.id}>
                    {(index === 0 ||
                      date(shown[index - 1].createdAt) !==
                        date(message.createdAt)) && (
                      <div className="date-separator">
                        <span>{date(message.createdAt)}</span>
                      </div>
                    )}
                    <div className={`message ${message.direction}`}>
                      <div className="bubble">{message.text}</div>
                      <div className="message-meta">
                        {message.direction === "outgoing" && (
                          <span>
                            {demo ? "ข้อความทดลอง" : "ส่งผ่าน LINE API"}
                          </span>
                        )}
                        <time dateTime={message.createdAt}>
                          {time(message.createdAt)}
                        </time>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={bottom} />
              </div>
              <div className="composer-area">
                <form className="composer" onSubmit={send}>
                  <textarea
                    aria-label={`ข้อความถึง ${active.name}`}
                    placeholder="พิมพ์ข้อความ…"
                    rows={2}
                    maxLength={5000}
                    value={draft}
                    onChange={(e) => {
                      const text = e.target.value;
                      setDrafts((previous) => ({
                        ...previous,
                        [active.id]: text,
                      }));
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        !e.nativeEvent.isComposing
                      ) {
                        e.preventDefault();
                        e.currentTarget.form?.requestSubmit();
                      }
                    }}
                  />
                  <button
                    className="primary send"
                    aria-label={sending ? "กำลังส่ง…" : "ส่งข้อความ"}
                    type="submit"
                    disabled={sending || !draft.trim() || loading}
                  >
                    <span>{sending ? "กำลังส่ง…" : "ส่งข้อความ"}</span>
                    <Icon name="send" width="17" height="17" />
                  </button>
                </form>
                <div className="composer-hint">
                  <span>
                    Enter เพื่อส่ง · Shift + Enter เพื่อขึ้นบรรทัดใหม่
                  </span>
                  <span>{draft.length.toLocaleString()} / 5,000</span>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-chat">
              <span className="empty-icon">
                <Icon name="chat" width="30" height="30" />
              </span>
              <h2>เริ่มที่บทสนทนา</h2>
              <p>เลือกผู้สนทนาด้านซ้ายเพื่ออ่านข้อความและตอบกลับ</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
