# Realtime: WebSockets, Server-Sent Events, WebRTC
tags: websocket socket.io sse realtime chat live multiplayer push webrtc presence sync دردشه مباشر لحظي متعدد لاعبين

Choose: SSE for one-way server → browser streams (notifications, progress, LLM tokens): plain HTTP, auto-reconnect, trivial. WebSocket for two-way low-latency (chat, collaboration, games). WebRTC for peer-to-peer media/data. Polling is fine for "refresh every 30 s".

SSE server (Node): headers `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`; write `data: ${JSON.stringify(x)}\n\n`; send a comment line (`: ping\n\n`) every ~20 s; clean up on `req.on("close")`. Browser: `const es = new EventSource("/events"); es.onmessage = e => …`. For POST + streaming use `fetch` and read `res.body.getReader()`.

WebSocket (ws):
```js
import { WebSocketServer } from "ws";
const wss = new WebSocketServer({ server });
wss.on("connection", (ws, req) => { ws.on("message", (raw) => { const msg = JSON.parse(raw); /* validate, route by msg.type */ }); ws.on("close", () => {/* leave rooms */}); });
```
Protocol: JSON envelopes `{ type, payload, id }`; authenticate at connection (cookie or a short-lived token in the first message — not a long-lived secret in the URL); validate every message; rooms as `Map<roomId, Set<ws>>`; heartbeat ping/pong and drop dead sockets; client reconnects with exponential backoff + jitter and resyncs state after reconnect; apply back-pressure (check `bufferedAmount`). Socket.IO adds rooms, acks and fallbacks if you want them ready-made.

Scaling beyond one process: sticky sessions + a pub/sub backplane (Redis) so every node can broadcast to every room.

Multiplayer games: authoritative server simulating at a fixed tick; clients send inputs, not positions; client-side prediction + reconciliation; interpolate other players between snapshots; send deltas, not full state.

Collaboration: CRDTs (Yjs, Automerge) for concurrent edits with offline support; presence (cursors, who is online) over an ephemeral channel.

WebRTC: signalling over your own WebSocket (offer/answer/ICE candidates), STUN for NAT discovery, TURN relay for strict networks; `getUserMedia` for camera/mic; data channels for peer-to-peer messages.
