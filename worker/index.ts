interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
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

    // Try serving asset directly
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    // SPA fallback to index.html
    const indexRequest = new Request(new URL("/", request.url).toString(), request);
    return env.ASSETS.fetch(indexRequest);
  },
};
