/**
 * LIVE PARK — the message rules.
 *
 * One file, used by both the room server (worker/parkRoom.ts) and the
 * browser, so the two can never disagree about what a valid message is.
 *
 * Dogs are synced by INTENTION, not by frame: a browser says what its dog
 * decided ("walking to x,y", "lying down", "petted", "going home") and every
 * screen animates the walk itself. A message every few seconds per dog.
 *
 * Privacy: only what is drawn in the park crosses the wire — a dog's name,
 * breed and look, what it is doing, and a nickname. Never the record
 * (microchip, vet, phone, medical history, birth date).
 */

export const MAX_DOGS = 8;
export const MAX_MESSAGE_BYTES = 1024;
/** Messages allowed per connection in a 10-second window. */
export const RATE_LIMIT = 40;
/** The park's walkable world, in park units (matches IllustratedPark's widest roam). */
export const WORLD = { minX: -420, maxX: 420, minY: -250, maxY: 620 };

export const MODES = ['wander', 'visit', 'chase', 'flee', 'rest', 'sit', 'feed', 'nap', 'walkto'] as const;
export type LiveMode = (typeof MODES)[number];

export interface LiveDog {
  name: string;
  breed: string;
  /** A starter dog's illustration id (e.g. "expo-2021"), or "" for a custom coat. */
  art: string;
  coat: { base: string; light: string; dark: string };
  /** How the owner wants to be shown, e.g. "Expo's person". */
  owner: string;
}

export interface LiveIntent {
  x: number;
  y: number;
  mode: LiveMode;
  hungry: boolean;
  asleep: boolean;
}

/** Browser → room. */
export type ClientMessage =
  | { t: 'hello'; id: string; dog: LiveDog }
  | ({ t: 'intent' } & LiveIntent)
  | { t: 'pet'; target: string }
  | { t: 'home'; hungry: boolean };

/** Room → browser. */
export type ServerMessage =
  | { t: 'roster'; dogs: { id: string; dog: LiveDog; intent: LiveIntent | null }[] }
  | { t: 'join'; id: string; dog: LiveDog }
  | ({ t: 'intent'; id: string } & LiveIntent)
  | { t: 'pet'; target: string; by: string }
  | { t: 'leave'; id: string; hungry: boolean }
  | { t: 'full' }
  | { t: 'error'; reason: string };

const ROOM_RE = /^[a-z0-9]+(?:-[a-z0-9]+){1,4}$/;
export const validRoom = (room: string): boolean => room.length >= 8 && room.length <= 40 && ROOM_RE.test(room);

const ID_RE = /^[a-z0-9]{8,32}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const ART = ['', 'expo-2021', 'mali-2022', 'oreo-frenchie', 'paolo-pug', 'shiba-chai'];

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  // No control characters, no markup brackets: these strings are drawn as text.
  const clean = v.replace(/[\u0000-\u001f\u007f<>]/g, '').trim();
  return clean.length >= 1 && clean.length <= max ? clean : null;
};
const num = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null;

export function parseDog(v: unknown): LiveDog | null {
  if (!v || typeof v !== 'object') return null;
  const d = v as Record<string, unknown>;
  const coat = d.coat as Record<string, unknown> | undefined;
  const name = text(d.name, 24), breed = text(d.breed, 40), owner = text(d.owner, 32);
  const art = typeof d.art === 'string' && ART.includes(d.art) ? d.art : null;
  if (!name || !breed || !owner || art === null || !coat) return null;
  const { base, light, dark } = coat;
  if (![base, light, dark].every((c) => typeof c === 'string' && HEX_RE.test(c))) return null;
  return { name, breed, art, owner, coat: { base: base as string, light: light as string, dark: dark as string } };
}

export function parseIntent(d: Record<string, unknown>): LiveIntent | null {
  const x = num(d.x, WORLD.minX, WORLD.maxX), y = num(d.y, WORLD.minY, WORLD.maxY);
  const mode = MODES.includes(d.mode as LiveMode) ? (d.mode as LiveMode) : null;
  if (x === null || y === null || !mode || typeof d.hungry !== 'boolean' || typeof d.asleep !== 'boolean') return null;
  return { x, y, mode, hungry: d.hungry, asleep: d.asleep };
}

/** A browser's message, checked. Anything malformed is null and is dropped. */
export function parseClient(raw: string): ClientMessage | null {
  if (raw.length > MAX_MESSAGE_BYTES) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== 'object') return null;
  const m = v as Record<string, unknown>;
  switch (m.t) {
    case 'hello': {
      const dog = parseDog(m.dog);
      return typeof m.id === 'string' && ID_RE.test(m.id) && dog ? { t: 'hello', id: m.id, dog } : null;
    }
    case 'intent': {
      const i = parseIntent(m);
      return i ? { t: 'intent', ...i } : null;
    }
    case 'pet':
      return typeof m.target === 'string' && ID_RE.test(m.target) ? { t: 'pet', target: m.target } : null;
    case 'home':
      return typeof m.hungry === 'boolean' ? { t: 'home', hungry: m.hungry } : null;
    default:
      return null;
  }
}

/** A fixed-window rate limit: true while the connection is within its budget. */
export function withinRate(window: { start: number; count: number }, now: number): boolean {
  if (now - window.start >= 10_000) {
    window.start = now;
    window.count = 0;
  }
  window.count += 1;
  return window.count <= RATE_LIMIT;
}

/** A room name that is easy to read aloud and too long to guess: "pond-tiger-k7f3q2". */
export function newRoomName(random: () => number = Math.random): string {
  const words = ['pond', 'bench', 'tree', 'path', 'ball', 'bone', 'paw', 'tail', 'grass', 'leaf', 'sun', 'moon'];
  const animals = ['tiger', 'otter', 'heron', 'gecko', 'panda', 'koala', 'lemur', 'ibis', 'civet', 'gibbon'];
  const pick = (list: string[]) => list[Math.floor(random() * list.length)];
  let tail = '';
  for (let i = 0; i < 8; i++) tail += 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(random() * 31)];
  return `${pick(words)}-${pick(animals)}-${tail}`;
}

/** A per-browser dog id for live rooms. */
export function newLiveId(random: () => number = Math.random): string {
  let id = '';
  for (let i = 0; i < 16; i++) id += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(random() * 36)];
  return id;
}
