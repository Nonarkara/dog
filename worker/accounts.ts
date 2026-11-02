/**
 * ACCOUNTS AND CLOUD-SAVED DOGS.
 *
 * Sign in with Apple, Google or LINE (OpenID Connect, authorization code;
 * PKCE for Google and LINE, a signed client secret for Apple).
 * "Signed in" is a fact the server decides from a session row, never a flag
 * the browser holds: the cookie carries a random token, and only its SHA-256
 * is stored. No passwords anywhere.
 *
 * A dog is stored as the app's own owned-dog backup (format
 * tama-dog-chi-owned-v1): the browser already validates and restores that
 * format, so the server keeps it as an opaque, size-capped blob and checks
 * only what it needs (format, dog, revision, name).
 *
 * Routes:
 *   GET    /api/auth/:provider/start      → the provider's sign-in page
 *   GET    /api/auth/:provider/callback   → back from the provider, session set
 *   POST   /api/auth/logout
 *   GET    /api/me                        → { user, dog, providers }
 *   PUT    /api/dog                       → save (higher revision wins)
 *   GET    /api/export                    → everything we hold about you
 *   DELETE /api/account                   → delete you, your dog, your park visits, your sessions
 */

export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta?: { changes?: number } }>;
}
export interface D1 {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown>;
}

export interface AccountEnv {
  DB: D1;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  LINE_CHANNEL_ID?: string;
  LINE_CHANNEL_SECRET?: string;
  /** Apple: the Services ID, team, key id (plain vars) and the .p8 key (a secret). */
  APPLE_SERVICE_ID?: string;
  APPLE_TEAM_ID?: string;
  APPLE_KEY_ID?: string;
  APPLE_PRIVATE_KEY?: string;
  /** Local testing only: a fake provider, honoured only on localhost. */
  DEV_AUTH?: string;
}

const SESSION_COOKIE = 'tdc_session';
const FLOW_COOKIE = 'tdc_signin';
const SESSION_DAYS = 60;
const MAX_BACKUP_BYTES = 300_000;
const DOG_IDS = ['expo-2021', 'mali-2022', 'oreo-frenchie', 'paolo-pug', 'shiba-chai'];

type Provider = 'apple' | 'google' | 'line' | 'dev';

interface ProviderConfig {
  authorize: string;
  token: string;
  issuers: string[];
  scope: string;
  id: string;
  secret: string;
}

function providerConfig(p: Provider, env: AccountEnv): ProviderConfig | null {
  if (p === 'google' && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
    return {
      authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
      token: 'https://oauth2.googleapis.com/token',
      issuers: ['https://accounts.google.com', 'accounts.google.com'],
      scope: 'openid profile email',
      id: env.GOOGLE_CLIENT_ID,
      secret: env.GOOGLE_CLIENT_SECRET,
    };
  if (p === 'apple' && env.APPLE_SERVICE_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY)
    return {
      authorize: 'https://appleid.apple.com/auth/authorize',
      token: 'https://appleid.apple.com/auth/token',
      issuers: ['https://appleid.apple.com'],
      scope: 'name email',
      id: env.APPLE_SERVICE_ID,
      secret: '', // signed fresh for each sign-in, see appleClientSecret
    };
  if (p === 'line' && env.LINE_CHANNEL_ID && env.LINE_CHANNEL_SECRET)
    return {
      authorize: 'https://access.line.me/oauth2/v2.1/authorize',
      token: 'https://api.line.me/oauth2/v2.1/token',
      issuers: ['https://access.line.me'],
      scope: 'openid profile',
      id: env.LINE_CHANNEL_ID,
      secret: env.LINE_CHANNEL_SECRET,
    };
  return null;
}

/**
 * The test sign-in exists only for local runs. `wrangler dev` presents
 * requests under the real domain, so the guard is: the DEV_AUTH flag, which
 * lives only in the gitignored .dev.vars file that `wrangler deploy` never
 * uploads, AND plain http, which the live site never serves. After every
 * deploy, /api/me must not list "dev" among the providers.
 */
const devAllowed = (url: URL, env: AccountEnv) => env.DEV_AUTH === '1' && url.protocol === 'http:';

export function providersFor(url: URL, env: AccountEnv): Provider[] {
  const list: Provider[] = [];
  if (providerConfig('apple', env)) list.push('apple');
  if (providerConfig('line', env)) list.push('line');
  if (providerConfig('google', env)) list.push('google');
  if (devAllowed(url, env)) list.push('dev');
  return list;
}

/* ---- small helpers -------------------------------------------------- */

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomToken = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));
async function sha256(text: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))));
}
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });

function cookie(name: string, value: string, url: URL, maxAge: number, crossSitePost = false): string {
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  // Apple returns by a cross-site form POST, which a Lax cookie would not ride along with.
  const site = crossSitePost && secure ? 'None' : 'Lax';
  return `${name}=${value}; Path=/; HttpOnly; SameSite=${site}; Max-Age=${maxAge}${secure}`;
}
function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie') ?? '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}
/** LINE signs its ID token with the channel secret (HS256); check it. */
async function lineSignatureOk(token: string, secret: string): Promise<boolean> {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${h}.${p}`)));
  return b64url(sig) === s;
}
/**
 * Apple has no fixed client secret: it is a short JWT signed (ES256) with the
 * .p8 key Apple issues. WebCrypto's ECDSA output is already the raw r||s form JWT wants.
 */
async function appleClientSecret(env: AccountEnv): Promise<string> {
  const pem = (env.APPLE_PRIVATE_KEY ?? '').replace(/-----[^-]+-----|\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const part = (o: object) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const body = `${part({ alg: 'ES256', kid: env.APPLE_KEY_ID })}.${part({ iss: env.APPLE_TEAM_ID, iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: env.APPLE_SERVICE_ID })}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(body)));
  return `${body}.${b64url(sig)}`;
}
const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max) : '';

/* ---- sessions ------------------------------------------------------- */

async function startSession(env: AccountEnv, userId: string, url: URL): Promise<string> {
  const token = randomToken();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256(token), userId, Date.now() + SESSION_DAYS * 86_400_000)
    .run();
  return cookie(SESSION_COOKIE, token, url, SESSION_DAYS * 86_400);
}

export async function currentUser(request: Request, env: AccountEnv) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token || token.length > 100) return null;
  return env.DB.prepare(
    'SELECT u.id, u.display_name, u.provider, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?'
  )
    .bind(await sha256(token), Date.now())
    .first<{ id: string; display_name: string; provider: string; email: string | null }>();
}

/** `name` null keeps the stored name: Apple shares a name only on the very first sign-in.
 *  The email is always the current one, since it decides who may read the care ledger. */
async function upsertUser(env: AccountEnv, provider: Provider, sub: string, name: string | null, email: string | null, fallback = 'Friend') {
  const found = await env.DB.prepare('SELECT id FROM users WHERE provider = ? AND provider_sub = ?').bind(provider, sub).first<{ id: string }>();
  if (found) {
    await env.DB.prepare('UPDATE users SET display_name = COALESCE(?, display_name), email = ? WHERE id = ?').bind(name, email, found.id).run();
    return found.id;
  }
  name = name ?? fallback;
  const id = randomToken(12);
  await env.DB.prepare('INSERT INTO users (id, provider, provider_sub, display_name, email, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, provider, sub, name, email, Date.now())
    .run();
  return id;
}

/** Only send people back into this app, never to another site. */
const safeBack = (v: string | null) => (v && /^\/[^/\\]/.test(v) && v.length < 200 ? v : '/?mode=own');

/* ---- the routes ----------------------------------------------------- */

export async function handleAccounts(request: Request, env: AccountEnv, url: URL): Promise<Response | null> {
  const path = url.pathname;
  if (!path.startsWith('/api/auth/') && !['/api/me', '/api/dog', '/api/export', '/api/account'].includes(path)) return null;

  // Changes need a same-site request with our header: a plain cross-site
  // form or image cannot send it, so cookies alone cannot be abused.
  // Apple's return is a form POST from appleid.apple.com; it is guarded by the
  // state and nonce of the sign-in flow instead of our header.
  if (request.method !== 'GET' && path !== '/api/auth/apple/callback') {
    const origin = request.headers.get('Origin');
    if (request.headers.get('X-TDC') !== '1' || (origin && origin !== url.origin)) return json({ error: 'Refused.' }, 403);
  }

  const start = path.match(/^\/api\/auth\/(apple|google|line|dev)\/start$/);
  if (start && request.method === 'GET') {
    const provider = start[1] as Provider;
    const back = safeBack(url.searchParams.get('back'));
    if (provider === 'dev') {
      if (!devAllowed(url, env)) return json({ error: 'Not available.' }, 404);
      const name = clean(url.searchParams.get('name'), 40) || 'Test owner';
      const userId = await upsertUser(env, 'dev', `dev-${name.toLowerCase()}`, name, null);
      return new Response(null, { status: 302, headers: { Location: back, 'Set-Cookie': await startSession(env, userId, url) } });
    }
    const config = providerConfig(provider, env);
    if (!config) return json({ error: `Sign-in with ${provider} is not set up yet.` }, 503);
    const state = randomToken(16), verifier = randomToken(32), nonce = randomToken(16);
    const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    const target = new URL(config.authorize);
    const params: Record<string, string> = {
      response_type: 'code', client_id: config.id, redirect_uri: `${url.origin}/api/auth/${provider}/callback`,
      scope: config.scope, state, nonce,
    };
    // Apple must POST back when asked for a name or email, and does not use PKCE.
    if (provider === 'apple') params.response_mode = 'form_post';
    else Object.assign(params, { code_challenge: challenge, code_challenge_method: 'S256' });
    target.search = new URLSearchParams(params).toString();
    const flow = b64url(new TextEncoder().encode(JSON.stringify({ provider, state, verifier, nonce, back })));
    return new Response(null, { status: 302, headers: { Location: target.toString(), 'Set-Cookie': cookie(FLOW_COOKIE, flow, url, 600, provider === 'apple') } });
  }

  const callback = path.match(/^\/api\/auth\/(apple|google|line)\/callback$/);
  if (callback && (request.method === 'GET' || (callback[1] === 'apple' && request.method === 'POST'))) {
    const provider = callback[1] as Provider;
    const params = request.method === 'POST' ? new URLSearchParams(await request.text()) : url.searchParams;
    const config = providerConfig(provider, env);
    const fail = (why: string) =>
      new Response(null, { status: 302, headers: { Location: `/?signin=failed&why=${encodeURIComponent(why)}`, 'Set-Cookie': cookie(FLOW_COOKIE, '', url, 0) } });
    if (!config) return fail('not-configured');
    let flow: { provider: string; state: string; verifier: string; nonce: string; back: string };
    try {
      const raw = readCookie(request, FLOW_COOKIE) ?? '';
      flow = JSON.parse(atob(raw.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return fail('expired');
    }
    if (flow.provider !== provider || params.get('state') !== flow.state) return fail('state');
    const code = params.get('code');
    if (!code) return fail(params.get('error') ?? 'cancelled');

    let appleSecret = '';
    if (provider === 'apple') {
      try { appleSecret = await appleClientSecret(env); } catch { return fail('apple-key'); } // a badly pasted .p8
    }
    const tokenResponse = await fetch(config.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', code, redirect_uri: `${url.origin}/api/auth/${provider}/callback`,
        client_id: config.id,
        ...(provider === 'apple'
          ? { client_secret: appleSecret }
          : { client_secret: config.secret, code_verifier: flow.verifier }),
      }),
    });
    if (!tokenResponse.ok) return fail('token');
    const tokens = (await tokenResponse.json()) as { id_token?: string };
    if (!tokens.id_token) return fail('no-id-token');
    // The ID token came straight from the provider over TLS, so its issuer is
    // already authenticated (OIDC Core 3.1.3.7). We still check every claim,
    // and LINE's HMAC signature as well.
    if (provider === 'line' && !(await lineSignatureOk(tokens.id_token, config.secret))) return fail('signature');
    const claims = decodeJwtPayload(tokens.id_token);
    if (!claims) return fail('id-token');
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!config.issuers.includes(String(claims.iss)) || !aud.includes(config.id) || claims.nonce !== flow.nonce || !Number.isFinite(Number(claims.exp)) || Number(claims.exp) * 1000 < Date.now() || typeof claims.sub !== 'string')
      return fail('claims');
    let name: string | null = clean(claims.name, 40) || null;
    if (provider === 'apple') {
      // Apple sends the name once, beside the code, on the very first sign-in only.
      try { const n = JSON.parse(params.get('user') ?? '{}').name ?? {}; name = clean(`${n.firstName ?? ''} ${n.lastName ?? ''}`, 40) || null; } catch { name = null; }
    }
    const verified = claims.email_verified === true || claims.email_verified === 'true';
    const email = provider !== 'line' && verified ? clean(claims.email, 120) || null : null;
    const fallback = provider === 'line' ? 'LINE friend' : provider === 'apple' ? 'Apple friend' : 'Google friend';
    const userId = await upsertUser(env, provider, claims.sub, provider === 'apple' ? name : name ?? fallback, email, fallback);
    const headers = new Headers({ Location: safeBack(flow.back) });
    headers.append('Set-Cookie', await startSession(env, userId, url));
    headers.append('Set-Cookie', cookie(FLOW_COOKIE, '', url, 0));
    return new Response(null, { status: 302, headers });
  }

  if (path === '/api/auth/logout' && request.method === 'POST') {
    const token = readCookie(request, SESSION_COOKIE);
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
    return json({ ok: true }, 200, { 'Set-Cookie': cookie(SESSION_COOKIE, '', url, 0) });
  }

  const user = await currentUser(request, env);

  if (path === '/api/me' && request.method === 'GET') {
    const providers = providersFor(url, env);
    if (!user) return json({ user: null, dog: null, providers });
    const dog = await env.DB.prepare('SELECT name, dog_id, revision, backup, updated_at FROM dogs WHERE user_id = ?').bind(user.id).first();
    return json({ user: { name: user.display_name, provider: user.provider }, dog, providers });
  }

  if (!user) return json({ error: 'Sign in first.' }, 401);

  if (path === '/api/dog' && request.method === 'PUT') {
    const raw = await request.text();
    if (raw.length > MAX_BACKUP_BYTES) return json({ error: 'That save is too large.' }, 413);
    let body: { revision?: unknown; backup?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: 'Not understood.' }, 400);
    }
    const revision = Number(body.revision);
    const backup = body.backup as { format?: string; adoption?: { dogId?: string; name?: string }; save?: { revision?: number } } | undefined;
    if (!Number.isSafeInteger(revision) || revision < 0 || backup?.format !== 'tama-dog-chi-owned-v1' || !DOG_IDS.includes(String(backup.adoption?.dogId)))
      return json({ error: 'Not a dog save.' }, 400);
    const name = clean(backup.adoption?.name, 24) || 'Dog';
    const stored = await env.DB.prepare('SELECT revision FROM dogs WHERE user_id = ?').bind(user.id).first<{ revision: number }>();
    // A device with an older copy never overwrites a newer one.
    if (stored && stored.revision > revision) return json({ ok: false, newer: stored.revision }, 409);
    await env.DB.prepare(
      'INSERT INTO dogs (user_id, name, dog_id, revision, backup, updated_at) VALUES (?, ?, ?, ?, ?, ?) ' +
        'ON CONFLICT(user_id) DO UPDATE SET name = excluded.name, dog_id = excluded.dog_id, revision = excluded.revision, backup = excluded.backup, updated_at = excluded.updated_at'
    )
      .bind(user.id, name, String(backup.adoption!.dogId), revision, JSON.stringify(backup), Date.now())
      .run();
    return json({ ok: true, revision });
  }

  if (path === '/api/export' && request.method === 'GET') {
    const dog = await env.DB.prepare('SELECT name, dog_id, revision, backup, updated_at FROM dogs WHERE user_id = ?').bind(user.id).first();
    await env.DB.prepare('DELETE FROM park_visits WHERE arrived_at < ?').bind(Date.now() - 30 * 86_400_000).run(); // the consent note's one month
    const parkVisits = (await env.DB.prepare('SELECT dog_name, room, arrived_at, left_at, snapshot FROM park_visits WHERE user_id = ? ORDER BY arrived_at DESC').bind(user.id).all()).results;
    return json({ account: { name: user.display_name, provider: user.provider, email: user.email }, dog, parkVisits }, 200, {
      'Content-Disposition': 'attachment; filename="tama-dog-chi-my-data.json"',
    });
  }

  if (path === '/api/account' && request.method === 'DELETE') {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM dogs WHERE user_id = ?').bind(user.id),
      env.DB.prepare('DELETE FROM park_visits WHERE user_id = ?').bind(user.id),
      env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
      env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
    ]);
    return json({ ok: true }, 200, { 'Set-Cookie': cookie(SESSION_COOKIE, '', url, 0) });
  }

  return json({ error: 'Not found.' }, 404);
}
