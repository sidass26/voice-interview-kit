import { NextRequest, NextResponse } from 'next/server';
import {
  getFullSessionData,
  updateSessionStatus,
  appendTranscriptEntries,
} from '@/lib/orchestration/session-manager';
import type { TranscriptEntry, SessionStatus } from '@/lib/types';

// GET: Full session data for review
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const data = await getFullSessionData(sessionId);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to get session:', error);
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    );
  }
}

// PATCH: Update session (status, transcript entries)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();

    if (body.status) {
      await updateSessionStatus(sessionId, body.status as SessionStatus, body.extra);
    }

    if (body.transcriptEntries) {
      await appendTranscriptEntries(sessionId, body.transcriptEntries as TranscriptEntry[]);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to update session:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}
