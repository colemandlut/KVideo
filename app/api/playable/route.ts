import { NextRequest, NextResponse } from 'next/server';
import { authenticationRequiredResponse } from '@/lib/server/api-responses';
import { getServerSession } from '@/lib/server/auth';
import { getVideoDetail } from '@/lib/api/client';
import { getSourceById } from '@/lib/api/video-sources';
import { probeSourceLatency } from '@/lib/api/source-latency';
import { isProbeableUrl } from '@/lib/server/probe-guard';

export const runtime = 'edge';

/** A playlist behind a redirect still plays. */
function isPlayableStatus(status: number): boolean {
  return (status >= 200 && status < 300) || (status >= 300 && status < 400);
}

/**
 * Whether a source can actually play one of its own results.
 *
 * This is deliberately not the same question as /api/ping, which times the
 * source's *API* host. The two live on different servers and diverge badly:
 * 暴风's API answers in 0.6s while nine in ten of its stream URLs return 404,
 * so the latency badge presented it as one of the healthiest sources in the
 * list while nothing on it would play.
 *
 * The stream URL is resolved here rather than sent by the client. That keeps
 * the endpoint from being a general-purpose fetcher pointed at any host, and
 * it is also the only option - search results carry no play URLs.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session?.profileId) {
    return authenticationRequiredResponse();
  }

  let id: unknown;
  let source: unknown;
  try {
    ({ id, source } = (await request.json()) as { id?: unknown; source?: unknown });
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (typeof id !== 'string' || !id || typeof source !== 'string' || !source) {
    return NextResponse.json({ error: 'id and source are required' }, { status: 400 });
  }

  const sourceConfig = getSourceById(source);
  if (!sourceConfig) {
    return NextResponse.json({ error: 'Unknown source' }, { status: 400 });
  }

  try {
    const detail = await getVideoDetail(id, sourceConfig);
    const streamUrl = detail?.episodes?.[0]?.url;

    // No episode at all is its own kind of unplayable, and worth reporting as
    // such rather than as a probe failure.
    if (typeof streamUrl !== 'string' || !isProbeableUrl(streamUrl)) {
      return NextResponse.json(
        { playable: false, reason: 'no-stream' },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const result = await probeSourceLatency(streamUrl);

    return NextResponse.json(
      {
        playable: result.success && isPlayableStatus(result.status),
        status: result.status,
        latency: result.latency,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Playability check failed:', error);
    return NextResponse.json({ error: 'Probe failed' }, { status: 502 });
  }
}
