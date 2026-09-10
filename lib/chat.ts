export type Conversation = {
  id: string;
  name: string;
  lastMessage: string;
  updatedAt: string;
  unread: number;
};

export type Message = {
  id: string;
  userId: string;
  text: string;
  direction: "incoming" | "outgoing";
  createdAt: string;
};

export const DEMO_PEOPLE: Conversation[] = [
  {
    id: "demo-1",
    name: "พลอย พิมพ์ชนก",
    lastMessage: "อยากสอบถามรายละเอียดเพิ่มเติมค่ะ",
    updatedAt: "2026-09-10T03:24:00Z",
    unread: 1,
  },
  {
    id: "demo-2",
    name: "นนท์ ธนกร",
    lastMessage: "ขอบคุณมากครับ",
    updatedAt: "2026-09-10T02:45:00Z",
    unread: 0,
  },
  {
    id: "demo-3",
    name: "มายด์",
    lastMessage: "เปิดให้บริการกี่โมงคะ",
    updatedAt: "2026-09-09T09:10:00Z",
    unread: 1,
  },
];

export const DEMO_MESSAGES: Message[] = [
  {
    id: "d1",
    userId: "demo-1",
    text: "สวัสดีค่ะ สนใจใช้บริการค่ะ",
    direction: "incoming",
    createdAt: "2026-09-10T03:20:00Z",
  },
  {
    id: "d2",
    userId: "demo-1",
    text: "สวัสดีค่ะ ยินดีให้บริการค่ะ\nสอบถามรายละเอียดได้เลยนะคะ",
    direction: "outgoing",
    createdAt: "2026-09-10T03:21:00Z",
  },
  {
    id: "d3",
    userId: "demo-1",
    text: "อยากสอบถามรายละเอียดเพิ่มเติมค่ะ",
    direction: "incoming",
    createdAt: "2026-09-10T03:24:00Z",
  },
  {
    id: "d4",
    userId: "demo-2",
    text: "ขอบคุณมากครับ",
    direction: "incoming",
    createdAt: "2026-09-10T02:45:00Z",
  },
  {
    id: "d5",
    userId: "demo-3",
    text: "เปิดให้บริการกี่โมงคะ",
    direction: "incoming",
    createdAt: "2026-09-09T09:10:00Z",
  },
];

export function filterConversations(
  people: Conversation[],
  query: string,
  unreadOnly: boolean,
) {
  const term = query.trim().toLocaleLowerCase();
  return people.filter(
    (p) =>
      (!unreadOnly || p.unread > 0) &&
      (!term ||
        p.name.toLocaleLowerCase().includes(term) ||
        p.id.toLocaleLowerCase().includes(term)),
  );
}

export function orderConversations(people: Conversation[]) {
  return [...people].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
}
