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
      if (seat.id) return;
      const present = this.others(ws);
      if (present.length >= MAX_DOGS) {
        send(ws, { t: 'full' });
        ws.close(1000, 'Room full');
        return;
      }
      // A browser that reconnects with the same id replaces its old seat.
      for (const other of present) if (seatOf(other).id === message.id) other.close(1000, 'Replaced');
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
    if (seat.id) this.broadcast(ws, { t: 'leave', id: seat.id, hungry: false });
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }
}
