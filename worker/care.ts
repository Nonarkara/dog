import { currentUser, type AccountEnv } from './accounts';

/**
 * THE CARE LEDGER — park visits, recorded like a real boarding house's book.
 *
 * When a signed-in owner takes their dog to the park, the app writes a visit:
 * who (a user id), which dog, which room, when they arrived, and a snapshot
 * of how the dog was being cared for at that moment. Leaving closes the
 * visit with an end snapshot. From this the keeper (Dr Non's allow-listed
 * account) can read how each owner's dog is doing — the honest kind of
 * update that comes from the owner's own device, never a scrape.
 *
 * PRIVACY: rows hold user ids and dog facts only. A non-keeper account can
 * read back only its own rows. Nothing here is public.
 */

export interface CareEnv extends AccountEnv {
  /** Comma-separated emails allowed to read every owner's care summary. */
  CARE_KEEPERS?: string;
}

interface Snapshot {
  fullness?: number; energy?: number; hygiene?: number;
  happy?: number; trust?: number; calm?: number;
  sick?: boolean; asleep?: boolean;
}

// The note promises one month: anything older goes, for every owner.
// Runs from the cron and before every read, so no row outlives the promise.
const MONTH_MS = 30 * 86_400_000;
export const purgeOldVisits = (env: CareEnv) =>
  env.DB.prepare('DELETE FROM park_visits WHERE arrived_at < ?').bind(Date.now() - MONTH_MS).run();

const clean = (v: unknown, max: number) => String(v ?? '').slice(0, max).trim();
const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

const snapshotOk = (s: unknown): s is Snapshot => {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return false;
  const rec = s as Record<string, unknown>;
  const nums = ['fullness', 'energy', 'hygiene', 'happy', 'trust', 'calm'];
  return nums.every(k => rec[k] === undefined || (typeof rec[k] === 'number' && Number.isFinite(rec[k]) && rec[k] >= 0 && rec[k] <= 100));
};

export async function handleCare(request: Request, env: CareEnv, url: URL): Promise<Response | null> {
  const path = url.pathname;
  if (!['/api/visit', '/api/visit/leave', '/api/visit/consent', '/api/care/summary'].includes(path)) return null;
  if (request.method !== 'GET') {
    const origin = request.headers.get('Origin');
    if (request.headers.get('X-TDC') !== '1' || (origin && origin !== url.origin)) return json({ error: 'Refused.' }, 403);
  }
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'Sign in to keep the care ledger.' }, 401);

  // CONSENT — visit_consent_at: NULL never asked, 0 declined, a time agreed.
  // The server is the only record of the answer, so every device and account agrees.
  if (path === '/api/visit/consent' && request.method === 'GET') {
    const row = await env.DB.prepare('SELECT visit_consent_at FROM users WHERE id = ?').bind(user.id).first<{ visit_consent_at: number | null }>();
    const at = row?.visit_consent_at;
    return json({ consent: at == null ? null : at > 0 ? 'yes' : 'no' });
  }
  // Agree turns the record on; declining turns it off and deletes this owner's visits.
  if (path === '/api/visit/consent' && request.method === 'POST') {
    let agree = false;
    try { agree = (await request.json()).agree === true; } catch { /* no body means no */ }
    if (agree) await env.DB.prepare('UPDATE users SET visit_consent_at = ? WHERE id = ?').bind(Date.now(), user.id).run();
    else await env.DB.batch([
      env.DB.prepare('UPDATE users SET visit_consent_at = 0 WHERE id = ?').bind(user.id),
      env.DB.prepare('DELETE FROM park_visits WHERE user_id = ?').bind(user.id),
    ]);
    return json({ ok: true, agreed: agree });
  }

  // ARRIVE — close any visit still open for this owner, then open this one.
  if (path === '/api/visit' && request.method === 'POST') {
    let body: { dogId?: unknown; dogName?: unknown; room?: unknown; snapshot?: unknown };
    try { body = await request.json(); } catch { return json({ error: 'Not JSON.' }, 400); }
    const dogId = clean(body.dogId, 60);
    const dogName = clean(body.dogName, 40) || 'A dog';
    const room = clean(body.room, 80) || 'commons';
    if (!dogId) return json({ error: 'Which dog?' }, 400);
    if (!snapshotOk(body.snapshot)) return json({ error: 'Not a care snapshot.' }, 400);
    const now = Date.now();
    // Consent is checked inside the insert itself, so a decline or an account
    // deletion landing mid-request can never leave a visit behind.
    const [, inserted] = await env.DB.batch([
      env.DB.prepare('UPDATE park_visits SET left_at = ? WHERE user_id = ? AND left_at IS NULL').bind(now, user.id),
      env.DB.prepare(`INSERT INTO park_visits (user_id, dog_id, dog_name, room, arrived_at, snapshot)
        SELECT id, ?, ?, ?, ?, ? FROM users WHERE id = ? AND visit_consent_at > 0`)
        .bind(dogId, dogName, room, now, JSON.stringify(body.snapshot), user.id),
    ]) as { meta?: { changes?: number } }[];
    if (!inserted?.meta?.changes) return json({ ok: false, error: 'No consent, nothing recorded.' }, 403);
    return json({ ok: true });
  }

  // LEAVE — close the open visit with an end snapshot.
  if (path === '/api/visit/leave' && request.method === 'POST') {
    let snapshot: Snapshot = {};
    try { const body = await request.json(); if (snapshotOk(body.snapshot)) snapshot = body.snapshot; } catch { /* beacon without a body still closes the visit */ }
    const updated = await env.DB.prepare(
      'UPDATE park_visits SET left_at = ?, snapshot = ? WHERE user_id = ? AND left_at IS NULL'
    ).bind(Date.now(), JSON.stringify(snapshot), user.id).run();
    return json({ ok: true, closed: updated.meta?.changes || 0 });
  }

  // SUMMARY — the keeper reads everyone; an owner reads only their own book.
  if (path === '/api/care/summary' && request.method === 'GET') {
    await purgeOldVisits(env);
    const keepers = (env.CARE_KEEPERS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    // Keepers are Google accounts only: one verified source decides who reads everyone's book.
    const isKeeper = user.provider === 'google' && !!user.email && keepers.includes(user.email.toLowerCase());
    if (!isKeeper) {
      const own = await env.DB.prepare(
        'SELECT dog_name, dog_id, room, arrived_at, left_at, snapshot FROM park_visits WHERE user_id = ? ORDER BY arrived_at DESC LIMIT 50'
      ).bind(user.id).all();
      return json({ keeper: false, visits: own.results });
    }
    const owners = await env.DB.prepare(
      `SELECT v.user_id, u.display_name, v.dog_id, v.dog_name, v.room, v.arrived_at, v.left_at, v.snapshot
       FROM park_visits v JOIN users u ON u.id = v.user_id
       WHERE v.id IN (SELECT MAX(id) FROM park_visits GROUP BY user_id, dog_id)
       ORDER BY v.arrived_at DESC LIMIT 200`
    ).all();
    const visits = await env.DB.prepare(
      `SELECT v.user_id, u.display_name, v.dog_name, v.room, v.arrived_at, v.left_at, v.snapshot
       FROM park_visits v JOIN users u ON u.id = v.user_id
       WHERE v.arrived_at > ? ORDER BY v.arrived_at DESC LIMIT 200`
    ).bind(Date.now() - 14 * 86_400_000).all();
    return json({ keeper: true, dogs: owners.results, recentVisits: visits.results });
  }
  return null;
}
