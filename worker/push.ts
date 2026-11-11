/**
 * HE CALLS YOU WHEN THE APP IS CLOSED.
 *
 * The phone supplies a delivery window and, only when the owner chooses it,
 * one follow-up window. It computes local 07:00–22:00 times before sending.
 * Nothing about the dog, the owner or the reason comes here: the push carries
 * no payload, and the phone's service worker reads the words it saved itself.
 *
 * Old clients omit windows and retain one-shot Bangkok hours. A missed first
 * window promotes a still-valid opted-in follow-up, rather than sending a
 * stale call. Once promoted, its follow-up fields are zero: no third call.
 *
 * POST /api/push {endpoint,at,until?,followupAt?,followupUntil?,revision?}
 * at=0 clears every window; at=null deletes the subscription.
 */
import { readJsonObject } from './requestBody';

interface Stmt { bind(...v: unknown[]): Stmt; run(): Promise<unknown>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }> }
export interface PushEnv { DB: { prepare(sql: string): Stmt }; VAPID_PUBLIC?: string; VAPID_PRIVATE_JWK?: string }

const PUSH_HOSTS = /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)$/;
const MAX_ROWS = 5000;
const HOUR=3_600_000,MAX_AHEAD=48*HOUR,MAX_WINDOW=15*HOUR,FOLLOWUP_GAP=90*60_000;
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
  const input = await readJsonObject(request, 2048);
  if ('status' in input) return json({ error: input.status === 413 ? 'Too large' : 'Not a push subscription' }, input.status);
  const body = input.value;
  if (!validEndpoint(body.endpoint)) return json({ error: 'Not a push subscription' }, 400);
  const now=Date.now(),numeric=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
  if(body.revision!==undefined&&(!numeric(body.revision)||body.revision===0))return json({error:'Bad revision'},400);
  const revision=(body.revision as number|undefined)??0;
  const hasWindow=body.until!==undefined,hasFollowup=body.followupAt!==undefined||body.followupUntil!==undefined;
  if(body.at!==null&&(!numeric(body.at)||body.at>now+MAX_AHEAD))return json({error:'Bad time'},400);
  // Clear/delete cannot carry a dangling window that appears to stay armed.
  if(body.at===null||body.at===0){
    if([body.until,body.followupAt,body.followupUntil].some(value=>value!==undefined&&value!==0))return json({error:'Bad window'},400);
  }else{
    if(hasFollowup&&!hasWindow)return json({error:'Missing delivery window'},400);
    if(hasWindow&&(!numeric(body.until)||body.until<=body.at!||body.until-body.at!>MAX_WINDOW||body.until>now+MAX_AHEAD))return json({error:'Bad delivery window'},400);
    if(hasFollowup){
      if(!numeric(body.followupAt)||!numeric(body.followupUntil))return json({error:'Bad follow-up window'},400);
      if(body.followupAt===0||body.followupUntil===0){if(body.followupAt!==0||body.followupUntil!==0)return json({error:'Partial follow-up window'},400);}
      else if(body.followupAt<body.at!+FOLLOWUP_GAP||body.followupUntil<=body.followupAt||body.followupUntil-body.followupAt>MAX_WINDOW||body.followupUntil>now+MAX_AHEAD)return json({error:'Bad follow-up window'},400);
    }
  }
  const endpointHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body.endpoint))),byte=>byte.toString(16).padStart(2,'0')).join('');
  if (body.at === null) {
    // Record the fence before removing the address. Every registration tests
    // this digest in its INSERT statement, so a separate SELECT cannot race
    // the deletion. A simultaneous higher-revision enable survives both steps.
    await env.DB.prepare('INSERT INTO push_revocations (endpoint_hash, client_revision, updated_at) SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM push_subs WHERE endpoint = ? AND client_revision >= ? AND NOT (client_revision = 0 AND ? = 0)) ON CONFLICT(endpoint_hash) DO UPDATE SET client_revision = excluded.client_revision, updated_at = excluded.updated_at WHERE excluded.client_revision > push_revocations.client_revision')
      .bind(endpointHash,revision,now,body.endpoint,revision,revision).run();
    // A valid disable must not fail when the table is full. Keep this address's
    // newest fence and evict the oldest other digests; never retain raw URLs here.
    await env.DB.prepare('DELETE FROM push_revocations WHERE endpoint_hash IN (SELECT endpoint_hash FROM push_revocations WHERE endpoint_hash <> ? ORDER BY updated_at, endpoint_hash LIMIT (SELECT MAX(COUNT(*) - ?, 0) FROM push_revocations))')
      .bind(endpointHash,MAX_ROWS).run();
    await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ? AND (client_revision < ? OR (client_revision = 0 AND ? = 0))').bind(body.endpoint,revision,revision).run();
    const current=await env.DB.prepare('SELECT MAX(client_revision) AS revision, MAX(present) AS has_subscription FROM (SELECT client_revision, 1 AS present FROM push_subs WHERE endpoint = ? UNION ALL SELECT client_revision, 0 AS present FROM push_revocations WHERE endpoint_hash = ?)').bind(body.endpoint,endpointHash).first<{revision:number|null;has_subscription:number|null}>();
    if((current?.revision??0)>revision||(revision>0&&current?.has_subscription))return json({error:'Stale schedule',revision:current!.revision},409);
    return json({ ok: true });
  }
  const at=body.at as number,until=at?(body.until as number|undefined)??0:0,followupAt=at?(body.followupAt as number|undefined)??0:0,followupUntil=at?(body.followupUntil as number|undefined)??0:0;
  const rows = await env.DB.prepare('SELECT COUNT(*) AS n FROM push_subs').first<{ n: number }>();
  const known = await env.DB.prepare('SELECT 1 AS k FROM push_subs WHERE endpoint = ?').bind(body.endpoint).first();
  if (!known && (rows?.n ?? 0) >= MAX_ROWS) return json({ error: 'Full' }, 503);
  // Arrival order is not user intent order. A tab's old hidden request may
  // arrive after its visible clear, or after another tab has taken over.
  await env.DB.prepare('INSERT INTO push_subs (endpoint, due_at, updated_at, expires_at, followup_at, followup_expires_at, client_revision) SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM push_revocations WHERE endpoint_hash = ? AND client_revision >= ?) ON CONFLICT(endpoint) DO UPDATE SET due_at = excluded.due_at, updated_at = excluded.updated_at, expires_at = excluded.expires_at, followup_at = excluded.followup_at, followup_expires_at = excluded.followup_expires_at, client_revision = excluded.client_revision WHERE excluded.client_revision > push_subs.client_revision OR (excluded.client_revision = 0 AND push_subs.client_revision = 0)')
    .bind(body.endpoint,at,now,until,followupAt,followupUntil,revision,endpointHash,revision).run();
  const current=await env.DB.prepare('SELECT due_at, expires_at, followup_at, followup_expires_at, client_revision FROM push_subs WHERE endpoint = ?').bind(body.endpoint).first<Omit<Schedule,'endpoint'|'updated_at'>>();
  const revoked=await env.DB.prepare('SELECT client_revision FROM push_revocations WHERE endpoint_hash = ?').bind(endpointHash).first<{client_revision:number}>();
  if((revoked&&revoked.client_revision>=revision)||!current||current.client_revision!==revision||current.due_at!==at||current.expires_at!==until||current.followup_at!==followupAt||current.followup_expires_at!==followupUntil)return json({error:'Stale schedule',revision:Math.max(current?.client_revision??0,revoked?.client_revision??0)},409);
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

type Schedule={endpoint:string;due_at:number;updated_at:number;expires_at:number;followup_at:number;followup_expires_at:number;client_revision:number};
const sameSchedule='endpoint = ? AND due_at = ? AND updated_at = ? AND expires_at = ? AND followup_at = ? AND followup_expires_at = ? AND client_revision = ?';
const scheduleValues=(s:Schedule)=>[s.endpoint,s.due_at,s.updated_at,s.expires_at,s.followup_at,s.followup_expires_at,s.client_revision];
/** Legacy clients already promised Bangkok quiet hours. Restrict their old
 * due time to that original day; a delayed row cannot ring the next night. */
function legacyExpiry(due:number):number{
  const local=new Date(due+7*HOUR),hour=local.getUTCHours();
  if(hour<7||hour>=22)return due;
  local.setUTCHours(22,0,0,0);return local.getTime()-7*HOUR;
}
async function advanceSchedule(env:PushEnv,s:Schedule,now:number,delivered:boolean){
  // Delayed delivery must not squeeze two calls into adjacent cron runs.
  const next=delivered?Math.max(s.followup_at,now+FOLLOWUP_GAP):s.followup_at;
  const followup=s.followup_at>0&&next<s.followup_expires_at&&now<s.followup_expires_at;
  await env.DB.prepare(`UPDATE push_subs SET due_at = ?, expires_at = ?, followup_at = 0, followup_expires_at = 0 WHERE ${sameSchedule}`)
    .bind(followup?next:0,followup?s.followup_expires_at:0,...scheduleValues(s)).run();
}

/** Every 15 minutes: deliver valid windows; expired calls never retry at night. */
export async function sendDuePushes(env: PushEnv): Promise<number> {
  const now = Date.now();
  // Installs untouched for a month are gone; this keeps the table small.
  await env.DB.prepare('DELETE FROM push_subs WHERE updated_at < ?').bind(now - 30 * 86_400_000).run();
  await env.DB.prepare('DELETE FROM push_revocations WHERE updated_at < ?').bind(now - 30 * 86_400_000).run();
  if (!env.VAPID_PUBLIC || !env.VAPID_PRIVATE_JWK) return 0;
  // D1 Free permits 50 queries per invocation. Thirty-two sends plus these
  // three maintenance/select queries reserve room for park and account jobs.
  const { results } = await env.DB.prepare('SELECT endpoint, due_at, updated_at, expires_at, followup_at, followup_expires_at, client_revision FROM push_subs WHERE due_at > 0 AND due_at <= ? ORDER BY due_at LIMIT 32').bind(now).all<Schedule>();
  const key = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  let sent = 0;
  for (const schedule of results) {
    const {endpoint}=schedule,expires=schedule.expires_at||legacyExpiry(schedule.due_at);
    const authorization=await vapid(endpoint,env,key);
    const ttl=Math.min(3600,Math.floor((expires-Date.now())/1000));
    if(ttl<1){await advanceSchedule(env,schedule,Date.now(),false);continue;}
    const res = await fetch(endpoint, { method: 'POST', redirect: 'manual', headers: { Authorization: authorization, TTL: String(ttl), Urgency: 'normal', 'Content-Length': '0' } }).catch(() => null);
    // Network error, 429 or 5xx: leave it due and try next run.
    if (!res || res.status === 429 || res.status >= 500) continue;
    // A return, disable or new absence may arrive while the provider is replying.
    // A response belongs only to the schedule selected above; never consume or
    // delete a newer schedule on that same subscription.
    if (res.status === 404 || res.status === 410) await env.DB.prepare(`DELETE FROM push_subs WHERE ${sameSchedule}`).bind(...scheduleValues(schedule)).run();
    else if(res.ok)await advanceSchedule(env,schedule,Date.now(),true);
    else await env.DB.prepare(`UPDATE push_subs SET due_at = 0, expires_at = 0, followup_at = 0, followup_expires_at = 0 WHERE ${sameSchedule}`).bind(...scheduleValues(schedule)).run();
    if (res.ok) sent++;
  }
  if (results.length) console.log(`push: ${sent}/${results.length} delivered`);
  return sent;
}
