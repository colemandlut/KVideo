/**
 * Ping API Route - Measures latency to video sources
 * Returns response time for real-time latency display
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticationRequiredResponse } from '@/lib/server/api-responses';
import { getServerSession } from '@/lib/server/auth';
import { probeSourceLatency } from '@/lib/api/source-latency';
import { isProbeableUrl } from '@/lib/server/probe-guard';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
    // This route fetches a client-supplied URL from the edge. Unauthenticated
    // and unfiltered, it was usable by anyone as a scanner pointed at any host.
    const session = await getServerSession(request);
    if (!session?.profileId) {
        return authenticationRequiredResponse();
    }

    try {
        const body = await request.json();
        const { url } = body;

        if (!url || typeof url !== 'string' || !isProbeableUrl(url)) {
            return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
        }

        const result = await probeSourceLatency(url);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Ping error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
