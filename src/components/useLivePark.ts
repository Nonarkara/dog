/**
 * LIVE PARK — the browser's side of a room.
 *
 * Opens the room's WebSocket, says hello with only what the park draws (see
 * src/domain/parkProtocol.ts), and turns room messages into park actions:
 * a friend's dog appears, walks where its owner's browser says, is petted,
 * goes home. Your own dog's decisions go the other way.
 *
 * The park scene can be rebuilt at any time (a resize, a coat change), so the
 * hook keeps the room's current state and re-applies it whenever the scene
 * reports ready (`resync`).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ParkApi } from './IllustratedPark';
import type { MetaverseNeighborDog } from '../types/dog';
import { newLiveId, parseDog, parseIntent, type LiveDog, type LiveIntent, type ServerMessage } from '../domain/parkProtocol';

export type LiveStatus = 'off' | 'connecting' | 'live' | 'full' | 'lost';

const LIVE_ID_KEY = 'tama_dog_chi_live_id';
export function liveId(): string {
  try {
    const saved = localStorage.getItem(LIVE_ID_KEY);
    if (saved && /^[a-z0-9]{16}$/.test(saved)) return saved;
    const id = newLiveId();
    localStorage.setItem(LIVE_ID_KEY, id);
    return id;
  } catch {
    return newLiveId();
  }
}

interface Options {
  room: string | null;
  me: LiveDog | null;
  /** The park scene. The simple 3D fallback view cannot steer or cheer, so those are optional. */
  scene: () => (Pick<ParkApi, 'spawnNeighbor' | 'removeNeighbor'> & Partial<Pick<ParkApi, 'steer' | 'cheer'>>) | null;
  /** A household dog with the same drawing, so a friend's Mali replaces ours rather than doubling it. */
  packDog: (art: string) => MetaverseNeighborDog | undefined;
  hungry: () => boolean;
  onPetted: (by: string) => void;
  onNote: (text: string) => void;
}

interface Friend { dog: LiveDog; intent: LiveIntent | null; }

const sceneId = (id: string) => `live-${id}`;
const labelFor = (d: LiveDog) => (d.owner === `${d.name}'s person` ? d.name : `${d.name} · ${d.owner}`);

export function useLivePark({ room, me, scene, packDog, hungry, onPetted, onNote }: Options) {
  const [status, setStatus] = useState<LiveStatus>('off');
  const [friends, setFriends] = useState<Record<string, Friend>>({});
  const friendsRef = useRef<Record<string, Friend>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const opts = useRef({ scene, packDog, hungry, onPetted, onNote });
  opts.current = { scene, packDog, hungry, onPetted, onNote };
  const myId = useRef(liveId()).current;
  const meKey = me ? JSON.stringify(me) : '';

  const commit = (next: Record<string, Friend>) => {
    friendsRef.current = next;
    setFriends(next);
  };

  /** Put one friend's dog into the scene (or update it). */
  const place = (id: string, f: Friend) => {
    const api = opts.current.scene();
    if (!api) return;
    const twin = f.dog.art ? opts.current.packDog(f.dog.art) : undefined;
    if (twin) api.removeNeighbor(twin.id);
    api.spawnNeighbor({
      id: sceneId(id), name: labelFor(f.dog), breed: f.dog.breed, tribe: 'Live', ownerName: f.dog.owner, personality: '',
      avatarColors: { base: f.dog.coat.base, secondary: f.dog.coat.light, mask: f.dog.coat.dark },
      earShape: 'pricked', position: [0, 0, 0], action: 'walking', speed: 0, artId: f.dog.art || undefined, remote: true,
    });
    if (f.intent) api.steer?.(sceneId(id), f.intent);
  };

  const unplace = (id: string, f: Friend) => {
    const api = opts.current.scene();
    if (!api) return;
    api.removeNeighbor(sceneId(id));
    const twin = f.dog.art ? opts.current.packDog(f.dog.art) : undefined;
    // Bring our own household dog back, unless another friend still has that dog here.
    if (twin && !Object.values(friendsRef.current).some((o) => o.dog.art === f.dog.art)) api.spawnNeighbor(twin);
  };

  /** The scene was (re)built: draw everyone who is in the room. */
  const resync = useCallback(() => {
    for (const [id, f] of Object.entries(friendsRef.current)) place(id, f);
  }, []);

  useEffect(() => {
    if (!room || !me) {
      setStatus('off');
      return;
    }
    let closedByUs = false, retries = 0, timer = 0;
    const connect = () => {
      setStatus('connecting');
      const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/park/${encodeURIComponent(room)}`);
      wsRef.current = ws;
      ws.onopen = () => {
        retries = 0;
        ws.send(JSON.stringify({ t: 'hello', id: myId, dog: me }));
        setStatus('live');
      };
      ws.onmessage = (event) => {
        let m: ServerMessage;
        try {
          m = JSON.parse(String(event.data));
        } catch {
          return;
        }
        const o = opts.current;
        // What the room says is still checked: a room is only as honest as its peers.
        if (m.t === 'roster') {
          const next: Record<string, Friend> = {};
          for (const entry of m.dogs ?? []) {
            const dog = parseDog(entry.dog);
            if (!dog || entry.id === myId) continue;
            next[entry.id] = { dog, intent: entry.intent ? parseIntent(entry.intent as unknown as Record<string, unknown>) : null };
          }
          for (const [id, f] of Object.entries(friendsRef.current)) if (!next[id]) unplace(id, f);
          commit(next);
          for (const [id, f] of Object.entries(next)) place(id, f);
        } else if (m.t === 'join') {
          const dog = parseDog(m.dog);
          if (!dog || m.id === myId) return;
          const f = { dog, intent: null };
          commit({ ...friendsRef.current, [m.id]: f });
          place(m.id, f);
          o.onNote(`${dog.name} came to the park.`);
        } else if (m.t === 'intent') {
          const f = friendsRef.current[m.id];
          const intent = parseIntent(m as unknown as Record<string, unknown>);
          if (!f || !intent) return;
          friendsRef.current = { ...friendsRef.current, [m.id]: { ...f, intent } };
          o.scene()?.steer?.(sceneId(m.id), intent);
        } else if (m.t === 'pet') {
          if (m.target === myId) o.onPetted(String(m.by).slice(0, 32));
          else o.scene()?.cheer?.(sceneId(m.target));
        } else if (m.t === 'leave') {
          const f = friendsRef.current[m.id];
          if (!f) return;
          const rest = { ...friendsRef.current };
          delete rest[m.id];
          commit(rest);
          unplace(m.id, f);
          o.onNote(m.hungry ? `${f.dog.name} went home for dinner.` : `${f.dog.name} went home.`);
        } else if (m.t === 'full') {
          closedByUs = true;
          setStatus('full');
          o.onNote('That park is full: eight dogs is the most one park holds.');
        }
      };
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (closedByUs) return;
        // A dropped connection (a train tunnel, a sleeping laptop) tries again a few times.
        if (retries < 5) {
          retries += 1;
          setStatus('connecting');
          timer = window.setTimeout(connect, 2000 * retries);
        } else setStatus('lost');
      };
    };
    connect();
    return () => {
      closedByUs = true;
      clearTimeout(timer);
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'home', hungry: opts.current.hungry() }));
      ws?.close();
      wsRef.current = null;
      for (const [id, f] of Object.entries(friendsRef.current)) unplace(id, f);
      commit({});
    };
    // The connection is per room and per dog; callbacks are read through a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, meKey]);

  const send = (message: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  };

  return {
    status,
    friends,
    resync,
    sendIntent: (intent: LiveIntent) => send({ t: 'intent', ...intent }),
    petFriend: (sceneDogId: string) => send({ t: 'pet', target: sceneDogId.replace(/^live-/, '') }),
  };
}
