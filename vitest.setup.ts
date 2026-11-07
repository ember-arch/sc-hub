// No network in unit tests (CLAUDE.md section 6). Pollers and fetchers take an injected
// fetch so fixtures can stand in; anything that reaches the real one fails here.
const blockedFetch = (): never => {
  throw new Error(
    "Network access is not allowed in unit tests (CLAUDE.md section 6). Inject a fetch that reads fixtures instead.",
  );
};

globalThis.fetch = blockedFetch as unknown as typeof fetch;
