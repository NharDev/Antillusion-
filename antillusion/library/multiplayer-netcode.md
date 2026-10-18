# Multiplayer netcode: topologies, tick rate, prediction, reconciliation, interpolation, lag compensation, rollback, libraries
tags: multiplayer netcode networking online server client authoritative p2p peer relay tick rate snapshot prediction reconciliation interpolation lag compensation lockstep rollback ggpo delta compression interest management cheat anti-cheat websocket webrtc webtransport udp colyseus geckos socket.io nakama playfab photon fusion quantum netcode for gameobjects mirror fishnet godot multiplayer unreal replication steam networking eos lobby matchmaking reconnect لعبه العاب متعدد لاعبين شبكه خادم سيرفر عميل اتصال تاخير غش غرفه مطابقه

## Topologies
| Topology | How | Pros | Cons | Use |
|---|---|---|---|---|
| Authoritative dedicated server | server simulates, clients send inputs | cheat-resistant, one truth, scales | hosting cost, ops | competitive, persistent, >4 players |
| Listen server / host | one player's game is the server | no hosting cost | host advantage, host leaving ends match (needs migration), NAT | co-op, casual |
| P2P (mesh) | every peer talks to every peer | no server | NAT traversal, cheating, O(n²) traffic | 2–4 player fighting/co-op (with rollback/lockstep) |
| Relay | server just forwards packets (Steam Datagram Relay, EOS, Photon, TURN) | NAT-proof, hides IPs | adds latency, no authority | P2P/host games that must "just connect" |

## Transport
- **WebSocket (TCP)**: easy, everywhere; ordered + reliable → head-of-line blocking spikes on packet loss. Fine for turn-based, casual, ≤ ~20 Hz action.
- **WebRTC DataChannel** (`ordered: false, maxRetransmits: 0`): UDP-like in browsers; needs signalling + STUN/TURN. Geckos.io wraps server-side Node ↔ browser.
- **WebTransport**: datagrams + streams over HTTP/3 where supported; check browser support before relying on it.
- Native: UDP with a reliability layer — ENet, GameNetworkingSockets (Valve, open source), Unity Transport, engines' built-ins.
- Message design: binary (DataView / flatbuffers / msgpack) for state; JSON is fine for prototypes and lobbies.

## Tick rate and send rate
| Game type | Server sim | Snapshot send | Client input send |
|---|---|---|---|
| Turn-based / board | event-driven | on change | on action |
| Casual web action / io games | 20–30 Hz | 10–20 Hz | 30–60 Hz (or batched per tick) |
| Co-op shooter / action | 30–60 Hz | 20–30 Hz | every frame, batched |
| Competitive shooter | 60–128 Hz | 60–128 Hz | every frame |
| Fighting (rollback) | 60 Hz lockstep frames | inputs only | every frame |
Fixed timestep simulation on both sides (`dt = 1/tick`); never simulate with render delta.

## Client-side prediction + server reconciliation (own player)
1. Client samples input each tick, tags it with `seq`, **applies it locally** immediately, stores it in `pending`, sends it.
2. Server applies inputs in order (validated), and in each snapshot includes `lastProcessedSeq` per player.
3. On snapshot: set own state = server state, drop `pending` with `seq ≤ lastProcessedSeq`, **re-apply remaining pending inputs**. If the corrected position differs by a small amount, smooth the visual offset over 100–200 ms instead of snapping; snap if > ~2 m/1 tile.
The movement function must be **the same code** on client and server (shared module).

## Entity interpolation (other players)
Buffer snapshots with timestamps; render others at `renderTime = now − interpDelay` where `interpDelay ≈ 2 × snapshotInterval` (e.g. 100 ms at 20 Hz). Lerp position, slerp rotation between the two snapshots around `renderTime`. If the buffer runs dry, extrapolate ≤ 100–250 ms then freeze. Use server time (estimated with ping: `serverTime ≈ localTime + offset`, offset smoothed).

## Lag compensation (hit detection)
Server keeps ~1 s history of hitbox positions per tick. When a shot arrives, rewind targets to the time the shooter saw (`now − rtt/2 − interpDelay`), raycast, restore. Cap rewind (~200–250 ms) so high-ping players can't shoot far into the past; accept "shot around the corner" as the trade-off. Projectiles: spawn server-side with the shooter's latency fast-forwarded.

## Lockstep vs rollback
- **Deterministic lockstep**: send only inputs; every peer simulates frame N once all inputs for N arrive. Tiny bandwidth, any number of units (RTS). Needs bit-exact determinism (fixed-point or careful floats, same order of iteration, seeded RNG) and an input delay (100–200 ms) → feels laggy for action. Desync detection: hash state every N frames.
- **Rollback (GGPO-style)**: small input delay (1–3 frames); predict remote input (= last known); when the real input arrives and differs, **load saved state from that frame and re-simulate** to the present in one render frame. Needs fast save/load of the whole sim state, determinism, and sim cheap enough to run ~7–8 frames in one frame. Standard for fighting games and small-player-count action. Libraries: GGPO (C++), GGRS (Rust/Bevy), Photon Quantum (Unity), engine-specific rollback addons.

## Bandwidth: delta compression, quantisation, interest
- **Delta snapshots**: diff against the last snapshot the client **acked**; send only changed fields/entities; full snapshot on join/resync.
- **Quantise**: positions to centimetres in int16/int32 relative to a region, angles to 8–16 bits, velocities clamped; booleans as bitflags; entity ids as varints.
- **Interest management / relevancy**: only replicate entities within an area of interest (spatial grid, radius 1–2 screens), lower update rate for far/unimportant entities (priority accumulator), and **never send hidden info** (fog of war, enemies behind walls far away) — it's also your best anti-wallhack.
- Budget example: 30 players × 20 Hz × ~20 bytes = ~12 KB/s per client — fine. Watch MTU (~1200 bytes per UDP packet for safety).

## Never trust the client
- Client sends **intent** (inputs, "use item 3"), never results ("I'm at x", "I have 999 gold", "I hit for 500").
- Server validates: movement speed/teleport, cooldowns, ammo, line of sight, range, inventory ownership, trade atomicity, message rate (rate-limit and drop/kick flooders), message size, schema (validate every field type/range).
- Server-side RNG for drops/crits; economy and progression on the server/DB; authoritative timers.
- Obfuscation and client anti-cheat only raise the bar; server authority is the actual defence. Log suspicious events; replays help moderation.

## Lobbies, matchmaking, reconnect
- Lobby: create/join by code (5–6 chars from an unambiguous alphabet: no 0/O/1/I), public list with filters, host settings, ready check, chat (with platform privacy settings).
- Matchmaking: queue by region (ping < ~80–100 ms preferred) and skill (Elo/Glicko-2/TrueSkill/OpenSkill), widen ranges with wait time (e.g. every 10 s), backfill dropped slots.
- Heartbeat/ping every 1 s; timeout 5–10 s. On disconnect keep the player's slot and entity for 30–120 s; reconnect with a session token → server sends a full snapshot → client resumes prediction. Make the token single-use and bound to the account.
- Hosting: one process per room/match, regions near players; orchestration options include Agones (Kubernetes), Edgegap, PlayFab Multiplayer Servers, or plain VMs/containers (Fly.io etc.).

## Libraries and services
| Library / service | Model | Notes |
|---|---|---|
| **Colyseus** (Node) | authoritative rooms | room lifecycle, matchmaking, automatic state sync via `@colyseus/schema` (delta-encoded), JS/Unity/Defold/Godot clients |
| **Geckos.io** | Node server ↔ browser WebRTC | unreliable/unordered UDP-like channels for real-time web games |
| **Socket.IO / ws** | raw messaging over WebSocket | build your own authority; `ws` is minimal and fast, Socket.IO adds rooms/reconnect/fallbacks |
| **Nakama** (Heroic Labs, open source) | game backend | auth, accounts, storage, leaderboards, matchmaker, realtime authoritative matches (Go/Lua/TS) |
| **PlayFab** (Microsoft) | backend-as-a-service | accounts, economy, leaderboards, multiplayer servers hosting |
| **Photon** | cloud relay + frameworks | Fusion (state sync, prediction, Unity), Quantum (deterministic rollback ECS, Unity), Realtime/PUN (older) |
| **Unity Netcode for GameObjects** | server-authoritative / host | NetworkObject, NetworkVariable, RPCs; Unity Transport; pair with Unity Relay/Lobby |
| **Mirror / FishNet** (Unity, open source) | server-authoritative | Mirror: `[SyncVar]`, `[Command]`, `[ClientRpc]`; FishNet: built-in prediction, lag compensation |
| **Godot high-level multiplayer** | authority per node | `ENetMultiplayerPeer` (also WebSocket/WebRTC peers for web), `@rpc`, MultiplayerSpawner, MultiplayerSynchronizer |
| **Unreal replication** | server-authoritative | replicated properties, RPCs, relevancy; Character Movement has prediction built in |
| **Steam Networking Sockets / Messages** | P2P + relay (SDR) | NAT-free relay, IPs hidden, lobbies via Steam matchmaking; Steam only |
| **Epic Online Services (EOS)** | free cross-platform services | P2P relay, lobbies, sessions, voice, accounts across stores/platforms |

## Godot 4 sketch
```gdscript
func host(port := 7777) -> void:
    var peer := ENetMultiplayerPeer.new(); peer.create_server(port, 8)
    multiplayer.multiplayer_peer = peer
    multiplayer.peer_connected.connect(func(id): $Spawner.spawn(id))   # MultiplayerSpawner with spawn_function
func join(ip: String, port := 7777) -> void:
    var peer := ENetMultiplayerPeer.new(); peer.create_client(ip, port)
    multiplayer.multiplayer_peer = peer
# on the player scene: set_multiplayer_authority(peer_id) for input; a MultiplayerSynchronizer replicates position.
@rpc("any_peer", "call_local", "reliable")
func request_fire(dir: Vector2) -> void:
    if not multiplayer.is_server(): return
    var sender := multiplayer.get_remote_sender_id()   # validate cooldown/ammo for this sender
```

## Unreal sketch (concepts)
Mark properties `UPROPERTY(ReplicatedUsing=OnRep_Health)` and register them in `GetLifetimeReplicatedProps` with `DOREPLIFETIME`; client → server requests as `UFUNCTION(Server, Reliable)` RPCs, server → all as `NetMulticast`, server → owner as `Client`. Gameplay logic runs where `HasAuthority()` is true. Tune `NetUpdateFrequency` and relevancy per actor.

## Minimal authoritative Node server (`ws`) with client prediction
```js
// server.js — node server.js   (npm i ws)
import { WebSocketServer } from 'ws';
const TICK = 30, SPEED = 200, players = new Map(); let nextId = 1;
export function step(p, input, dt) {                                  // SHARED with the client
  const len = Math.hypot(input.x, input.y) || 1;
  p.x += (input.x / len) * SPEED * dt; p.y += (input.y / len) * SPEED * dt;
  p.x = Math.max(0, Math.min(800, p.x)); p.y = Math.max(0, Math.min(600, p.y));
}
const wss = new WebSocketServer({ port: 8080 });
wss.on('connection', (ws) => {
  const p = { id: nextId++, x: 400, y: 300, lastSeq: 0, queue: [] }; players.set(ws, p);
  ws.send(JSON.stringify({ t: 'welcome', id: p.id }));
  ws.on('message', (raw) => { let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t !== 'in' || !Number.isInteger(m.seq) || m.seq <= p.lastSeq || p.queue.length > 60) return; // validate + rate-limit
    p.queue.push({ seq: m.seq, x: Math.sign(m.x) | 0, y: Math.sign(m.y) | 0 }); });          // clamp input to -1/0/1
  ws.on('close', () => players.delete(ws));
});
setInterval(() => {
  for (const p of players.values()) { for (const i of p.queue) { step(p, i, 1 / TICK); p.lastSeq = i.seq; } p.queue.length = 0; }
  const snap = JSON.stringify({ t: 'snap', time: Date.now(), ps: [...players.values()].map(({ id, x, y, lastSeq }) => ({ id, x, y, lastSeq })) });
  for (const ws of players.keys()) if (ws.readyState === 1) ws.send(snap);
}, 1000 / TICK);
```
```js
// client.js — predict self, reconcile on snapshot, interpolate others
const ws = new WebSocket('ws://localhost:8080'); let myId, seq = 0; const me = { x: 400, y: 300 }, pending = [], buffers = new Map();
ws.onmessage = ({ data }) => { const m = JSON.parse(data);
  if (m.t === 'welcome') myId = m.id;
  if (m.t !== 'snap') return;
  for (const s of m.ps) {
    if (s.id === myId) { me.x = s.x; me.y = s.y;                              // server truth…
      while (pending.length && pending[0].seq <= s.lastSeq) pending.shift();
      for (const i of pending) step(me, i, 1 / 30); }                         // …then replay unacked inputs
    else { const b = buffers.get(s.id) ?? []; b.push({ time: m.time, x: s.x, y: s.y }); if (b.length > 30) b.shift(); buffers.set(s.id, b); }
  } };
setInterval(() => {                                                           // fixed 30 Hz input tick, same as server
  const i = { seq: ++seq, x: keys.right - keys.left, y: keys.down - keys.up };
  step(me, i, 1 / 30); pending.push(i);
  if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'in', ...i }));
}, 1000 / 30);
function otherAt(b, renderTime) {                                             // renderTime = serverNow() - 100
  for (let k = b.length - 1; k > 0; k--) if (b[k - 1].time <= renderTime) {
    const a = b[k - 1], c = b[k], t = Math.min(1, (renderTime - a.time) / (c.time - a.time || 1));
    return { x: a.x + (c.x - a.x) * t, y: a.y + (c.y - a.y) * t }; }
  return b[0];
}
```
Production upgrades: binary messages, delta snapshots, server time sync (ping/pong offset) instead of `Date.now()` across machines, visual smoothing of corrections, interest management, reconnect tokens, one process per room.
