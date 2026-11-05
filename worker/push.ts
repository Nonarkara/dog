/**
 * HE CALLS YOU WHEN THE APP IS CLOSED.
 *
 * The phone tells us only two things when you leave: where to reach it (a
 * Web Push subscription) and when he will next need you (`at`, worked out on
 * the phone from his own decay model, already moved out of 22:00–07:00).
 * Nothing about the dog, the owner or the reason comes here: the push carries
 * no payload, and the phone's service worker reads the words it saved itself.
 *
 * He may call twice in one absence: the first at the moment he needs you, and
 * once more an hour and a half later if you are still gone. After that he
 * waits — three knocks on a closed door is manners, not nagging. A new
 * absence resets the count; coming back clears the subscription's due time.
 *
 *   POST /api/push   {endpoint, at}   → upsert; at = 0 clears; at = null deletes
 */
interface Stmt { bind(...v: unknown[]): Stmt; run(): Promise<unknown>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }> }
export interface PushEnv { DB: { prepare(sql: string): Stmt }; VAPID_PUBLIC?: string; VAPID_PRIVATE_JWK?: string }

/** How long he waits before calling again, and how many times in all. */
const REPEAT_MS = 90 * 60_000;
const MAX_CALLS = 2;

const PUSH_HOSTS = /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)$/;
const MAX_ROWS = 5000;
const hits = new Map<string, { start: number; n: number }>();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export function validEndpoint(e: unknown): e is string {
  if (typeof e !== 'string' || e.length > 1024) return false;
  try { const u = new URL(e); return u.protocol === 'https:' && !u.port && !u.username && !u.password && u.pathname.length > 20 && PUSH_HOSTS.test(u.hostname); } catch { return false; }
}

export async function handlePush(request: Request, env: PushEnv, url: URL): Promise<Response | null> {
  if (url.pathname !== '/api/push') return null;
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  // ponytail: per-isolate rate limit; a KV/DO counter if abuse ever spreads across isolates.
  const ip = request.headers.get('cf-connecting-ip') ?? '';
  const w = hits.get(ip), t = Date.now();
  if (!w || t - w.start > 60_000) hits.set(ip, { start: t, n: 1 }); else if (++w.n > 20) return json({ error: 'Slow down' }, 429);
  if (hits.size > 10_000) hits.clear();
  const text = await request.text();
  if (text.length > 2048) return json({ error: 'Too large' }, 413);
  let body: { endpoint?: unknown; at?: unknown } | null = null;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  if (!body || !validEndpoint(body.endpoint)) return json({ error: 'Not a push subscription' }, 400);
  if (body.at === null) {
    await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(body.endpoint).run();
    return json({ ok: true });
  }
  const at = Number(body.at);
  const now = Date.now();
  if (!Number.isFinite(at) || at < 0 || at > now + 2 * 86_400_000) return json({ error: 'Bad time' }, 400);
  const rows = await env.DB.prepare('SELECT COUNT(*) AS n FROM push_subs').first<{ n: number }>();
  const known = await env.DB.prepare('SELECT 1 AS k FROM push_subs WHERE endpoint = ?').bind(body.endpoint).first();
  if (!known && (rows?.n ?? 0) >= MAX_ROWS) return json({ error: 'Full' }, 503);
  await env.DB.prepare('INSERT INTO push_subs (endpoint, due_at, updated_at, sent) VALUES (?, ?, ?, 0) ON CONFLICT(endpoint) DO UPDATE SET due_at = excluded.due_at, updated_at = excluded.updated_at, sent = 0')
    .bind(body.endpoint, Math.round(at), now).run();
  return json({ ok: true });
}

const b64url = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** VAPID (RFC 8292): a short ES256 token proving the push comes from us. */
async function vapid(endpoint: string, env: PushEnv, key: CryptoKey): Promise<string> {
  const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc({ typ: 'JWT', alg: 'ES256' })}.${enc({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'https://dog.nonarkara.org' })}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  return `vapid t=${unsigned}.${b64url(sig)}, k=${env.VAPID_PUBLIC}`;
}

/** Every 15 minutes: send the calls that are due, and re-arm the ones he may call again. */
export async function sendDuePushes(env: PushEnv): Promise<number> {
  if (!env.VAPID_PUBLIC || !env.VAPID_PRIVATE_JWK) return 0;
  const now = Date.now();
  // Installs untouched for a month are gone; this keeps the table small.
  await env.DB.prepare('DELETE FROM push_subs WHERE updated_at < ?').bind(now - 30 * 86_400_000).run();
  // Free plan: about 50 subrequests per run, so 40 at a time; the rest go next run.
  const { results } = await env.DB.prepare('SELECT endpoint FROM push_subs WHERE due_at > 0 AND due_at <= ? ORDER BY due_at LIMIT 40').bind(now).all<{ endpoint: string }>();
  const key = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  let sent = 0;
  for (const { endpoint } of results) {
    const res = await fetch(endpoint, { method: 'POST', redirect: 'manual', headers: { Authorization: await vapid(endpoint, env, key), TTL: '3600', Urgency: 'normal', 'Content-Length': '0' } }).catch(() => null);
    // Network error, 429 or 5xx: leave it due and try next run.
    if (!res || res.status === 429 || res.status >= 500) continue;
    if (res.status === 404 || res.status === 410) await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(endpoint).run();
    else {
      // He may call again while you are still away — once, and then he waits.
      // If the counter column is not there yet, the old one-shot behaviour
      // still holds rather than the call being lost.
      try {
        await env.DB.prepare('UPDATE push_subs SET due_at = CASE WHEN sent < ? THEN ? ELSE 0 END, sent = sent + 1 WHERE endpoint = ?')
          .bind(MAX_CALLS - 1, now + REPEAT_MS, endpoint).run();
      } catch {
        await env.DB.prepare('UPDATE push_subs SET due_at = 0 WHERE endpoint = ?').bind(endpoint).run();
      }
    }
    if (res.ok) sent++;
  }
  if (results.length) console.log(`push: ${sent}/${results.length} delivered`);
  return sent;
}
