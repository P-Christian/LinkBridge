// src/modules/vos-admin/lib/hiring-map/hiring-live.ts
//
// Real data: a REST snapshot, then new hires from
//   • SSE ("hiring" events from /api/realtime/stream) when `streamUrl` is set, and
//   • a polling safety net that diffs the snapshot, so a dropped connection or a
//     missed event never leaves the TV stale.
//
import type { ConnectionStatus, HireEvent, HiringSource, HiringSourceHandlers } from '../../types/hiring-map.types';

export interface LiveSourceOptions {
  snapshotUrl?: string;
  /** SSE endpoint that emits `event: hiring`. null = polling only. */
  streamUrl?: string | null;
  /** poll interval while SSE is not connected (or when there is no SSE) */
  pollMs?: number;
  /** poll interval while SSE is healthy (just a safety net) */
  pollWhenLiveMs?: number;
}

interface SnapshotResponse {
  hires: HireEvent[];
}

function isHireEvent(value: unknown): value is HireEvent {
  const v = value as Partial<HireEvent> | null;
  return !!v && typeof v.hireId === 'string' && !!v.freelancer && !!v.company && typeof v.hiredAt === 'string';
}

export function createLiveSource(options: LiveSourceOptions = {}): HiringSource {
  const {
    snapshotUrl = '/api/vos-admin/hiring-map/snapshot',
    streamUrl = '/api/realtime/stream',
    pollMs = 10_000,
    pollWhenLiveMs = 60_000,
  } = options;

  const seen = new Set<string>();

  async function fetchSnapshot(signal?: AbortSignal): Promise<HireEvent[]> {
    const res = await fetch(snapshotUrl, { cache: 'no-store', credentials: 'same-origin', signal });
    if (!res.ok) throw new Error(`Hiring snapshot failed (${res.status})`);
    const body = (await res.json()) as SnapshotResponse;
    return Array.isArray(body.hires) ? body.hires.filter(isHireEvent) : [];
  }

  return {
    kind: 'live',

    async loadSnapshot(signal) {
      const hires = await fetchSnapshot(signal);
      hires.forEach((h) => seen.add(h.hireId));
      return hires;
    },

    subscribe({ onHire, onStatus }: HiringSourceHandlers) {
      let stopped = false;
      let sseOk = false;
      let pollOk = true;
      let es: EventSource | null = null;
      let pollTimer: ReturnType<typeof setTimeout> | undefined;
      let reopenTimer: ReturnType<typeof setTimeout> | undefined;
      let lastStatus: ConnectionStatus | null = null;

      const setStatus = () => {
        const status: ConnectionStatus = streamUrl
          ? sseOk
            ? 'live'
            : pollOk
              ? 'reconnecting'
              : 'offline'
          : pollOk
            ? 'live'
            : 'offline';
        if (status !== lastStatus) {
          lastStatus = status;
          onStatus(status);
        }
      };

      const accept = (hire: HireEvent) => {
        if (seen.has(hire.hireId)) return;
        seen.add(hire.hireId);
        onHire(hire);
      };

      const poll = async () => {
        try {
          const hires = await fetchSnapshot();
          pollOk = true;
          // oldest first so a burst plays in order
          hires.sort((a, b) => Date.parse(a.hiredAt) - Date.parse(b.hiredAt)).forEach(accept);
        } catch {
          pollOk = false;
        }
        setStatus();
        if (!stopped) pollTimer = setTimeout(poll, streamUrl && sseOk ? pollWhenLiveMs : pollMs);
      };

      const openStream = () => {
        if (!streamUrl || stopped) return;
        es = new EventSource(streamUrl, { withCredentials: true });
        es.onopen = () => {
          sseOk = true;
          setStatus();
        };
        es.addEventListener('hiring', (event) => {
          try {
            const data: unknown = JSON.parse((event as MessageEvent<string>).data);
            if (isHireEvent(data)) accept(data);
          } catch {
            /* ignore malformed frame */
          }
        });
        es.onerror = () => {
          sseOk = false;
          setStatus();
          // EventSource retries by itself unless the browser gave up (CLOSED).
          if (es && es.readyState === EventSource.CLOSED) {
            es.close();
            es = null;
            reopenTimer = setTimeout(openStream, 5_000);
          }
        };
      };

      setStatus();
      openStream();
      pollTimer = setTimeout(poll, streamUrl ? pollWhenLiveMs : pollMs);

      return () => {
        stopped = true;
        if (pollTimer) clearTimeout(pollTimer);
        if (reopenTimer) clearTimeout(reopenTimer);
        es?.close();
      };
    },
  };
}

