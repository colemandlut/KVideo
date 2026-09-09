import { NextRequest, NextResponse } from 'next/server';
import { authenticationRequiredResponse } from '@/lib/server/api-responses';
import { getServerSession } from '@/lib/server/auth';
import { getVideoDetail } from '@/lib/api/client';
import { getSourceById } from '@/lib/api/video-sources';
import type { VideoSource } from '@/lib/types';
import { probeSourceLatency } from '@/lib/api/source-latency';
import { parsePlaylistResolution } from '@/lib/server/stream-info';
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

  // A subscription entry carries only id/name/baseUrl; the path fields are
  // filled in when a source is imported. Defaulting them here means a config
  // that arrives without them builds `baseUrl` rather than `baseUrl` +
  // "undefined", which fails in a way that looks like the source is down.
  const resolvedSource = sourceConfig && typeof sourceConfig === 'object'
    ? { ...sourceConfig, searchPath: sourceConfig.searchPath ?? '', detailPath: sourceConfig.detailPath ?? '' }
    : sourceConfig;

  if (!resolvedSource || typeof resolvedSource !== 'object' || !resolvedSource.baseUrl) {
    // Not an answer about playability - say so rather than condemning it.
    return NextResponse.json(
      { checked: false, reason: 'unknown-source' },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const detail = await getVideoDetail(id, resolvedSource);
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

    // Only an HLS playlist can declare a resolution, and only a master one
    // actually does. Fetching the body of anything else would mean pulling a
    // video file down to the edge to learn nothing.
    let resolution: string | undefined;
    if (result.success && isPlayableStatus(result.status) && /\.m3u8(\?|$)/i.test(streamUrl)) {
      try {
        const playlist = await fetch(streamUrl, {
          // A playlist is a few KB; the cap is there so a mislabelled URL
          // cannot stream a whole film through this route.
          headers: { Range: 'bytes=0-16383' },
        });
        if (playlist.ok || playlist.status === 206) {
          resolution = parsePlaylistResolution(await playlist.text())?.label;
        }
      } catch {
        // Unknown resolution is a normal answer - several sources serve media
        // playlists that carry none - so a failure here is not an error.
      }
    }

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
        resolution,
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
