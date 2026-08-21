// relay-inbox.cjs  (repo root)
//
// Shared in-memory FIFO inbox for the phone-agent relay, used by BOTH:
//   - apps/discord (producer: MessageCreate -> pushRelayMessage)
//   - railway/health.cjs (consumer: GET /inbox -> drainRelayInbox)
//
// Written as CommonJS so BOTH health.cjs (CJS require) and gateway.ts (tsx/ESM,
// which can default-import a CJS module) can share the SAME module instance
// living in the same container (the bot is a child of health.cjs).
//
// Wire contract (matches the phone's RelayClient.kt):
//   GET  /inbox  -> { messages:[{id,author_id,author_name,channel_id,guild_id,content,mentions_bot,created_at}], count }
//   POST /reply  -> { channel_id, content } -> { ok:true, message_id } | { ok:false, error }

const MAX_INBOX = 500;

/** @type {Array<{id:string,author_id:string,author_name:string,channel_id:string,guild_id:string|null,content:string,mentions_bot:boolean,created_at:number}>} */
const inbox = [];

function pushRelayMessage(m) {
  inbox.push(m);
  if (inbox.length > MAX_INBOX) inbox.splice(0, inbox.length - MAX_INBOX);
}

function drainRelayInbox(afterId) {
  if (afterId == null) return inbox.slice();
  const idx = inbox.findIndex((m) => m.id === afterId);
  if (idx < 0) return inbox.slice();
  return inbox.slice(idx + 1);
}

function relayInboxSize() {
  return inbox.length;
}

function clearRelayInbox() {
  inbox.length = 0;
}

module.exports = {
  pushRelayMessage,
  drainRelayInbox,
  relayInboxSize,
  clearRelayInbox,
};
