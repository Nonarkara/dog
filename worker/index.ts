import {drainEmailDeletions} from './emailAuth';
import { validRoom } from '../src/domain/parkProtocol';
import { handleAccounts, type AccountEnv } from './accounts';
import { handlePush, sendDuePushes, type PushEnv } from './push';
import { handleCare, purgeOldVisits, type CareEnv } from './care';
export { ParkRoom } from './parkRoom';

interface DurableObjectNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch: (request: Request) => Promise<Response> };
}

interface Env extends AccountEnv, Omit<PushEnv,'DB'>, CareEnv {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
  PARK_ROOM: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // API endpoints if needed in the future
    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({ status: "ok", service: "dog-os", version: "1.0.0" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // His calls, when the app is closed.
    const push = await handlePush(request, env as unknown as PushEnv, url);
    if (push) return push;

    // Sign-in, cloud-saved dogs, export, delete.
    const account = await handleAccounts(request, env, url);
    if (account) return account;

    // The care ledger: park visits, and the keeper's summary.
    const care = await handleCare(request, env as CareEnv, url);
    if (care) return care;

    // A live park room: one Durable Object per invite link.
    const live = url.pathname.match(/^\/api\/park\/([^/]+)$/);
    if (live) {
      const room = decodeURIComponent(live[1]);
      if (!validRoom(room)) return new Response('Unknown park', { status: 404 });
      return env.PARK_ROOM.get(env.PARK_ROOM.idFromName(room)).fetch(request);
    }

    // Try serving asset directly
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    // SPA fallback to index.html
    const indexRequest = new Request(new URL("/", request.url).toString(), request);
    return env.ASSETS.fetch(indexRequest);
  },

  async scheduled(_event: unknown, env: Env): Promise<void> {
    await sendDuePushes(env as unknown as PushEnv);
    await purgeOldVisits(env as CareEnv);
    await drainEmailDeletions(env);
  },
};
