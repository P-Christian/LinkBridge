// src/lib/server/pool.ts
//
// Bounded parallel map for the Directus fan-out sites (hydrate one row per
// parent). Plain `Promise.all` over a large id list floods Directus with as
// many simultaneous MySQL queries as there are rows; these lists are
// company-scoped and can reach a few hundred.

/**
 * Maps over `items` with at most `size` promises in flight, preserving input
 * order in the result. Rejects with the first mapper error, like `Promise.all`.
 *
 * Each mapper call is caught inside its own worker: `Promise.all` settles on
 * the first rejection and leaves any later one from a sibling worker as an
 * unhandled rejection, which in a Next.js route means a noisy process warning
 * instead of the route's own 500.
 */
export async function mapPool<T, R>(
  items: readonly T[],
  mapper: (item: T, index: number) => Promise<R>,
  size = 6
): Promise<R[]> {
  if (items.length === 0) return [];

  const width = Math.max(1, Math.min(size, items.length));
  const results = new Array<R>(items.length);
  let cursor = 0;
  let failure: { failed: boolean; error: unknown } = { failed: false, error: undefined };

  const workers = Array.from({ length: width }, async () => {
    while (true) {
      if (failure.failed) return;
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = await mapper(items[index], index);
      } catch (error) {
        if (!failure.failed) {
          failure = { failed: true, error };
          return;
        }
        console.error("[pool] Additional mapper failure while rejecting:", error);
        return;
      }
    }
  });

  await Promise.all(workers);
  if (failure.failed) throw failure.error;
  return results;
}

/**
 * Chunks `items` into batches of `maxKeys` so an `_in=` filter never exceeds
 * what Directus can put in one request URL.
 */
export function chunk<T>(items: readonly T[], maxKeys: number): T[][] {
  if (items.length === 0) return [];
  const size = Math.max(1, maxKeys);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
