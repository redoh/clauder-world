import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { Pubby, type PresenceChannel } from "@getpubby/sdk";
import { observePresenceMembers, type PresenceMember } from "../lib/presence";

// Exercise the real SDK's wire-format handling without a network or browser.
class TestSocket {
  static latest: TestSocket;
  onmessage?: (event: { data: string }) => void;
  constructor() { TestSocket.latest = this; }
  close() {}
  receive(event: string, data: unknown) {
    this.onmessage?.({ data: JSON.stringify({ event, channel: "presence-world", data }) });
  }
}

function setup(t: TestContext) {
  const original = globalThis.WebSocket;
  globalThis.WebSocket = TestSocket as unknown as typeof WebSocket;
  t.after(() => { globalThis.WebSocket = original; });
  t.mock.method(console, "log", () => {});
  const client = new Pubby("test-key", { wsHost: "wss://example.invalid" });
  client.connect();
  t.after(() => client.disconnect());
  const channel = client.subscribe("presence-world") as PresenceChannel;
  let members: PresenceMember[] = [];
  const stop = observePresenceMembers(channel, (next) => { members = next; });
  t.after(stop);
  return { channel, socket: TestSocket.latest, stop, members: () => members };
}

test("the first viewer survives a second user joining, leaving and rejoining", (t) => {
  const s = setup(t);
  s.socket.receive("pusher_internal:subscription_succeeded", {
    presence: { ids: ["first"], hash: { first: { name: "First User" } } },
  });
  assert.deepEqual(s.members().map((m) => m.id), ["first"]);

  const joined = { user_id: "second", user_info: { name: "Second User" } };
  s.socket.receive("pusher_internal:member_added", JSON.stringify(joined));
  assert.deepEqual(s.members().map((m) => [m.id, m.info.name.split(" ")[0]]), [
    ["first", "First"], ["second", "Second"],
  ]);
  s.socket.receive("pusher_internal:member_added", joined);
  assert.equal(s.members().length, 2);
  s.socket.receive("pusher_internal:member_removed", JSON.stringify({ user_id: "second" }));
  assert.deepEqual(s.members().map((m) => m.id), ["first"]);
  s.socket.receive("pusher_internal:member_added", joined);
  assert.equal(s.members().length, 2);

  // A fresh subscription replaces stale members after a reconnect.
  s.socket.receive("pusher_internal:subscription_succeeded", {
    presence: { ids: ["second"], hash: { second: joined.user_info } },
  });
  assert.deepEqual(s.members().map((m) => m.id), ["second"]);
});

test("incomplete member profiles remain safe for character rendering", (t) => {
  const s = setup(t);
  for (const [id, info] of Object.entries({ missing: null, empty: {}, wrong: { name: 42 }, blank: { name: " " } })) {
    s.socket.receive("pusher_internal:member_added", { user_id: id, user_info: info });
  }
  s.socket.receive("pusher_internal:member_added", { user_info: { name: "No ID" } });
  assert.equal(s.members().length, 4);
  for (const member of s.members()) {
    assert.equal(typeof member.id, "string");
    assert.equal(member.info.name.split(" ")[0], "Clauder");
  }
});

test("observer cleanup preserves other listeners on the same channel", (t) => {
  const s = setup(t);
  let calls = 0;
  s.channel.bind("pusher:member_added", () => { calls++; });
  s.stop();
  s.socket.receive("pusher_internal:member_added", { user_id: "second", user_info: { name: "Second" } });
  assert.equal(calls, 1);
  assert.deepEqual(s.members(), []);
});
