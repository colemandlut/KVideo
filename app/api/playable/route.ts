import { NextRequest, NextResponse } from 'next/server';
import { authenticationRequiredResponse } from '@/lib/server/api-responses';
import { getServerSession } from '@/lib/server/auth';
import { getVideoDetail } from '@/lib/api/client';
import { getSourceById } from '@/lib/api/video-sources';
import type { VideoSource } from '@/lib/types';
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

  if (typeof id !== 'string' || !id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  // The source may be an id this deployment knows, or the config object the
  // client holds. Most sources come from the user's subscription and exist
  // only on the client, so looking them up by id here failed for every one -
  // which is how a whole screen came to be labelled unplayable. This mirrors
  // what /api/detail already accepts.
  const sourceConfig =
    typeof source === 'string' ? getSourceById(source) : (source as VideoSource | undefined);

  if (!sourceConfig || typeof sourceConfig !== 'object' || !sourceConfig.baseUrl) {
    // Not an answer about playability - say so rather than condemning it.
    return NextResponse.json(
      { checked: false, reason: 'unknown-source' },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const detail = await getVideoDetail(id, sourceConfig);
    const streamUrl = detail?.episodes?.[0]?.url;

    // No episode at all is its own kind of unplayable, and worth reporting as
    // such rather than as a probe failure.
    if (typeof streamUrl !== 'string' || !isProbeableUrl(streamUrl)) {
      return NextResponse.json(
        { checked: false, reason: 'no-stream' },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const result = await probeSourceLatency(streamUrl);

    // A probe that never got an answer says nothing about the source - the CDN
    // may simply refuse requests from a datacenter. Only a real HTTP status is
    // evidence either way.
    if (!result.success || result.status === 0) {
      return NextResponse.json(
        { checked: false, reason: 'probe-failed' },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      {
        checked: true,
        playable: isPlayableStatus(result.status),
        status: result.status,
        latency: result.latency,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Playability check failed:', error);
    return NextResponse.json(
      { checked: false, reason: 'error' },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
