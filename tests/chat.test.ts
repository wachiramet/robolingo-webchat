import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_PEOPLE,
  filterConversations,
  orderConversations,
} from "../lib/chat.ts";
test("search trims whitespace and combines unread filter", () => {
  assert.equal(
    filterConversations(DEMO_PEOPLE, "  พลอย ", true)[0].id,
    "demo-1",
  );
  assert.equal(filterConversations(DEMO_PEOPLE, "นนท์", true).length, 0);
  assert.equal(
    filterConversations(DEMO_PEOPLE, "DEMO-2", false)[0].id,
    "demo-2",
  );
  assert.equal(filterConversations(DEMO_PEOPLE, "ไม่มี", false).length, 0);
});
test("sort latest first without mutating input", () => {
  const original = [...DEMO_PEOPLE].reverse();
  assert.equal(orderConversations(original)[0].id, "demo-1");
  assert.equal(original[0].id, "demo-3");
});
