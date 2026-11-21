/**
 * A LIVE PARK ROOM — one Durable Object per invite link.
 *
 * It only relays. It holds the open connections for one room, checks every
 * message against the shared rules (src/domain/parkProtocol.ts), and passes
 * it on. It stores no dog: each browser stays the keeper of its own dog, and
 * the room is gone when the last person leaves.
 *
 * Connections use the WebSocket Hibernation API, so a quiet room costs
 * nothing while it waits; what a connection must remember (its dog, its
 * last intent, its rate window) lives in the socket's attachment, which
 * survives hibernation.
 */

import { MAX_DOGS, parseClient, withinRate, type LiveDog, type LiveIntent, type ServerMessage } from '../src/domain/parkProtocol';

interface Seat {
  id: string | null;
  dog: LiveDog | null;
  intent: LiveIntent | null;
  rate: { start: number; count: number };
}

/** The parts of the Durable Object state this room uses. */
export interface RoomState {
  acceptWebSocket(ws: WebSocket): void;
  getWebSockets(): WebSocket[];
}

type HibernatingSocket = WebSocket & {
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
};

declare const WebSocketPair: { new (): { 0: WebSocket; 1: WebSocket } };

/** Open connections one room will hold, seated or not: every dog, plus as many again still saying hello. */
export const MAX_SOCKETS = MAX_DOGS * 2;

const seatOf = (ws: WebSocket): Seat =>
  ((ws as HibernatingSocket).deserializeAttachment() as Seat | null) ?? { id: null, dog: null, intent: null, rate: { start: 0, count: 0 } };
const keep = (ws: WebSocket, seat: Seat) => (ws as HibernatingSocket).serializeAttachment(seat);
const send = (ws: WebSocket, message: ServerMessage) => {
  try {
    ws.send(JSON.stringify(message));
  } catch {
    /* the other end is gone; its close event will tidy up */
  }
};

export class ParkRoom {
  constructor(private state: RoomState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const pair = new WebSocketPair();
    // Connections that never say hello hold a socket too. At the cap the room
    // lets go of the oldest one that has no dog, so idle connections can never
    // lock a real dog (or a dog reconnecting to its own seat) out of the park.
    // Only a room with no idle connection to give up answers "full".
    const open = this.state.getWebSockets();
    const idle = open.length >= MAX_SOCKETS ? open.find((ws) => seatOf(ws).id === null) : undefined;
    if (idle) idle.close(1000, 'Idle');
    if (open.length >= MAX_SOCKETS && !idle) {
      (pair[1] as WebSocket & { accept(): void }).accept();
      send(pair[1], { t: 'full' });
      pair[1].close(1000, 'Room full');
      return new Response(null, { status: 101, webSocket: pair[0] } as ResponseInit);
    }
    this.state.acceptWebSocket(pair[1]);
    keep(pair[1], { id: null, dog: null, intent: null, rate: { start: Date.now(), count: 0 } });
    return new Response(null, { status: 101, webSocket: pair[0] } as ResponseInit);
  }

  private others(ws: WebSocket) {
    return this.state.getWebSockets().filter((other) => other !== ws && seatOf(other).id);
  }

  private broadcast(from: WebSocket, message: ServerMessage) {
    for (const other of this.others(from)) send(other, message);
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const seat = seatOf(ws);
    // A flooding or malformed connection is cut off, not argued with.
    if (!withinRate(seat.rate, Date.now())) {
      ws.close(1008, 'Too many messages');
      return;
    }
    const message = typeof raw === 'string' ? parseClient(raw) : null;
    if (!message) {
      keep(ws, seat);
      send(ws, { t: 'error', reason: 'That message was not understood.' });
      return;
    }

    if (message.t === 'hello') {
      if (seat.id) {
        keep(ws, seat); // a repeated hello changes nothing, but it still spends the rate budget
        return;
      }
      const present = this.others(ws);
      // The seat this browser is about to replace does not count against the room.
      if (present.filter((other) => seatOf(other).id !== message.id).length >= MAX_DOGS) {
        send(ws, { t: 'full' });
        ws.close(1000, 'Room full');
        return;
      }
      // A browser that reconnects with the same id replaces its old seat.
      // The old seat gives up the id first: its close event must not announce
      // that the dog now held by this connection has left.
      for (const other of present) {
        const old = seatOf(other);
        if (old.id !== message.id) continue;
        old.id = null;
        keep(other, old);
        other.close(1000, 'Replaced');
      }
      seat.id = message.id;
      seat.dog = message.dog;
      keep(ws, seat);
      send(ws, {
        t: 'roster',
        dogs: this.others(ws).map((other) => {
          const s = seatOf(other);
          return { id: s.id!, dog: s.dog!, intent: s.intent };
        }),
      });
      this.broadcast(ws, { t: 'join', id: message.id, dog: message.dog });
      return;
    }

    if (!seat.id) {
      keep(ws, seat);
      return; // nothing counts before a hello
    }

    if (message.t === 'intent') {
      const { t: _t, ...intent } = message;
      seat.intent = intent;
      keep(ws, seat);
      this.broadcast(ws, { t: 'intent', id: seat.id, ...intent });
      return;
    }

    keep(ws, seat);
    if (message.t === 'pet') {
      if (!this.others(ws).some((other) => seatOf(other).id === message.target)) return;
      const by = seat.dog?.owner ?? 'Someone';
      this.broadcast(ws, { t: 'pet', target: message.target, by });
      return;
    }

    if (message.t === 'home') {
      this.broadcast(ws, { t: 'leave', id: seat.id, hungry: message.hungry });
      seat.id = null;
      keep(ws, seat);
      ws.close(1000, 'Went home');
    }
  }

  async webSocketClose(ws: WebSocket) {
    const seat = seatOf(ws);
    if (!seat.id) return;
    // Another live connection holding this id means the dog is still here.
    if (this.others(ws).some((other) => seatOf(other).id === seat.id)) return;
    this.broadcast(ws, { t: 'leave', id: seat.id, hungry: false });
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }
}
