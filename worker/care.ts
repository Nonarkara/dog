import { currentUser, type AccountEnv } from './accounts';
import { parseCareSnapshot } from '../src/domain/careSnapshot';
import { readJsonObject } from './requestBody';

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

// The note promises one month: anything older goes, for every owner.
// Runs from the cron and before every read, so no row outlives the promise.
const MONTH_MS = 30 * 86_400_000;
export const purgeOldVisits = (env: CareEnv) =>
  env.DB.prepare('DELETE FROM park_visits WHERE arrived_at < ?').bind(Date.now() - MONTH_MS).run();

const clean = (v: unknown, max: number) => typeof v === 'string' ? v.slice(0, max).trim() : '';
const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });
const validVisitKey = (key: unknown): key is string =>
  typeof key === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(key);
const visitPermission = (accountId: string, at: number | null) => ({
  accountId,
  consent: at === null ? null : at > 0 ? 'yes' : 'no',
  consentAt: at,
});

/** Correct earlier meter labels in summaries, retaining the raw owner export. */
function summaryRows<T extends Record<string, unknown>>(rows: T[]) {
  return rows.map(row => {
    let snapshot = null;
    try { snapshot = parseCareSnapshot(JSON.parse(String(row.snapshot))); } catch { /* Malformed legacy snapshots have no readable meters. */ }
    return { ...row, snapshot: JSON.stringify(snapshot) };
  });
}

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
    if (!row) return json({ error: 'Sign in to keep the care ledger.' }, 401);
    return json(visitPermission(user.id, row.visit_consent_at));
  }
  // Agree turns the record on; declining turns it off and deletes this owner's visits.
  if (path === '/api/visit/consent' && request.method === 'POST') {
    const input = await readJsonObject(request, 2_048);
    if ('status' in input) return json({ error: 'Not a consent choice.' }, input.status);
    const { agree, accountId } = input.value;
    if (typeof agree !== 'boolean') return json({ error: 'Choose whether to record visits.' }, 400);
    if (accountId !== undefined && accountId !== user.id) return json({ error: 'The signed-in account changed.' }, 409);
    if (agree) {
      const row = await env.DB.prepare(
        'UPDATE users SET visit_consent_at = CASE WHEN visit_consent_at > 0 THEN visit_consent_at ELSE ? END WHERE id = ? RETURNING visit_consent_at'
      ).bind(Date.now(), user.id).first<{ visit_consent_at: number }>();
      if (!row) return json({ error: 'Sign in to keep the care ledger.' }, 401);
      return json({ ok: true, agreed: true, ...visitPermission(user.id, row.visit_consent_at) });
    }
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET visit_consent_at = 0 WHERE id = ?').bind(user.id),
      env.DB.prepare('DELETE FROM park_visits WHERE user_id = ?').bind(user.id),
    ]);
    return json({ ok: true, agreed: false, ...visitPermission(user.id, 0) });
  }

  // ARRIVE — keyed visits are independent across tabs and devices.
  if (path === '/api/visit' && request.method === 'POST') {
    const input = await readJsonObject(request, 2_048);
    if ('status' in input) return json({ error: 'Not a visit.' }, input.status);
    const body = input.value;
    const dogId = clean(body.dogId, 60);
    const dogName = clean(body.dogName, 40) || 'A dog';
    const room = clean(body.room, 80) || 'commons';
    if (!dogId) return json({ error: 'Which dog?' }, 400);
    const snapshot = parseCareSnapshot(body.snapshot);
    if (!snapshot) return json({ error: 'Not a care snapshot.' }, 400);
    const now = Date.now();
    if (body.visitKey !== undefined) {
      const { visitKey, accountId, consentAt } = body;
      if (!validVisitKey(visitKey) || typeof consentAt !== 'number' || !Number.isSafeInteger(consentAt) || consentAt <= 0)
        return json({ error: 'Not a visit.' }, 400);
      if (accountId !== user.id) return json({ error: 'The signed-in account changed.' }, 409);
      const insert = await env.DB.prepare(
        `INSERT INTO park_visits (user_id, dog_id, dog_name, room, arrived_at, snapshot, visit_key)
         SELECT id, ?, ?, ?, ?, ?, ? FROM users WHERE id = ? AND visit_consent_at = ?
         ON CONFLICT(user_id, visit_key) DO NOTHING`
      ).bind(dogId, dogName, room, now, JSON.stringify(snapshot), visitKey, user.id, consentAt).run();
      if (insert.meta?.changes) return json({ ok: true });
      const existing = await env.DB.prepare(
        'SELECT v.id FROM park_visits v JOIN users u ON u.id = v.user_id WHERE v.user_id = ? AND v.visit_key = ? AND u.visit_consent_at = ?'
      ).bind(user.id, visitKey, consentAt).first();
      return existing ? json({ ok: true }) : json({ error: 'No consent, nothing recorded.' }, 403);
    }
    // Consent is checked inside the insert itself, so a decline or an account
    // deletion landing mid-request can never leave a visit behind.
    const [, inserted] = await env.DB.batch([
      env.DB.prepare('UPDATE park_visits SET left_at = ? WHERE user_id = ? AND visit_key IS NULL AND left_at IS NULL').bind(now, user.id),
      env.DB.prepare(`INSERT INTO park_visits (user_id, dog_id, dog_name, room, arrived_at, snapshot)
        SELECT id, ?, ?, ?, ?, ? FROM users WHERE id = ? AND visit_consent_at > 0`)
        .bind(dogId, dogName, room, now, JSON.stringify(snapshot), user.id),
    ]) as { meta?: { changes?: number } }[];
    if (!inserted?.meta?.changes) return json({ ok: false, error: 'No consent, nothing recorded.' }, 403);
    return json({ ok: true });
  }

  // LEAVE — an old or repeated departure cannot close another tab's visit.
  if (path === '/api/visit/leave' && request.method === 'POST') {
    const input = await readJsonObject(request, 2_048);
    if ('status' in input) return json({ error: 'Not a visit.' }, input.status);
    const snapshot = parseCareSnapshot(input.value.snapshot);
    if (!snapshot) return json({ error: 'Not a care snapshot.' }, 400);
    const { visitKey, accountId } = input.value;
    if (visitKey !== undefined && !validVisitKey(visitKey)) return json({ error: 'Not a visit.' }, 400);
    if (visitKey !== undefined && accountId !== user.id) return json({ error: 'The signed-in account changed.' }, 409);
    const updated = await env.DB.prepare(
      'UPDATE park_visits SET left_at = ?, snapshot = ? WHERE user_id = ? AND visit_key IS ? AND left_at IS NULL'
    ).bind(Date.now(), JSON.stringify(snapshot), user.id, visitKey ?? null).run();
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
      return json({ keeper: false, visits: summaryRows(own.results) });
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
    return json({ keeper: true, dogs: summaryRows(owners.results), recentVisits: summaryRows(visits.results) });
  }
  return null;
}
