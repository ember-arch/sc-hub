/**
 * A GET to robertsspaceindustries.com that follows a redirect only after the polite spacing
 * (CLAUDE.md section 9: one request every 5 seconds). RSI answers its old addresses, such as
 * `/pledge/ships/<x>/<X>`, with a 301 to `/en/pledge/...`; `fetch` follows that at once by default,
 * which is two requests inside a second. Here each hop waits `spacingMs` first.
 */
export async function rsiGet(
  url: string,
  init: { readonly headers: Record<string, string> },
  options: {
    readonly spacingMs: number;
    readonly sleep: (ms: number) => Promise<unknown>;
    readonly fetch?: typeof fetch;
    readonly maxHops?: number;
  },
): Promise<Response> {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const maxHops = options.maxHops ?? 3;
  let target = url;
  for (let hop = 0; ; hop += 1) {
    const response = await fetchImpl(target, {
      ...init,
      redirect: "manual",
    });
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || location === null) {
      return response;
    }
    // The redirect's own body is not read; release it so the connection is not held.
    await response.body?.cancel();
    if (hop >= maxHops)
      throw new Error(`${url}: more than ${maxHops} redirects`);
    const next = new URL(location, target);
    // Only within RSI: the project's User-Agent and contact address go nowhere else this way.
    if (!/(^|\.)robertsspaceindustries\.com$/.test(next.hostname)) {
      throw new Error(`${url}: redirected off RSI, to ${next.origin}`);
    }
    target = next.toString();
    await options.sleep(options.spacingMs);
  }
}
