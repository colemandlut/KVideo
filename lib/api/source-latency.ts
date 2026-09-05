export interface SourceLatencyResult {
  latency: number;
  /** A response came back at all. True even for a 404 - see `status`. */
  success: boolean;
  /**
   * The HTTP status, or 0 if nothing answered.
   *
   * Needed because "the server replied" and "the video exists" are different
   * questions: a dead CDN answers a 404 in 200ms, which reads as a fast,
   * healthy source if you only look at latency.
   */
  status: number;
  timeout: boolean;
  method: 'HEAD' | 'GET';
}

type ProbeAttemptResult = SourceLatencyResult;

interface ProbeSourceLatencyOptions {
  fetcher?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
}

async function probeAttempt(
  url: string,
  method: 'HEAD' | 'GET',
  fetcher: typeof fetch,
  timeoutMs: number,
  now: () => number,
): Promise<ProbeAttemptResult> {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const startedAt = now();

  try {
    const response = await fetcher(url, {
      method,
      signal: controller.signal,
      redirect: 'follow',
      ...(method === 'GET' ? { headers: { Range: 'bytes=0-0' } } : {}),
    });

    return {
      latency: Math.max(0, Math.round(now() - startedAt)),
      success: true,
      status: response.status,
      timeout: false,
      method,
    };
  } catch (error) {
    return {
      latency: Math.max(0, Math.round(now() - startedAt)),
      success: false,
      status: 0,
      timeout: timedOut || (error instanceof Error && error.name === 'AbortError'),
      method,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function probeSourceLatency(
  url: string,
  options: ProbeSourceLatencyOptions = {},
): Promise<SourceLatencyResult> {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 5000;
  const now = options.now ?? (() => performance.now());

  const headResult = await probeAttempt(url, 'HEAD', fetcher, timeoutMs, now);
  if (headResult.success) return headResult;

  return probeAttempt(url, 'GET', fetcher, timeoutMs, now);
}
