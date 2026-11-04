const MARKER = Symbol.for("vos.sync.routeFetchAbort");

type PendingRead = { route: string; controller: AbortController };

const pendingReads = new Set<PendingRead>();

function isAbortableRead(input: RequestInfo | URL, init?: RequestInit): boolean {
  // A Request carries its own method and signal, so it is left alone entirely.
  if (init?.signal) return false;
  if (typeof input === "object" && !(input instanceof URL)) return false;

  const method = (init?.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return false;

  try {
    const url = new URL(String(input), window.location.href);
    return url.origin === window.location.origin && url.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

/**
 * Cancels same-origin `/api` reads that were started while the app sat on a
 * different route. Reads are tagged with `location.pathname` at call time, so a
 * fetch issued by the incoming page during the same commit carries the new
 * route and survives the sweep no matter when this runs.
 *
 * Mutations are never touched: aborting a half-applied save is worse than a
 * slow one. Callers that pass their own signal keep full control of it.
 */
export function abortSupersededReads(): void {
  const route = window.location.pathname;
  for (const read of pendingReads) {
    if (read.route === route) continue;
    pendingReads.delete(read);
    read.controller.abort();
  }
}

let installed = false;

/**
 * Wraps fetch to tag in-flight reads with the route that started them.
 *
 * Next's client router cache and browser automation tooling also assign
 * `window.fetch`, and whichever assignment lands last wins — a plain wrap gets
 * silently replaced. Intercepting the setter keeps their version running
 * *underneath* ours instead of over us, so this stays the entry point.
 */
export function ensureRouteFetchAbort(): void {
  if (typeof window === "undefined" || installed) return;
  installed = true;

  let underneath = window.fetch.bind(window);

  const patched = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!isAbortableRead(input, init)) return underneath(input, init);

    const read: PendingRead = {
      route: window.location.pathname,
      controller: new AbortController(),
    };
    pendingReads.add(read);

    return underneath(input, { ...init, signal: read.controller.signal }).then(
      (res) => {
        pendingReads.delete(read);
        return res;
      },
      (err) => {
        pendingReads.delete(read);
        // A read abandoned by a route change has no reader left to hand an
        // answer to. Rejecting would light up every `catch { toast.error() }`
        // in the tree on an ordinary navigation, so the promise is left
        // pending instead — nothing awaiting it is still mounted.
        if (read.controller.signal.aborted) return new Promise<Response>(() => {});
        throw err;
      }
    );
  };

  Object.defineProperty(patched, MARKER, { value: true });

  Object.defineProperty(window, "fetch", {
    configurable: true,
    get: () => patched,
    set: (fn: WindowOrWorkerGlobalScope["fetch"]) => {
      if (typeof fn === "function" && !(fn as { [MARKER]?: boolean })[MARKER]) {
        underneath = fn.bind(fn);
      }
    },
  });
}
